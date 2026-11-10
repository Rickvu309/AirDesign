import { markupDocument, type MarkupElement } from "./element-span.js"
import { oneRunValue, writeRoute, type SlideRoute } from "./slide-route.js"
import { writeStructuralRoute } from "./structural-route.js"

const elementId = /^(?:[0-9]{1,10}|n[0-9a-z]{12})\.(?:[0-9]{1,10}|n[0-9a-z]{12})$/
const slideId = /^(?:[0-9]{1,10}|n[0-9a-z]{12})$/
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
  | { readonly name: "sldIdLst.add"; readonly slide: string; readonly after: string }

export type WrittenIds = {
  readonly slides: ReadonlyMap<string, string>
  readonly shapes: ReadonlyMap<string, string>
}

export type IdRole = "createdSlide" | "createdElement" | "slide" | "element"

type IdField<Edit> = {
  [Field in keyof Edit]-?: Field extends "name" | "text" ? never : Edit[Field] extends number ? never : Field
}[keyof Edit]

type IdFields = {
  readonly [Edit in ElementEdit as Edit["name"]]: { readonly [Field in IdField<Edit>]: IdRole }
}

export const idFields = {
  text: { id: "element" },
  move: { id: "element" },
  resize: { id: "element" },
  remove: { id: "element" },
  add: { id: "createdElement" },
  "sldIdLst.add": { slide: "createdSlide", after: "slide" },
} as const satisfies IdFields

type IdEntry = { readonly field: string; readonly role: IdRole; readonly value: string }

type Slide =
  | { readonly kind: "original"; readonly number: string; readonly part: string }
  | { readonly kind: "created"; readonly token: string }

type Shape = { readonly kind: "original"; readonly number: string } | { readonly kind: "created"; readonly key: string }

type Element = { readonly kind: "element"; readonly id: string; readonly slide: Slide; readonly shape: Shape }

type Answer = Slide | Element

type Known = {
  readonly original: ReadonlyMap<string, Uint8Array>
  readonly slideParts: Map<string, string | null>
  readonly partShapes: Map<string, ReadonlySet<string>>
  readonly createdSlides: Set<string>
  readonly createdShapes: Set<string>
}

type Row = {
  readonly edit: ElementEdit
  readonly entries: readonly IdEntry[]
  readonly answers: Map<string, Answer>
}

type CreatedSlide = { readonly token: string; readonly after: Slide }

type CreatedShape = {
  readonly element: Element
  readonly text: string
  readonly x: number
  readonly y: number
  readonly cx: number
  readonly cy: number
}

type Change =
  | { readonly name: "text"; readonly text: string }
  | { readonly name: "move"; readonly x: number; readonly y: number }
  | { readonly name: "resize"; readonly cx: number; readonly cy: number }
  | { readonly name: "remove" }

type Plan = {
  readonly slides: readonly CreatedSlide[]
  readonly shapes: readonly CreatedShape[]
  readonly changes: readonly { readonly element: Element; readonly change: Change }[]
}

function isCreated(value: string): boolean {
  return createdId.test(value)
}

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

function originalPart(known: Known, slide: string): string {
  let part = known.slideParts.get(slide)
  if (part === undefined) {
    part = partForSlide(known.original, slide)
    known.slideParts.set(slide, part)
  }
  if (part === null || !known.original.has(part)) throw new Error("slide")
  return part
}

function originalShapes(known: Known, part: string): ReadonlySet<string> {
  const held = known.partShapes.get(part)
  if (held !== undefined) return held
  const ids = new Set<string>()
  const bytes = known.original.get(part)
  if (bytes === undefined) throw new Error("slide")
  for (const element of markupDocument(bytes).elements) {
    if (element.kind === "p:cNvPr" && element.id !== null) ids.add(element.id)
  }
  known.partShapes.set(part, ids)
  return ids
}

function createdKey(slide: Slide, token: string): string {
  return `${slide.kind === "created" ? slide.token : slide.part}\0${token}`
}

function resolveSlide(known: Known, value: string): Slide {
  if (!slideId.test(value)) throw new Error("element id")
  if (isCreated(value)) {
    if (!known.createdSlides.has(value)) throw new Error("slide")
    return { kind: "created", token: value }
  }
  return { kind: "original", number: value, part: originalPart(known, value) }
}

function resolveElement(known: Known, value: string): Element {
  const split = splitId(value)
  const slide = resolveSlide(known, split.slide)
  if (isCreated(split.shape)) {
    const key = createdKey(slide, split.shape)
    if (!known.createdShapes.has(key)) throw new Error("shape")
    return { kind: "element", id: value, slide, shape: { kind: "created", key } }
  }
  if (slide.kind === "created" || !originalShapes(known, slide.part).has(split.shape)) throw new Error("shape")
  return { kind: "element", id: value, slide, shape: { kind: "original", number: split.shape } }
}

function createSlide(known: Known, value: string): Slide {
  if (!isCreated(value) || known.createdSlides.has(value)) throw new Error("slide")
  known.createdSlides.add(value)
  return { kind: "created", token: value }
}

function createElement(known: Known, value: string): Element {
  const split = splitId(value)
  const slide = resolveSlide(known, split.slide)
  if (!isCreated(split.shape)) throw new Error("shape")
  const key = createdKey(slide, split.shape)
  if (known.createdShapes.has(key)) throw new Error("shape")
  known.createdShapes.add(key)
  return { kind: "element", id: value, slide, shape: { kind: "created", key } }
}

const resolvers: Readonly<Record<IdRole, (known: Known, value: string) => Answer>> = {
  createdSlide: createSlide,
  createdElement: createElement,
  slide: resolveSlide,
  element: resolveElement,
}

function idEntries(edit: ElementEdit): readonly IdEntry[] {
  const roles: Readonly<Record<string, IdRole | undefined>> | undefined = idFields[edit.name]
  if (roles === undefined) throw new Error("edit")
  const entries: IdEntry[] = []
  for (const [field, value] of Object.entries(edit)) {
    if (field === "name" || field === "text" || typeof value === "number") continue
    const role = roles[field]
    if (role === undefined || typeof value !== "string") throw new Error("edit")
    entries.push({ field, role, value })
  }
  if (entries.length !== Object.keys(roles).length) throw new Error("edit")
  return entries
}

function resolveRows(parts: ReadonlyMap<string, Uint8Array>, edits: readonly ElementEdit[]): readonly Row[] {
  const known: Known = {
    original: parts,
    slideParts: new Map(),
    partShapes: new Map(),
    createdSlides: new Set(),
    createdShapes: new Set(),
  }
  const rows = edits.map((edit) => ({ edit, entries: idEntries(edit), answers: new Map<string, Answer>() }))
  for (const [role, resolve] of Object.entries(resolvers)) {
    for (const row of rows) {
      for (const entry of row.entries) {
        if (entry.role === role) row.answers.set(entry.field, resolve(known, entry.value))
      }
    }
  }
  return rows
}

function answeredSlide(row: Row, field: string): Slide {
  const answer = row.answers.get(field)
  if (answer === undefined || answer.kind === "element") throw new Error("slide")
  return answer
}

function answeredElement(row: Row, field: string): Element {
  const answer = row.answers.get(field)
  if (answer === undefined || answer.kind !== "element") throw new Error("shape")
  return answer
}

function byText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function slideWriteOrder(slides: readonly CreatedSlide[]): readonly CreatedSlide[] {
  const byToken = new Map(slides.map((slide) => [slide.token, slide]))
  const written = new Set<string>()
  const ordered: CreatedSlide[] = []
  for (const start of [...slides].sort((left, right) => byText(left.token, right.token))) {
    const chain: CreatedSlide[] = []
    const onChain = new Set<string>()
    let step: CreatedSlide | undefined = start
    while (step !== undefined && !written.has(step.token)) {
      if (onChain.has(step.token)) throw new Error("slide")
      onChain.add(step.token)
      chain.push(step)
      step = step.after.kind === "created" ? byToken.get(step.after.token) : undefined
    }
    for (const row of chain.reverse()) {
      written.add(row.token)
      ordered.push(row)
    }
  }
  return ordered
}

function planEdits(parts: ReadonlyMap<string, Uint8Array>, edits: readonly ElementEdit[]): Plan {
  const slides: CreatedSlide[] = []
  const shapes: CreatedShape[] = []
  const changes: { readonly element: Element; readonly change: Change }[] = []
  for (const row of resolveRows(parts, edits)) {
    const edit = row.edit
    switch (edit.name) {
      case "sldIdLst.add": {
        const slide = answeredSlide(row, "slide")
        if (slide.kind !== "created") throw new Error("slide")
        slides.push({ token: slide.token, after: answeredSlide(row, "after") })
        break
      }
      case "add":
        shapes.push({
          element: answeredElement(row, "id"),
          text: edit.text,
          x: edit.x,
          y: edit.y,
          cx: edit.cx,
          cy: edit.cy,
        })
        break
      case "text":
        changes.push({ element: answeredElement(row, "id"), change: { name: "text", text: edit.text } })
        break
      case "move":
        changes.push({ element: answeredElement(row, "id"), change: { name: "move", x: edit.x, y: edit.y } })
        break
      case "resize":
        changes.push({ element: answeredElement(row, "id"), change: { name: "resize", cx: edit.cx, cy: edit.cy } })
        break
      case "remove":
        changes.push({ element: answeredElement(row, "id"), change: { name: "remove" } })
        break
      default: {
        const unexpected: never = edit
        throw new Error(String(unexpected))
      }
    }
  }
  return {
    slides: slideWriteOrder(slides),
    shapes: shapes.sort((left, right) => byText(left.element.id, right.element.id)),
    changes,
  }
}

function slideNumber(slide: Slide, written: ReadonlyMap<string, string>): string {
  if (slide.kind === "original") return slide.number
  const number = written.get(slide.token)
  if (number === undefined) throw new Error("slide")
  return number
}

function partOf(slide: Slide, current: ReadonlyMap<string, Uint8Array>, written: ReadonlyMap<string, string>): string {
  if (slide.kind === "original") return slide.part
  const part = partForSlide(current, slideNumber(slide, written))
  if (part === null) throw new Error("slide")
  return part
}

function shapeNumber(shape: Shape, written: ReadonlyMap<string, string>): string {
  if (shape.kind === "original") return shape.number
  const number = written.get(shape.key)
  if (number === undefined) throw new Error("shape")
  return number
}

function changeRoute(
  current: ReadonlyMap<string, Uint8Array>,
  change: Change,
  part: string,
  shape: string,
): Exclude<SlideRoute, { readonly name: "add" }> {
  if (change.name === "text")
    return { name: "text", part, shape, value: oneRunValue(current, part, shape, change.text) }
  return { ...change, part, shape }
}

export function exportElements(
  parts: ReadonlyMap<string, Uint8Array>,
  edits: readonly ElementEdit[],
): { readonly parts: ReadonlyMap<string, Uint8Array>; readonly ids: WrittenIds } {
  const plan = planEdits(parts, edits)
  let current = parts
  const slides = new Map<string, string>()
  const shapes = new Map<string, string>()
  const shapeNumbers = new Map<string, string>()
  for (const row of plan.slides) {
    const written = writeStructuralRoute(current, { name: "sldIdLst.add", after: slideNumber(row.after, slides) })
    if (written.id === null) throw new Error("slide")
    slides.set(row.token, written.id)
    current = written.parts
  }
  for (const row of plan.shapes) {
    const written = writeRoute(current, {
      name: "add",
      part: partOf(row.element.slide, current, slides),
      text: row.text,
      x: row.x,
      y: row.y,
      cx: row.cx,
      cy: row.cy,
    })
    if (written.id === null || row.element.shape.kind !== "created") throw new Error("shape")
    shapes.set(row.element.id, written.id)
    shapeNumbers.set(row.element.shape.key, written.id)
    current = written.parts
  }
  for (const row of plan.changes) {
    const part = partOf(row.element.slide, current, slides)
    const shape = shapeNumber(row.element.shape, shapeNumbers)
    current = writeRoute(current, changeRoute(current, row.change, part, shape)).parts
  }
  return { parts: new Map(current), ids: { slides, shapes } }
}
