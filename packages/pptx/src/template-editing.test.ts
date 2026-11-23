import { decide, elementId, format, openRegister, type ElementPatch, type Register } from "@airdesign/document"
import { expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { themeCustomColors } from "./template-colors.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function load(name: string) {
  const bytes = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)
  return new Map(await readParts(bytes))
}

function edited(node: string, patch: ElementPatch): Register {
  let register = openRegister("", "file")
  for (const command of [
    { command: "add" as const, node: elementId(node), floor: "", route: "file" as const },
    { command: "person" as const, node: elementId(node), v: format, patch },
  ]) {
    const next = decide(register, command)
    if (next.decision === "refuse") throw new Error(next.code)
    register = next.register
  }
  return register
}

it("stores an added colour on one theme and leaves the other theme byte for byte", async () => {
  const parts = await load("two-templates.pptx")
  const coral = [{ name: "A & B", color: "FF6600" }]
  const next = exportParts(parts, edited("deck.templateStyle2", { templateStyle: { custom: { set: coral } } }))
  const written = decodeUtf8(next.get("ppt/theme/theme2.xml")!)
  expect(written).toContain(
    '<a:custClrLst><a:custClr name="A &amp; B"><a:srgbClr val="FF6600"/></a:custClr></a:custClrLst>',
  )
  expect(written.indexOf("<a:custClrLst>")).toBeGreaterThan(written.indexOf("</a:themeElements>"))
  expect(themeCustomColors(next.get("ppt/theme/theme2.xml")!)).toEqual(coral)
  expect(sameBytes(next.get("ppt/theme/theme1.xml")!, parts.get("ppt/theme/theme1.xml")!)).toBe(true)
  const cleared = exportParts(next, edited("deck.templateStyle2", { templateStyle: { custom: { set: [] } } }))
  expect(decodeUtf8(cleared.get("ppt/theme/theme2.xml")!)).not.toContain("custClr")
})

it("leaves a custom colour it cannot read untouched when the field is not set", async () => {
  const parts = await load("two-templates.pptx")
  const theme = "ppt/theme/theme1.xml"
  parts.set(
    theme,
    encodeUtf8(
      decodeUtf8(parts.get(theme)!).replace(
        "</a:theme>",
        '<a:custClrLst><a:custClr name="Shade"><a:schemeClr val="accent1"/></a:custClr></a:custClrLst></a:theme>',
      ),
    ),
  )
  expect(themeCustomColors(parts.get(theme)!)).toBeNull()
  const next = exportParts(parts, edited("deck.templateStyle1", { templateStyle: { accent1: { set: "123456" } } }))
  expect(decodeUtf8(next.get(theme)!)).toContain('<a:custClr name="Shade"><a:schemeClr val="accent1"/></a:custClr>')
})

it("drops an unused template and keeps a template a slide still uses", async () => {
  const parts = await load("two-templates.pptx")
  const index = indexPackage(parts)
  const register = {
    ...edited("deck.templateStyle2", { templateStyle: { removed: { set: true } } }),
    index: { ...index, total: index.elements.length, pages: [] },
  }
  const dropped = exportParts(parts, register)
  expect(dropped.has("ppt/theme/theme2.xml")).toBe(false)
  expect(dropped.has("ppt/slideMasters/slideMaster2.xml")).toBe(false)
  expect(dropped.has("ppt/theme/theme1.xml")).toBe(true)
  expect(dropped.has("ppt/slides/slide1.xml")).toBe(true)
  expect(decodeUtf8(dropped.get("[Content_Types].xml")!)).not.toContain("theme2.xml")
  expect(decodeUtf8(dropped.get("ppt/presentation.xml")!)).not.toContain("slideMaster2.xml")
  expect(sameBytes(dropped.get("ppt/theme/theme1.xml")!, parts.get("ppt/theme/theme1.xml")!)).toBe(true)
  const again = exportParts(dropped, register)
  expect(again.has("ppt/theme/theme2.xml")).toBe(false)
  expect(again.has("ppt/slides/slide1.xml")).toBe(true)
  const kept = exportParts(parts, edited("deck.templateStyles", { templateStyle: { removed: { set: true } } }))
  expect(kept.has("ppt/theme/theme1.xml")).toBe(true)
  expect(kept.has("ppt/theme/theme2.xml")).toBe(false)
  const doe = await load("doe-heat-pumps.pptx")
  const used = exportParts(doe, edited("deck.templateStyles", { templateStyle: { removed: { set: true } } }))
  expect(used.has("ppt/theme/theme1.xml")).toBe(true)
  expect(used.has("ppt/theme/theme2.xml")).toBe(true)
})
