import {
  decide,
  elementId,
  openRegister,
  planChange,
  registerScope,
  type ElementId,
  type Register,
  type SetChange,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { deckLayouts, deckMasters } from "./deck-layouts.js"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { linkedPart } from "./notes-part.js"
import { decodeUtf8, sameBytes } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { paintReader, type PaintElement } from "./paint-reader.js"
import { readSlides } from "./read-shapes.js"
import { slideTextStyles } from "./slide-text-styles.js"
import { masterTextStyles, readTemplateTextEdit, type TemplateTextEdit } from "./template-text-edit.js"
import { templateStyles } from "./template-style.js"
import { slideTheme } from "./theme-swatches.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

async function load(name: string): Promise<Map<string, Uint8Array>> {
  const bytes = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)
  return new Map(await readParts(bytes))
}

function opened(parts: Parts): Register {
  const index = indexPackage(parts)
  return { ...openRegister("", "file"), index: { ...index, total: index.elements.length, pages: [] } }
}

function masterFor(parts: Parts, theme: string): string | null {
  const found = deckLayouts(parts)
    .map((layout) => linkedPart(parts, layout.part, "slideMaster"))
    .find((master) => master !== null && linkedPart(parts, master, "theme") === theme)
  return found ?? null
}

function apply(register: Register, change: SetChange): Register {
  const plan = planChange(change, registerScope(register))
  if (!plan.ok) throw new Error(plan.refusals.map((item) => item.code).join(" "))
  let next = register
  for (const { node, row } of plan.rows) {
    if (!next.nodes.includes(node)) {
      const added = decide(next, { command: "add", node, floor: "", route: "file" })
      if (added.decision === "refuse") throw new Error(added.code)
      next = added.register
    }
    const person = decide(next, { command: "person", node, ...row })
    if (person.decision === "refuse") throw new Error(person.code)
    next = person.register
  }
  return next
}

function planned(register: Register, change: SetChange) {
  const plan = planChange(change, registerScope(register))
  if (!plan.ok) throw new Error(plan.refusals.map((item) => item.code).join(" "))
  return plan.rows
}

function changeOf(node: ElementId, edit: TemplateTextEdit): SetChange {
  return { target: { node }, theme: { textStyle: [edit] } }
}

function differing(left: Parts, right: Parts): readonly string[] {
  const names = new Set([...left.keys(), ...right.keys()])
  return [...names].filter((name) => {
    const before = left.get(name)
    const after = right.get(name)
    return before === undefined || after === undefined || !sameBytes(before, after)
  })
}

function styleSlice(bytes: Uint8Array, tag: string): string {
  const text = decodeUtf8(bytes)
  const start = text.indexOf(`<p:${tag}`)
  if (start < 0) throw new Error(tag)
  const openedAt = text.indexOf(">", start)
  const head = text.slice(start, openedAt + 1)
  if (head.endsWith("/>")) return head
  const end = text.indexOf(`</p:${tag}>`, start)
  if (end < 0) throw new Error(tag)
  return text.slice(start, end + `</p:${tag}>`.length)
}

function titlePoint(element: PaintElement): number | null {
  const paragraphs = element.text?.paragraphs ?? []
  for (const paragraph of paragraphs) {
    const run = paragraph.runs.find((item) => item.text.trim() !== "")
    if (run !== undefined) return run.size
  }
  return paragraphs[0]?.endStyle.size ?? null
}

function titleSizes(parts: Parts): readonly { part: string; size: number }[] {
  const reader = paintReader(parts)
  const found: { part: string; size: number }[] = []
  for (const { part } of readSlides(parts)) {
    let paint
    try {
      paint = reader.slide(part)
    } catch (error) {
      const message = error instanceof Error ? error.message : "paint"
      throw new Error(`${part}: ${message}`)
    }
    for (const element of paint.elements) {
      if (element.from !== "slide") continue
      const type = element.placeholder?.type
      if (type !== "title" && type !== "ctrTitle") continue
      const size = titlePoint(element)
      if (size !== null) found.push({ part, size })
    }
  }
  return found
}

function titled(parts: Parts) {
  for (const [index, style] of templateStyles(parts).entries()) {
    const master = masterFor(parts, style.id)
    if (master === null) continue
    const id = `${master}/titleStyle/0`
    const read = readTemplateTextEdit(parts, style.id, id)
    if (read?.size !== 4400) continue
    return { node: elementId(`deck.template${String(index + 1)}`), theme: style.id, master, id, font: read.font }
  }
  throw new Error("title style")
}

it("restyles inheriting titles from the master and leaves explicit sizes in one undo", async () => {
  const parts = await load("doe-heat-pumps.pptx")
  const found = titled(parts)
  const title: TemplateTextEdit = { id: found.id, size: 3200, font: found.font }
  const body: TemplateTextEdit = { id: `${found.master}/bodyStyle/0`, size: 2000, font: "+mn-lt" }
  const baseline = exportParts(parts, opened(parts))
  const before = styleSlice(baseline.get(found.master)!, "titleStyle")
  let register = opened(parts)
  const first = planned(register, changeOf(found.node, title))
  expect(first).toHaveLength(1)
  expect(first[0]?.row.patch.theme).toEqual({ textStyle: { set: [title] } })
  register = apply(register, changeOf(found.node, title))
  const edited = exportParts(parts, register)
  expect(differing(baseline, edited)).toEqual([found.master])
  const after = styleSlice(edited.get(found.master)!, "titleStyle")
  expect(after).toContain('sz="3200"')
  expect(after).toContain(`typeface="${found.font}"`)
  const ea = before.match(/<a:ea\b[^>]*\/>/)
  if (ea !== null) expect(after).toContain(ea[0])
  expect(readTemplateTextEdit(edited, found.theme, found.id)).toEqual(title)
  const beforeTitles = titleSizes(baseline)
  const afterTitles = titleSizes(edited)
  let changed = 0
  let stayed = 0
  for (const [index, item] of beforeTitles.entries()) {
    const next = afterTitles[index]
    if (next?.part !== item.part || slideTheme(parts, item.part) !== found.theme) continue
    if (next.size === 32 && item.size === 44) changed += 1
    else if (next.size === item.size && item.size !== 32) stayed += 1
  }
  expect(changed).toBeGreaterThan(0)
  expect(stayed).toBeGreaterThan(0)
  const second = planned(register, changeOf(found.node, body))
  expect(second).toHaveLength(1)
  expect(second[0]?.row.patch.theme).toEqual({ textStyle: { set: [title, body] } })
  const both = exportParts(parts, apply(register, changeOf(found.node, body)))
  expect(readTemplateTextEdit(both, found.theme, found.id)).toEqual(title)
  expect(readTemplateTextEdit(both, found.theme, body.id)).toEqual(body)
  expect(styleSlice(baseline.get(found.master)!, "titleStyle")).toContain('sz="4400"')
  for (const master of deckMasters(parts)) {
    if (master === found.master) continue
    expect(sameBytes(both.get(master)!, baseline.get(master)!)).toBe(true)
  }
}, 120_000)

it("creates a title level on an empty master style and leaves the slide file", async () => {
  const parts = await load("two-templates.pptx")
  const styles = templateStyles(parts)
  const theme = styles[0]?.id
  if (theme === undefined) throw new Error("theme")
  const master = masterFor(parts, theme)
  if (master === null) throw new Error("master")
  const edit: TemplateTextEdit = { id: `${master}/titleStyle/0`, size: 3200, font: "Georgia" }
  const baseline = exportParts(parts, opened(parts))
  const edited = exportParts(parts, apply(opened(parts), changeOf(elementId("deck.template1"), edit)))
  const slice = styleSlice(edited.get(master)!, "titleStyle")
  expect(slice).toContain('<a:lvl1pPr><a:defRPr sz="3200"><a:latin typeface="Georgia"/></a:defRPr></a:lvl1pPr>')
  const fallback = slice.indexOf("<a:defPPr")
  if (fallback >= 0) expect(slice.indexOf("<a:lvl1pPr")).toBeGreaterThan(fallback)
  expect(readTemplateTextEdit(edited, theme, edit.id)).toEqual(edit)
  expect(differing(baseline, edited)).toEqual([master])
  expect(titleSizes(edited)).toEqual(titleSizes(baseline))
  for (const other of deckMasters(parts)) {
    if (other === master) continue
    expect(sameBytes(edited.get(other)!, baseline.get(other)!)).toBe(true)
  }
})

it("writes a layout placeholder style without touching the slide", async () => {
  const parts = await load("two-templates.pptx")
  const slide = readSlides(parts)[0]
  if (slide === undefined) throw new Error("slide")
  const theme = slideTheme(parts, slide.part)
  if (theme === null) throw new Error("theme")
  const style = slideTextStyles(parts, slide.part).find((item) => item.id.startsWith("ppt/slideLayouts/"))
  expect(style).toBeDefined()
  if (style === undefined) return
  const layout = /^ppt\/slideLayouts\/slideLayout\d+\.xml/.exec(style.id)?.[0]
  if (layout === undefined) throw new Error("layout")
  const font = style.fields.font
  if (font === undefined) throw new Error("font")
  const edit: TemplateTextEdit = {
    id: style.id,
    size: style.fields.size === 1500 ? 1600 : 1500,
    font,
  }
  const index = templateStyles(parts).findIndex((item) => item.id === theme)
  const node = elementId(`deck.template${String(index + 1)}`)
  const baseline = exportParts(parts, opened(parts))
  const edited = exportParts(parts, apply(opened(parts), changeOf(node, edit)))
  expect(differing(baseline, edited)).toEqual([layout])
  expect(readTemplateTextEdit(edited, theme, edit.id)).toEqual(edit)
  expect(decodeUtf8(edited.get(layout)!)).toContain(`sz="${String(edit.size)}"`)
})

it("keeps a master text style that has no level of its own", async () => {
  const parts = await load("clean.pptx")
  const theme = templateStyles(parts)[0]?.id
  if (theme === undefined) throw new Error("theme")
  const styles = masterTextStyles(parts, theme)
  expect(styles.map((style) => style.role)).toEqual(["title", "body", "other"])
  expect(styles.map((style) => style.size)).toEqual([null, null, null])
  expect(styles.map((style) => style.font)).toEqual(["+mj-lt", "+mn-lt", "+mn-lt"])
  const title = styles[0]
  if (title === undefined) throw new Error("title")
  const index = templateStyles(parts).findIndex((item) => item.id === theme)
  const edited = exportParts(
    parts,
    apply(opened(parts), changeOf(elementId(`deck.template${String(index + 1)}`), { ...title, size: 3200 })),
  )
  expect(readTemplateTextEdit(edited, theme, title.id)).toEqual({ id: title.id, size: 3200, font: title.font })
})
