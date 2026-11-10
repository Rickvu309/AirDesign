import { markupDocument, type MarkupElement } from "./element-span.js"
import { applyRoute, type AppliedParts } from "./slide-route.js"
import { applyStructuralRoute } from "./structural-route.js"

const elementId = /^(?:[0-9]{1,10}|n[0-9a-z]{12})\.(?:[0-9]{1,10}|n[0-9a-z]{12})$/
const createdId = /^n[0-9a-z]{12}$/
const presentationPart = "ppt/presentation.xml"
const presentationRels = "ppt/_rels/presentation.xml.rels"

export type ElementEdit =
  | { readonly id: string; readonly name: "text"; readonly text: string }
  | { readonly id: string; readonly name: "move"; readonly x: number; readonly y: number }
  | { readonly id: string; readonly name: "resize"; readonly cx: number; readonly cy: number }
  | { readonly id: string; readonly name: "remove" }
  | {
      readonly id: string
      readonly name: "add"
      readonly text: string
      readonly x: number
      readonly y: number
      readonly cx: number
      readonly cy: number
    }
  | { readonly name: "sldIdLst.add"; readonly after: string }

export type WrittenIds = {
  readonly slides: ReadonlyMap<string, string>
  readonly shapes: ReadonlyMap<string, string>
}

type Split = { readonly slide: string; readonly shape: string }

type Held = {
  readonly edit: Exclude<ElementEdit, { readonly name: "sldIdLst.add" }>
  readonly slide: string
  readonly shape: string
}

type AddEdit = Extract<ElementEdit, { readonly name: "add" }>

type Row = { readonly id: string; readonly shape: string; readonly edit: AddEdit }

function splitId(id: string): Split {
  if (!elementId.test(id)) throw new Error("element id")
  let slide = ""
  let shape = ""
  let dotted = false
  for (const char of id) {
    if (char === ".") {
      dotted = true
      continue
    }
    if (dotted) shape += char
    else slide += char
  }
  return { slide, shape }
}

function isCreated(value: string): boolean {
  return createdId.test(value)
}

function attribute(element: MarkupElement, name: string): string | null {
  for (const item of element.attributes) if (item.name === name) return item.value
  return null
}

function slidePartName(target: string): string {
  if (target.startsWith("/")) return target.slice(1)
  if (target.startsWith("ppt/")) return target
  return `ppt/${target}`
}

function partForSlide(parts: ReadonlyMap<string, Uint8Array>, slide: string): string | null {
  const presentation = parts.get(presentationPart)
  const rels = parts.get(presentationRels)
  if (presentation === undefined || rels === undefined) return null
  const relationships = markupDocument(rels).elements
  for (const element of markupDocument(presentation).elements) {
    if (element.kind !== "p:sldId" || element.id !== slide) continue
    const rid = attribute(element, "r:id")
    if (rid === null) return null
    for (const item of relationships) {
      if (item.kind !== "Relationship" || attribute(item, "Id") !== rid) continue
      const target = attribute(item, "Target")
      if (target === null || target === "") return null
      return slidePartName(target)
    }
    return null
  }
  return null
}

function lastSlide(parts: ReadonlyMap<string, Uint8Array>): string {
  const presentation = parts.get(presentationPart)
  if (presentation === undefined) throw new Error("slide")
  let last: string | null = null
  for (const element of markupDocument(presentation).elements) {
    if (element.kind === "p:sldId" && element.id !== null) last = element.id
  }
  if (last === null) throw new Error("slide")
  return last
}

function fresh(parts: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  return new Map(parts)
}

function hold(edits: readonly ElementEdit[]): Held[] {
  const held: Held[] = []
  for (const edit of edits) {
    if (edit.name === "sldIdLst.add") continue
    const split = splitId(edit.id)
    if (edit.name === "add" && !isCreated(split.shape)) throw new Error("shape")
    held.push({ edit, slide: split.slide, shape: split.shape })
  }
  return held
}

function slideTokens(held: readonly Held[]): string[] {
  return [...new Set(held.map((row) => row.slide).filter(isCreated))].sort()
}

function writtenSlide(parts: ReadonlyMap<string, Uint8Array>, after: string): AppliedParts {
  const written = applyStructuralRoute(parts, { name: "sldIdLst.add", after })
  if (written.id === null) throw new Error("slide")
  return written
}

function partForHalf(
  parts: ReadonlyMap<string, Uint8Array>,
  slide: string,
  slides: ReadonlyMap<string, string>,
): string {
  const number = isCreated(slide) ? slides.get(slide) : slide
  if (number === undefined) throw new Error("slide")
  const part = partForSlide(parts, number)
  if (part === null || !parts.has(part)) throw new Error("slide")
  return part
}

function place(
  parts: ReadonlyMap<string, Uint8Array>,
  slide: string,
  shape: string,
  slides: ReadonlyMap<string, string>,
  shapes: ReadonlyMap<string, ReadonlyMap<string, string>>,
): { readonly part: string; readonly shape: string } {
  const part = partForHalf(parts, slide, slides)
  if (!isCreated(shape)) return { part, shape }
  const written = shapes.get(part)?.get(shape)
  if (written === undefined) throw new Error("shape")
  return { part, shape: written }
}

export function exportElements(
  parts: ReadonlyMap<string, Uint8Array>,
  edits: readonly ElementEdit[],
): { readonly parts: ReadonlyMap<string, Uint8Array>; readonly ids: WrittenIds } {
  const held = hold(edits)
  let current: ReadonlyMap<string, Uint8Array> = parts
  for (const edit of edits) {
    if (edit.name !== "sldIdLst.add") continue
    current = fresh(writtenSlide(current, edit.after))
  }
  const slides = new Map<string, string>()
  for (const token of slideTokens(held)) {
    const written = writtenSlide(current, lastSlide(current))
    if (written.id === null) throw new Error("slide")
    slides.set(token, written.id)
    current = fresh(written)
  }
  const grouped = new Map<string, { part: string; token: string; rows: Row[] }>()
  for (const row of held) {
    if (row.edit.name !== "add") continue
    const part = partForHalf(current, row.slide, slides)
    const key = `${part}\0${row.shape}`
    const group = grouped.get(key) ?? { part, token: row.shape, rows: [] }
    group.rows.push({ id: row.edit.id, shape: row.shape, edit: row.edit })
    grouped.set(key, group)
  }
  const shapes = new Map<string, string>()
  const byPart = new Map<string, Map<string, string>>()
  const groups = [...grouped.values()].sort((left, right) => {
    const leftId = left.rows.reduce((best, row) => (row.id < best ? row.id : best), left.rows[0]?.id ?? "")
    const rightId = right.rows.reduce((best, row) => (row.id < best ? row.id : best), right.rows[0]?.id ?? "")
    if (leftId < rightId) return -1
    if (leftId > rightId) return 1
    return 0
  })
  for (const group of groups) {
    let chosen = group.rows[0]
    if (chosen === undefined) throw new Error("shape")
    for (const row of group.rows) if (row.id < chosen.id) chosen = row
    const written = applyRoute(current, {
      name: "add",
      part: group.part,
      text: chosen.edit.text,
      x: chosen.edit.x,
      y: chosen.edit.y,
      cx: chosen.edit.cx,
      cy: chosen.edit.cy,
    })
    if (written.id === null) throw new Error("shape")
    for (const row of group.rows) shapes.set(row.id, written.id)
    const partShapes = byPart.get(group.part) ?? new Map<string, string>()
    partShapes.set(group.token, written.id)
    byPart.set(group.part, partShapes)
    current = fresh(written)
  }
  const pending = held.filter((row) => row.edit.name !== "add")
  pending.sort((left, right) => {
    if (left.edit.id < right.edit.id) return -1
    if (left.edit.id > right.edit.id) return 1
    return 0
  })
  for (const row of pending) {
    const located = place(current, row.slide, row.shape, slides, byPart)
    const edit = row.edit
    if (edit.name === "add") continue
    switch (edit.name) {
      case "text":
        current = fresh(
          applyRoute(current, { name: "text", part: located.part, shape: located.shape, text: edit.text }),
        )
        break
      case "move":
        current = fresh(
          applyRoute(current, { name: "move", part: located.part, shape: located.shape, x: edit.x, y: edit.y }),
        )
        break
      case "resize":
        current = fresh(
          applyRoute(current, { name: "resize", part: located.part, shape: located.shape, cx: edit.cx, cy: edit.cy }),
        )
        break
      case "remove":
        current = fresh(applyRoute(current, { name: "remove", part: located.part, shape: located.shape }))
        break
      default: {
        const unexpected: never = edit
        throw new Error(String(unexpected))
      }
    }
  }
  return { parts: fresh(current), ids: { slides, shapes } }
}
