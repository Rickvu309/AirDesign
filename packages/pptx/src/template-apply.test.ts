import { decide, elementId, format, openRegister, type Register } from "@airdesign/document"
import { expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { readSlides } from "./read-shapes.js"
import { paintReader } from "./paint-reader.js"
import { templateStyles, templateStyle } from "./template-style.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function specimen() {
  const bytes = process
    .getBuiltinModule("node:fs")
    .readFileSync(`${process.cwd()}/scripts/pptx-fixtures/doe-heat-pumps.pptx`)
  const parts = new Map(await readParts(bytes))
  const theme = "ppt/theme/theme2.xml"
  parts.set(
    theme,
    encodeUtf8(
      decodeUtf8(parts.get(theme)!)
        .replaceAll('val="4472C4"', 'val="C00000"')
        .replaceAll('typeface="Calibri"', 'typeface="Georgia"'),
    ),
  )
  return parts
}

function assigned(slide: string, id: string, opening = false): Register {
  const node = elementId(`${slide}.slide`)
  let register = openRegister("", "file")
  for (const command of [
    { command: "add", node, floor: "", route: "file" } as const,
    { command: "person", node, v: format, patch: { template: { id: { set: id } } } } as const,
    ...(opening ? [{ command: "person", node, v: format, patch: { template: { id: "opening" } } } as const] : []),
  ]) {
    const next = decide(register, command)
    if (next.decision === "refuse") throw new Error(next.code)
    register = next.register
  }
  return register
}

it("offers actual master themes and applies one slide's style without changing any original slide, layout, master or theme bytes", async () => {
  const parts = await specimen()
  expect(templateStyles(parts).map((style) => style.id)).toEqual(["ppt/theme/theme1.xml", "ppt/theme/theme2.xml"])
  const first = readSlides(parts)[0]!
  const original = paintReader(parts).slide(first.part)
  const next = exportParts(parts, assigned(first.slide, "ppt/theme/theme2.xml"))
  expect(templateStyle(next, first.part).minor).toBe("Georgia")
  expect(
    paintReader(next)
      .slide(first.part)
      .elements.map(({ shape, box }) => ({ shape, box })),
  ).toEqual(original.elements.map(({ shape, box }) => ({ shape, box })))
  const allowed = new Set([
    "[Content_Types].xml",
    "ppt/presentation.xml",
    "ppt/_rels/presentation.xml.rels",
    "ppt/slides/_rels/slide1.xml.rels",
  ])
  for (const [part, bytes] of parts) if (!allowed.has(part)) expect(sameBytes(bytes, next.get(part)!), part).toBe(true)
  for (const slide of readSlides(parts).slice(1))
    expect(templateStyle(next, slide.part)).toEqual(templateStyle(parts, slide.part))
  expect([...exportParts(next, assigned(first.slide, "ppt/theme/theme2.xml"))]).toEqual([...next])
  expect([...exportParts(parts, assigned(first.slide, "ppt/theme/theme2.xml", true))]).toEqual([...parts])
})

it("edits a single template's colors, font and name and preserves the other master's theme", async () => {
  const parts = await specimen()
  const node = elementId("deck.template2")
  let register = openRegister("", "file")
  for (const command of [
    { command: "add", node, floor: "", route: "file" } as const,
    {
      command: "person",
      node,
      v: format,
      patch: { theme: { name: { set: "Night & day" }, accent1: { set: "123456" }, minor: { set: "Verdana" } } },
    } as const,
  ]) {
    const next = decide(register, command)
    if (next.decision === "refuse") throw new Error(next.code)
    register = next.register
  }
  const next = exportParts(parts, register)
  expect(decodeUtf8(next.get("ppt/theme/theme2.xml")!)).toContain('name="Night &amp; day"')
  for (const [part, bytes] of parts)
    if (part !== "ppt/theme/theme2.xml") expect(sameBytes(bytes, next.get(part)!), part).toBe(true)
})

it("keeps both hyperlink colors in the template's full twelve-color palette", async () => {
  const parts = await specimen()
  for (const style of templateStyles(parts)) {
    expect(Object.keys(style.palette.slots)).toHaveLength(12)
    expect(style.palette.slots.hlink).toMatch(/^[0-9A-F]{6}$/)
    expect(style.palette.slots.folHlink).toMatch(/^[0-9A-F]{6}$/)
  }
})

it("allocates a layout identifier that no existing master already uses", async () => {
  const parts = await specimen()
  const master = "ppt/slideMasters/slideMaster1.xml"
  parts.set(
    master,
    encodeUtf8(
      decodeUtf8(parts.get(master)!).replace(
        /(<p:sldLayoutId\b[^>]*\bid=")[0-9]+/,
        (_match, prefix: string) => `${prefix}2147483649`,
      ),
    ),
  )
  const next = exportParts(parts, assigned(readSlides(parts)[0]!.slide, "ppt/theme/theme2.xml"))
  const ids = (parts: ReadonlyMap<string, Uint8Array>) =>
    [...parts].flatMap(([name, bytes]) =>
      /^ppt\/slideMasters\/[^/]+\.xml$/.test(name)
        ? [...decodeUtf8(bytes).matchAll(/<p:sldLayoutId\b[^>]*\bid="([0-9]+)"/g)].map((match) => match[1])
        : [],
    )
  const before = ids(parts)
  const after = ids(next)
  const added = after.slice(before.length)
  expect(added).toHaveLength(1)
  expect(before).not.toContain(added[0])
})
