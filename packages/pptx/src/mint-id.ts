import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8 } from "./package-bytes.js"
import { nextShapeId } from "./shape-id.js"
import { applyRoute } from "./slide-route.js"

const elementId = /^(?:[0-9]{1,10}|n[0-9a-z]{12})\.(?:[0-9]{1,10}|n[0-9a-z]{12})$/
const createdId = /^n[0-9a-z]{12}$/
const presentationPart = "ppt/presentation.xml"
const presentationRels = "ppt/_rels/presentation.xml.rels"
const maxId = 4294967295

export type MintedIds = {
  readonly slides: ReadonlyMap<string, string>
  readonly shapes: ReadonlyMap<string, string>
}

export type MintedEdit =
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

const emptyMint = (): MintedIds => ({ slides: new Map(), shapes: new Map() })

function splitId(id: string): { readonly slide: string; readonly shape: string } {
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

function whole(value: string): number | null {
  if (value.length === 0 || value.length > 10) return null
  let number = 0
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code < 48 || code > 57) return null
    number = number * 10 + (code - 48)
  }
  if (number > maxId) return null
  return number
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

function nextSlideId(parts: ReadonlyMap<string, Uint8Array>): number {
  const presentation = parts.get(presentationPart)
  if (presentation === undefined) throw new Error("slide")
  let max = 0
  for (const element of markupDocument(presentation).elements) {
    if (element.kind !== "p:sldId" || element.id === null) continue
    const value = whole(element.id)
    if (value !== null && value > max) max = value
  }
  if (max === maxId) throw new Error("slide id")
  return max + 1
}

function place(parts: ReadonlyMap<string, Uint8Array>, id: string, minted: MintedIds): { part: string; shape: string } {
  const split = splitId(id)
  const slide = isCreated(split.slide) ? minted.slides.get(split.slide) : split.slide
  if (slide === undefined) throw new Error("slide")
  const part = partForSlide(parts, slide)
  if (part === null) throw new Error("slide")
  if (!parts.has(part)) throw new Error("part")
  const shape = isCreated(split.shape) ? minted.shapes.get(`${split.slide}.${split.shape}`) : split.shape
  if (shape === undefined) throw new Error("shape")
  return { part, shape }
}

function createdSlideNames(parsed: readonly { readonly slide: string }[]): string[] {
  return [...new Set(parsed.map((row) => row.slide).filter(isCreated))].sort()
}

function sameSlideSet(names: readonly string[], slides: ReadonlyMap<string, string>): boolean {
  if (slides.size !== names.length) return false
  for (const name of names) if (!slides.has(name)) return false
  return true
}

function assignSlides(
  parts: ReadonlyMap<string, Uint8Array>,
  parsed: readonly { readonly slide: string }[],
  minted: MintedIds,
): Map<string, string> {
  const names = createdSlideNames(parsed)
  const slides = new Map<string, string>()
  if (names.length === 0) return slides
  if (sameSlideSet(names, minted.slides)) {
    for (const name of names) {
      const number = minted.slides.get(name)
      if (number !== undefined) slides.set(name, number)
    }
    return slides
  }
  let cursor = nextSlideId(parts)
  for (const name of names) {
    if (cursor > maxId) throw new Error("slide id")
    slides.set(name, String(cursor))
    cursor += 1
  }
  return slides
}

function assignShapes(
  parts: ReadonlyMap<string, Uint8Array>,
  parsed: readonly { readonly slide: string; readonly shape: string }[],
  slides: ReadonlyMap<string, string>,
): Map<string, string> {
  const grouped = new Map<string, { readonly slide: string; readonly shape: string }[]>()
  for (const row of parsed) {
    if (!isCreated(row.shape)) continue
    const number = isCreated(row.slide) ? slides.get(row.slide) : row.slide
    if (number === undefined) continue
    const part = partForSlide(parts, number)
    if (part === null || !parts.has(part)) continue
    const list = grouped.get(part) ?? []
    list.push(row)
    grouped.set(part, list)
  }
  const shapes = new Map<string, string>()
  for (const part of [...grouped.keys()].sort()) {
    const rows = grouped.get(part) ?? []
    const bytes = parts.get(part)
    if (bytes === undefined) continue
    const tokens = [...new Set(rows.map((row) => row.shape))].sort()
    let cursor = nextShapeId(decodeUtf8(bytes))
    const numbers = new Map<string, string>()
    for (const token of tokens) {
      if (cursor > maxId) throw new Error("shape id")
      numbers.set(token, String(cursor))
      cursor += 1
    }
    const assigned = new Map<string, string>()
    for (const row of rows) {
      const number = numbers.get(row.shape)
      if (number !== undefined) assigned.set(`${row.slide}.${row.shape}`, number)
    }
    for (const key of [...assigned.keys()].sort()) {
      const number = assigned.get(key)
      if (number !== undefined) shapes.set(key, number)
    }
  }
  return shapes
}

export function mintIds(
  parts: ReadonlyMap<string, Uint8Array>,
  ids: readonly string[],
  minted: MintedIds = emptyMint(),
): MintedIds {
  const parsed = ids.map(splitId)
  const slides = assignSlides(parts, parsed, minted)
  const shapes = assignShapes(parts, parsed, slides)
  return { slides, shapes }
}

export function applyMinted(
  parts: ReadonlyMap<string, Uint8Array>,
  edit: MintedEdit,
  minted: MintedIds,
): ReadonlyMap<string, Uint8Array> {
  const { part, shape } = place(parts, edit.id, minted)
  switch (edit.name) {
    case "text":
      return applyRoute(parts, { name: "text", part, shape, text: edit.text })
    case "move":
      return applyRoute(parts, { name: "move", part, shape, x: edit.x, y: edit.y })
    case "resize":
      return applyRoute(parts, { name: "resize", part, shape, cx: edit.cx, cy: edit.cy })
    case "remove":
      return applyRoute(parts, { name: "remove", part, shape })
    case "add":
      return applyRoute(parts, {
        name: "add",
        part,
        shape,
        text: edit.text,
        x: edit.x,
        y: edit.y,
        cx: edit.cx,
        cy: edit.cy,
      })
    default: {
      const unexpected: never = edit
      throw new Error(String(unexpected))
    }
  }
}
