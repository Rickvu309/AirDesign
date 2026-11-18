import {
  decide,
  elementId,
  format,
  openRegister,
  planChange,
  registerScope,
  type ElementPatch,
  type Register,
  type SetChange,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { remixTargets } from "./template-remix.js"
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

function applied(parts: ReadonlyMap<string, Uint8Array>, changes: readonly SetChange[]) {
  const index = indexPackage(parts)
  let register: Register = { ...openRegister("", "file"), index: { ...index, total: index.elements.length, pages: [] } }
  const scope = registerScope(register)
  for (const change of changes) {
    const plan = planChange(change, scope)
    if (!plan.ok) throw new Error(plan.refusals.map((item) => item.code).join(" "))
    for (const { node, row } of plan.rows) {
      for (const command of [
        { command: "add" as const, node, floor: "", route: "file" as const },
        { command: "person" as const, node, ...row },
      ]) {
        const next = decide(register, command)
        if (next.decision === "refuse") throw new Error(next.code)
        register = next.register
      }
    }
  }
  return exportParts(parts, register)
}

function schemes(parts: ReadonlyMap<string, Uint8Array>, part: string): readonly string[] {
  return [...decodeUtf8(parts.get(part) ?? new Uint8Array()).matchAll(/<a:schemeClr val="([^"]+)"/g)].map(
    (match) => match[1] ?? "",
  )
}

it("stores an added colour on one theme and leaves the other theme byte for byte", async () => {
  const parts = await load("two-templates.pptx")
  const coral = [{ name: "A & B", color: "FF6600" }]
  const next = exportParts(parts, edited("deck.template2", { theme: { custom: { set: coral } } }))
  const written = decodeUtf8(next.get("ppt/theme/theme2.xml")!)
  expect(written).toContain(
    '<a:custClrLst><a:custClr name="A &amp; B"><a:srgbClr val="FF6600"/></a:custClr></a:custClrLst>',
  )
  expect(written.indexOf("<a:custClrLst>")).toBeGreaterThan(written.indexOf("</a:themeElements>"))
  expect(themeCustomColors(next.get("ppt/theme/theme2.xml")!)).toEqual(coral)
  expect(sameBytes(next.get("ppt/theme/theme1.xml")!, parts.get("ppt/theme/theme1.xml")!)).toBe(true)
  const cleared = exportParts(next, edited("deck.template2", { theme: { custom: { set: [] } } }))
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
  const next = exportParts(parts, edited("deck.template1", { theme: { accent1: { set: "123456" } } }))
  expect(decodeUtf8(next.get(theme)!)).toContain('<a:custClr name="Shade"><a:schemeClr val="accent1"/></a:custClr>')
})

it("drops an unused template and keeps a template a slide still uses", async () => {
  const parts = await load("two-templates.pptx")
  const index = indexPackage(parts)
  const register = {
    ...edited("deck.template2", { theme: { removed: { set: true } } }),
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
  const kept = exportParts(parts, edited("deck.theme", { theme: { removed: { set: true } } }))
  expect(kept.has("ppt/theme/theme1.xml")).toBe(true)
  expect(kept.has("ppt/theme/theme2.xml")).toBe(false)
  const doe = await load("doe-heat-pumps.pptx")
  const used = exportParts(doe, edited("deck.theme", { theme: { removed: { set: true } } }))
  expect(used.has("ppt/theme/theme1.xml")).toBe(true)
  expect(used.has("ppt/theme/theme2.xml")).toBe(true)
})

it("rotates the slide's template colours one step and leaves an explicit colour", async () => {
  const parts = await load("two-templates.pptx")
  const slide = "ppt/slides/slide1.xml"
  const before = schemes(parts, slide)
  const once = remixTargets(parts, slide)
  expect(once.length).toBeGreaterThan(0)
  const first = applied(parts, once)
  expect(schemes(first, slide)).toEqual(["dk2", "tx1", "tx1", "accent2"])
  expect(decodeUtf8(first.get(slide)!)).toContain('val="123456"')
  expect(before).toEqual(["tx1", "tx1", "accent1"])
  const twice = applied(first, remixTargets(first, slide))
  expect(schemes(twice, slide)).toEqual(["lt2", "tx1", "tx1", "accent3"])
  expect(remixTargets(parts, "ppt/slides/missing.xml")).toEqual([])
})
