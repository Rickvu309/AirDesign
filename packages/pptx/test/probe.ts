import { libreOfficeFastCheck } from "./libreoffice.ts"
import assert from "node:assert/strict"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { importPptx, hash } from "../src/index.ts"
import { parseXml } from "../src/xml.ts"

export type PptxCommand = (args: string[], name: string) => Promise<Record<string,unknown>>
export async function probePptx(lane: number, directory: string, cli: PptxCommand): Promise<Record<string,unknown>> {
  const fixtureName = lane === 9 ? "unsafe.pptx" : "preservation.pptx"
  const input = path.resolve("fixtures/pptx",fixtureName)
  const inputBytes = await readFile(input)
  const manifest: unknown = JSON.parse(await readFile("fixtures/pptx/manifest.json","utf8"))
  assert.ok(manifest && typeof manifest === "object" && "fixtures" in manifest && Array.isArray(manifest.fixtures))
  const fixture = manifest.fixtures.find((value: unknown) => typeof value === "object" && value && "name" in value && value.name === fixtureName)
  assert.ok(fixture && typeof fixture === "object" && "sha256" in fixture)
  assert.equal(hash(inputBytes),fixture.sha256)
  const before = await importPptx(inputBytes)
  const output = path.join(directory,"output.pptx")
  let args = ["roundtrip",input,output]
  if (lane === 2) args = ["patch-text",input,output,"ppt/slides/slide1.xml","0","P03 patched executive title"]
  if (lane === 7) args = ["move",input,output,"ppt/slides/slide1.xml","800","100","200"]
  const report = await cli(args,"pptx")
  assert.equal(report.sourceSha256,hash(inputBytes))
  assert.equal(report.localReimport,"passed")
  const after = await importPptx(await readFile(output))
  const changed = [...before.parts].filter(([name,bytes]) => hash(after.parts.get(name) ?? Buffer.alloc(0)) !== hash(bytes)).map(([name]) => name)
  assert.deepEqual(changed,[2,7].includes(lane) ? ["ppt/slides/slide1.xml"] : [])
  for (const relationship of after.report.relationships) assert.ok(after.parts.has(relationship.target))
  assert.equal(after.parts.get("custom/preserved.xml")?.toString(),before.parts.get("custom/preserved.xml")?.toString())
  assert.equal(after.report.referenceGate,"P09-X01-unproven")
  const proof: Record<string,unknown> = { fixture: fixtureName, inputSha256: hash(inputBytes), outputSha256: hash(await readFile(output)), parts: after.parts.size, unchangedParts: after.parts.size-changed.length, changedParts: changed, relationships: after.report.relationships.length, relationshipClosure: true, unknownXmlExact: true, fontProvenance: after.report.fonts, referenceGate: after.report.referenceGate, report: "pptx.json" }
  if (lane === 2) {
    const xml = before.parts.get("ppt/slides/slide1.xml")?.toString() ?? ""
    assert.equal(after.parts.get("ppt/slides/slide1.xml")?.toString(),xml.replace("P03 executive slide 1","P03 patched executive title"))
    proof.styledRunIsolation = true
  }
  if (lane === 3) {
    await cli(["native","-",path.join(directory,"native.pptx")],"native")
    await cli(["patch-table",input,path.join(directory,"table.pptx"),"ppt/slides/slide1.xml","0","1","1","77"],"table")
    await cli(["patch-chart",input,path.join(directory,"chart.pptx"),"ppt/charts/chart1.xml","0","77,88"],"chart")
    const chart = await importPptx(await readFile(path.join(directory,"chart.pptx")))
    const table = await importPptx(await readFile(path.join(directory,"table.pptx")))
    assert.ok(table.parts.get("ppt/slides/slide1.xml")?.toString().includes(">77</a:t>"))
    assert.ok(chart.parts.get("ppt/charts/chart1.xml")?.toString().includes(">88</c:v>"))
    proof.nativeTextTableChartLocalReimport = true
    proof.libreOffice = await Promise.all(["output", "native", "table", "chart"].map(name => libreOfficeFastCheck(path.join(directory, `${name}.pptx`), path.join(directory, "LibreOffice", name))))
  }
  if ([4,5].includes(lane)) {
    assert.ok(after.parts.get("ppt/slides/slide1.xml")?.toString().includes('id="800"'))
    assert.ok(after.parts.get("ppt/slideLayouts/slideLayout1.xml")?.toString().includes('idx="7"'))
    const dependencies = ["ppt/theme/theme1.xml","ppt/slideMasters/slideMaster1.xml","ppt/slideLayouts/slideLayout1.xml"]
    for (const name of dependencies) assert.equal(hash(after.parts.get(name) ?? Buffer.alloc(0)),hash(before.parts.get(name) ?? Buffer.alloc(0)))
    proof.groupAndPlaceholderPlacementBytesExact = true
    proof.visibleInheritance = "unproven-reference-required"
    if (lane === 5) proof.libreOffice = [await libreOfficeFastCheck(output, path.join(directory, "LibreOffice", "output"))]
  }
  if (lane === 6) for (const index of [1,2]) {
    const notes = after.parts.get(`ppt/notesSlides/notesSlide${index}.xml`)
    assert.ok(notes?.toString().includes(`P03 confidential speaker note for slide ${index}`))
    assert.ok(after.report.relationships.some(rel => rel.part === `ppt/slides/slide${index}.xml` && rel.target === `ppt/notesSlides/notesSlide${index}.xml`))
    proof.slideSpecificNotes = 2
  }
  if (lane === 9) {
    assert.ok(before.report.removals.length >= 2)
    assert.ok(!after.parts.has("ppt/vbaProject.bin"))
    assert.ok(!after.parts.get("ppt/slides/_rels/slide1.xml.rels")?.toString().includes("169.254"))
    proof.securityRemovals = before.report.removals
  }
  if (lane === 10) {
    for (const [name,bytes] of after.parts) if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) {
      const ids = parseXml(bytes).nodes.filter(node => node.local === "cNvPr").map(node => node.attributes.id)
      assert.equal(new Set(ids).size,ids.length)
    }
    proof.stableIdentifiersUnique = true
    proof.applicationMetadata = "kept-unverified"
  }
  return proof
}
