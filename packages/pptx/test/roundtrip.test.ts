import { libreOfficeFastCheck } from "./libreoffice.ts"
import { mkdtemp, rm, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { patchChartValues } from "../src/edit/chart-values.ts"
import PptxGenJS from "pptxgenjs"
import { beforeAll, expect, it } from "vitest"
import { createNativePresentation } from "../src/native.ts"
import { importPptx, exportPptx, patchText, patchTableCell, copyDependency, moveKept, hash, type Presentation } from "../src/index.ts"
import { readArchive, writeArchive } from "../src/archive.ts"
import { parseXml } from "../src/xml.ts"
let original: Presentation
let input: Buffer
beforeAll(async () => {
  original = await createNativePresentation([{ title: "P03 native fixture", table: { headers: ["Name","Value"], rows: [["Alpha","12"],["Beta","24"]] }, chart: { name: "Revenue", labels: ["Q1","Q2"], values: [12,24] }, notes: "Notes associated with slide one" }])
  input = await exportPptx(original)
})
it("preserves every untouched OPC payload and relationship on local reimport", async () => {
  const again = await importPptx(input)
  expect(again.parts.size).toBe(original.parts.size)
  expect(again.report.relationships.length).toBeGreaterThan(10)
  for (const [name,bytes] of original.parts) expect(hash(again.parts.get(name) ?? Buffer.alloc(0))).toBe(hash(bytes))
  expect(again.report.fonts.length).toBeGreaterThan(0)
  expect(again.report.referenceGate).toBe("P09-X01-unproven")
})
it("patches one styled text span and keeps all other bytes and sibling runs", async () => {
  const changed = patchText(original,"ppt/slides/slide1.xml",0,"Changed <title> & style")
  const reimported = await importPptx(await exportPptx(changed))
  for (const [name,bytes] of original.parts) if (name !== "ppt/slides/slide1.xml") expect(reimported.parts.get(name)).toEqual(bytes)
  const old = original.parts.get("ppt/slides/slide1.xml")?.toString() ?? ""
  expect(reimported.parts.get("ppt/slides/slide1.xml")?.toString()).toBe(old.replace("P03 native fixture","Changed &lt;title&gt; &amp; style"))
})
it("retains native table/chart markup, theme/master/placeholder inheritance, and speaker notes", () => {
  expect(original.parts.get("ppt/slides/slide1.xml")?.toString()).toContain("<a:tbl>")
  expect([...original.parts.keys()].some(name => name.startsWith("ppt/charts/chart"))).toBe(true)
  expect(original.parts.has("ppt/slideMasters/slideMaster1.xml")).toBe(true)
  expect(original.parts.has("ppt/theme/theme1.xml")).toBe(true)
  expect(original.parts.get("ppt/notesSlides/notesSlide1.xml")?.toString()).toContain("Notes associated with slide one")
})
it("gives every native slide object a unique numeric identifier", async () => {
  const slide = { title: "Identity", table: { headers: ["Value"], rows: [["12"]] }, chart: { name: "Revenue", labels: ["Q1"], values: [12] }, notes: "Identity" }
  const deck = await createNativePresentation([slide, slide])
  for (const [name, bytes] of deck.parts) if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) {
    const ids = parseXml(bytes).nodes.filter(node => node.local === "cNvPr").map(node => node.attributes.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(id => id !== undefined && /^[1-9]\d*$/.test(id))).toBe(true)
  }
})
it("preserves unknown namespace bytes and moves one kept object using only its declared placement", async () => {
  const parts = new Map(original.parts)
  const bytes = parts.get("ppt/slides/slide1.xml")
  if (!bytes) throw new Error("missing-slide")
  parts.set("custom/unknown.xml", Buffer.from('<x:unknown xmlns:x="urn:unknown"><x:payload raw="unchanged"/></x:unknown>'))
  const kept = await importPptx(await writeArchive(parts))
  const nodes = parseXml(bytes).nodes
  const id = nodes.find(node => node.local === "cNvPr" && node.attributes.id !== "1")?.attributes.id
  if (!id) throw new Error("missing-object")
  const moved = moveKept(kept,"ppt/slides/slide1.xml",id,100,200)
  const again = await importPptx(await exportPptx(moved))
  expect(again.parts.get("custom/unknown.xml")).toEqual(parts.get("custom/unknown.xml"))
  for (const [name,value] of kept.parts) if (name !== "ppt/slides/slide1.xml") expect(again.parts.get(name)).toEqual(value)
})
it("lists security removals and removes external relationships without fetching them", async () => {
  const parts = new Map(original.parts)
  const name = "ppt/slides/_rels/slide1.xml.rels"
  parts.set(name, Buffer.from((parts.get(name)?.toString() ?? "").replace("</Relationships>", '<Relationship Id="evil" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="http://169.254.169.254/latest" TargetMode="External"/></Relationships>')))
  parts.set("ppt/vbaProject.bin", Buffer.from("macro"))
  const safe = await importPptx(await writeArchive(parts))
  expect(safe.report.removals.map(item => item.reason)).toContain("remote-external-relationships")
  expect(safe.report.removals.map(item => item.reason)).toContain("macros")
  expect(safe.parts.has("ppt/vbaProject.bin")).toBe(false)
  expect(safe.parts.get(name)?.toString()).not.toContain("169.254")
  await expect(importPptx(await exportPptx(safe))).resolves.toHaveProperty("parts")
})
it("rejects DTD, entities, excessive nesting, malformed CRC, expansion and unsafe paths", async () => {
  expect(() => parseXml(Buffer.from('<!DOCTYPE x [<!ENTITY evil SYSTEM "file:///etc/passwd">]><x>&evil;</x>'))).toThrow("dtd")
  expect(() => parseXml(Buffer.from("<x>".repeat(130)+"</x>".repeat(130)))).toThrow("complexity")
  const corrupted = Buffer.from(input)
  corrupted[100] = (corrupted[100] ?? 0) ^ 1
  await expect(readArchive(corrupted)).rejects.toThrow()
  await expect(writeArchive(new Map([["../escape",Buffer.from("bad")]]))).rejects.toThrow("unsafe")
})

it("keeps the original embedded chart workbook byte for byte", async () => {
  const generator = new PptxGenJS()
  generator.addSlide().addChart(generator.ChartType.bar, [{ name: "Series", labels: ["A"], values: [1] }], { x: 1, y: 1, w: 5, h: 3 })
  const raw = await generator.write({ outputType: "nodebuffer" })
  if (!(raw instanceof Uint8Array)) throw new Error("fixture-output")
  const bytes = Buffer.from(raw)
  const source = await readArchive(bytes)
  const workbook = [...source.keys()].find(name => name.endsWith(".xlsx"))
  if (!workbook) throw new Error("fixture-workbook-required")
  const imported = await importPptx(bytes)
  expect(hash(imported.parts.get(workbook) ?? Buffer.alloc(0))).toBe(hash(source.get(workbook) ?? Buffer.alloc(0)))
  expect(imported.report.removals).toEqual([])
})

it("selectively edits table text, chart caches and the linked workbook without touching other parts", async () => {
  const table = patchTableCell(original,"ppt/slides/slide1.xml",0,1,1,"77")
  const edited = await patchChartValues(table,"ppt/charts/chart1.xml",0,[77,88])
  const checked = await importPptx(await exportPptx(edited))
  expect(checked.parts.get("ppt/slides/slide1.xml")?.toString()).toContain(">77</a:t>")
  expect(checked.parts.get("ppt/charts/chart1.xml")?.toString()).toContain(">88</c:v>")
  const workbookName = [...checked.parts.keys()].find(name => name.endsWith(".xlsx"))
  if (!workbookName) throw new Error("missing-workbook")
  const workbook = await readArchive(checked.parts.get(workbookName) ?? Buffer.alloc(0))
  expect(workbook.get("xl/worksheets/sheet1.xml")?.toString()).toContain(">88</v>")
  for (const [name,bytes] of original.parts) if (!["ppt/slides/slide1.xml","ppt/charts/chart1.xml",workbookName].includes(name)) expect(hash(checked.parts.get(name) ?? Buffer.alloc(0))).toBe(hash(bytes))
})
it("copies a shared theme dependency with its content type and preserves the original", async () => {
  const copied = copyDependency(original,"ppt/theme/theme1.xml","ppt/theme/theme-p03.xml","ppt/slideMasters/_rels/slideMaster1.xml.rels","rId2")
  const checked = await importPptx(await exportPptx(copied))
  expect(checked.parts.get("ppt/theme/theme-p03.xml")).toEqual(original.parts.get("ppt/theme/theme1.xml"))
  expect(checked.parts.get("ppt/theme/theme1.xml")).toEqual(original.parts.get("ppt/theme/theme1.xml"))
  expect(checked.parts.get("[Content_Types].xml")?.toString()).toContain('PartName="/ppt/theme/theme-p03.xml"')
})

it("limits native capability claims to individual text spans", () => {
  const native = original.report.capabilities.filter(item => item.support === "native")
  expect(native.length).toBeGreaterThan(0)
  for (const item of native) expect(item).toHaveProperty("scope.kind", "text-span")
  expect(original.report.capabilities.some(item => item.part === "ppt/slides/slide1.xml" && item.support === "kept")).toBe(true)
})
it("rejects XML metacharacters in copied dependency paths", () => {
  expect(() => copyDependency(original,"ppt/theme/theme1.xml",'ppt/theme/theme"evil.xml',"ppt/slideMasters/_rels/slideMaster1.xml.rels","rId2")).toThrow()
})
it("rejects a chart whose workbook sheet identity is not qualified", async () => {
  const name = [...original.parts.keys()].find(part => part.endsWith(".xlsx"))
  if (!name) throw new Error("workbook-required")
  const sheets = await readArchive(original.parts.get(name) ?? Buffer.alloc(0))
  sheets.set("xl/workbook.xml",Buffer.from((sheets.get("xl/workbook.xml")?.toString() ?? "").replace('r:id="rId1"','r:id="missing"')))
  const parts = new Map(original.parts)
  parts.set(name,await writeArchive(sheets))
  await expect(patchChartValues({ ...original, parts },"ppt/charts/chart1.xml",0,[10,20])).rejects.toThrow("chart-sheet-unqualified")
})

it("validates the committed fixture hashes and rejects hostile archive, XML and font inputs", async () => {
  const manifest: { fixtures: { name: string; sha256: string }[] } = JSON.parse(await readFile("fixtures/pptx/manifest.json","utf8"))
  for (const fixture of manifest.fixtures) {
    const bytes = await readFile(`fixtures/pptx/${fixture.name}`)
    expect(hash(bytes)).toBe(fixture.sha256)
    if (fixture.name.startsWith("hostile-")) await expect(importPptx(bytes)).rejects.toThrow()
    else {
      const imported = await importPptx(bytes)
      expect(imported.report.referenceGate).toBe("P09-X01-unproven")
      expect(imported.parts.has("ppt/presentation.xml")).toBe(true)
    }
  }
})

it("rejects SVG content types hidden behind binary extensions", async () => {
  for (const declaration of ['<Override PartName="/ppt/media/active.bin" ContentType="image/svg+xml"/>', '<Default Extension="bin" ContentType="image/svg+xml"/>']) {
    const parts = new Map(original.parts)
    parts.set("[Content_Types].xml", Buffer.from((parts.get("[Content_Types].xml")?.toString() ?? "").replace("</Types>", declaration + "</Types>")))
    parts.set("ppt/media/active.bin", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))
    await expect(importPptx(await writeArchive(parts))).rejects.toThrow("unsafe-svg")
  }
})
it("expands self-closing native text inside its element and preserves unrelated bytes", async () => {
  for (const empty of ["<a:t/>", "<a:t />"]) {
    const parts = new Map(original.parts)
    const name = "ppt/slides/slide1.xml"
    const xml = (parts.get(name)?.toString() ?? "").replace("<a:t>P03 native fixture</a:t>", empty)
    expect(xml).toContain(empty)
    parts.set(name, Buffer.from(xml))
    const deck = await importPptx(await writeArchive(parts))
    const changed = patchText(deck, name, 0, "Inside & safe")
    expect(changed.parts.get(name)?.toString()).toBe(xml.replace(empty, empty.replace(/\s*\/>$/, ">") + "Inside &amp; safe</a:t>"))
    for (const [part, bytes] of parts) if (part !== name) expect(changed.parts.get(part)).toEqual(bytes)
    const nodes = parseXml(changed.parts.get(name) ?? Buffer.alloc(0))
    const text = nodes.nodes.find(node => node.local === "t")
    expect(text && nodes.xml.slice(text.openEnd, text.closeStart)).toBe("Inside &amp; safe")
  }
})

it("reports missing LibreOffice as unavailable and requires a real PDF for a pass", async () => {
  const directory = await mkdtemp(path.join(os.homedir(), "tmp/p03-lo-test-"))
  try {
    expect((await libreOfficeFastCheck("fixtures/pptx/preservation.pptx", directory, "")).status).toBe("unavailable")
    await expect(libreOfficeFastCheck("fixtures/pptx/preservation.pptx", directory, "/usr/bin/true")).rejects.toThrow()
  } finally { await rm(directory, { recursive: true, force: true }) }
})
