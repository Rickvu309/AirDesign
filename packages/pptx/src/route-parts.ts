import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8 } from "./package-bytes.js"
import { applyRoute, shapeById, type SlideRoute } from "./slide-route.js"
import { applyStructuralRoute, type StructuralEdit } from "./structural-route.js"
import { writtenRoutes } from "./written-routes.js"

export type PartTouch = {
  readonly changed: readonly string[]
  readonly added: readonly string[]
  readonly removed: readonly string[]
}

export type RouteRun = {
  readonly operation: (typeof routeOperations)[number]
  readonly route: string
  readonly touch: PartTouch | null
  readonly parts: ReadonlyMap<string, Uint8Array> | null
  readonly error: string | null
}

const presentationPart = "ppt/presentation.xml"
const presentationRels = "ppt/_rels/presentation.xml.rels"
const contentTypesPart = "[Content_Types].xml"
const slidePrefix = "ppt/slides/slide"
const slideSuffix = ".xml"
const shapeKinds = new Set(["p:sp", "p:pic", "p:graphicFrame", "p:cxnSp", "p:grpSp"])
const box = { x: 914400, y: 914400, cx: 914400, cy: 914400 }

export const routeOperations = [
  "text",
  "move",
  "resize",
  "spTree.add",
  "spTree.remove",
  "spTree.order",
  "spTree.clone",
  "sldIdLst.add",
  "sldIdLst.remove",
  "sldIdLst.order",
  "sldIdLst.clone",
  "sectionLst.add",
  "sectionLst.remove",
  "sectionLst.order",
  "graphicFrame.addTable",
  "tbl.addRow",
  "tbl.removeRow",
  "tbl.orderRow",
] as const

const routeName: Record<(typeof routeOperations)[number], string> = {
  text: writtenRoutes.text,
  move: writtenRoutes.move,
  resize: writtenRoutes.resize,
  "spTree.add": writtenRoutes.add,
  "spTree.remove": writtenRoutes.remove,
  "spTree.order": writtenRoutes.order,
  "spTree.clone": writtenRoutes.clone,
  "sldIdLst.add": writtenRoutes.addSlide,
  "sldIdLst.remove": writtenRoutes.removeSlide,
  "sldIdLst.order": writtenRoutes.orderSlide,
  "sldIdLst.clone": writtenRoutes.cloneSlide,
  "sectionLst.add": writtenRoutes.addSection,
  "sectionLst.remove": writtenRoutes.removeSection,
  "sectionLst.order": writtenRoutes.orderSection,
  "graphicFrame.addTable": writtenRoutes.addTable,
  "tbl.addRow": writtenRoutes.addRow,
  "tbl.removeRow": writtenRoutes.removeRow,
  "tbl.orderRow": writtenRoutes.orderRow,
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function attribute(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

function digits(value: string): number | null {
  if (value.length === 0) return null
  let number = 0
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code < 48 || code > 57) return null
    number = number * 10 + (code - 48)
    if (!Number.isSafeInteger(number)) return null
  }
  return number
}

function markup(bytes: Uint8Array): readonly MarkupElement[] {
  const document = markupDocument(bytes)
  if (!document.wellFormed) throw new Error("xml")
  return document.elements
}

function presentation(parts: ReadonlyMap<string, Uint8Array>): readonly MarkupElement[] {
  const bytes = parts.get(presentationPart)
  if (bytes === undefined) throw new Error("presentation")
  return markup(bytes)
}

function byId(elements: readonly MarkupElement[], kind: string, id: string): MarkupElement | null {
  return elements.find((element) => element.kind === kind && element.id === id) ?? null
}

function slideFileNumber(name: string): number | null {
  if (!name.startsWith(slidePrefix) || !name.endsWith(slideSuffix)) return null
  return digits(name.slice(slidePrefix.length, name.length - slideSuffix.length))
}

function nextSlideFile(parts: ReadonlyMap<string, Uint8Array>): number {
  let max = 0
  for (const name of parts.keys()) {
    const value = slideFileNumber(name)
    if (value !== null && value > max) max = value
  }
  return max + 1
}

function relsPart(part: string): string {
  const slash = part.lastIndexOf("/")
  return `${part.slice(0, slash)}/_rels/${part.slice(slash + 1)}.rels`
}

function slidePartName(target: string): string {
  if (target.startsWith("/")) return target.slice(1)
  if (target.startsWith("ppt/")) return target
  return `ppt/${target}`
}

function slidePart(parts: ReadonlyMap<string, Uint8Array>, slide: string): string {
  const source = byId(presentation(parts), "p:sldId", slide)
  if (source === null) throw new Error("slide")
  const rid = attribute(source, "r:id")
  const rels = parts.get(presentationRels)
  if (rid === null || rels === undefined) throw new Error("slide")
  const relationship = markup(rels).find(
    (element) => element.kind === "Relationship" && attribute(element, "Id") === rid,
  )
  const target = relationship === undefined ? null : attribute(relationship, "Target")
  if (target === null) throw new Error("slide")
  return slidePartName(target)
}

function slideTouch(part: string): PartTouch {
  return { changed: [part], added: [], removed: [] }
}

function presentationTouch(): PartTouch {
  return { changed: [presentationPart], added: [], removed: [] }
}

function addedSlideTouch(parts: ReadonlyMap<string, Uint8Array>): PartTouch {
  const part = `${slidePrefix}${nextSlideFile(parts)}${slideSuffix}`
  return {
    changed: [presentationPart, presentationRels, contentTypesPart],
    added: [part, relsPart(part)],
    removed: [],
  }
}

function removedSlideTouch(parts: ReadonlyMap<string, Uint8Array>, slide: string): PartTouch {
  const part = slidePart(parts, slide)
  return {
    changed: [presentationPart, presentationRels, contentTypesPart],
    added: [],
    removed: [part, relsPart(part)],
  }
}

export function partTouch(parts: ReadonlyMap<string, Uint8Array>, route: SlideRoute | StructuralEdit): PartTouch {
  switch (route.name) {
    case "text":
    case "move":
    case "resize":
    case "add":
    case "remove":
    case "spTree.add":
    case "spTree.remove":
    case "spTree.order":
    case "spTree.clone":
    case "graphicFrame.addTable":
    case "tbl.addRow":
    case "tbl.removeRow":
    case "tbl.orderRow":
      return slideTouch(route.part)
    case "sldIdLst.order":
    case "sectionLst.add":
    case "sectionLst.remove":
    case "sectionLst.order":
      return presentationTouch()
    case "sldIdLst.add":
    case "sldIdLst.clone":
      return addedSlideTouch(parts)
    case "sldIdLst.remove":
      return removedSlideTouch(parts, route.slide)
  }
}

export function touchMatches(
  before: ReadonlyMap<string, Uint8Array>,
  after: ReadonlyMap<string, Uint8Array>,
  touch: PartTouch,
): boolean {
  const changed = new Set(touch.changed)
  const added = new Set(touch.added)
  const removed = new Set(touch.removed)
  const names = new Set([...before.keys(), ...after.keys()])
  for (const name of names) {
    const left = before.get(name)
    const right = after.get(name)
    if (left === undefined && right !== undefined) {
      if (!added.has(name)) return false
      continue
    }
    if (right === undefined && left !== undefined) {
      if (!removed.has(name)) return false
      continue
    }
    if (left !== undefined && right !== undefined && !sameBytes(left, right) && !changed.has(name)) return false
  }
  for (const name of changed) {
    const left = before.get(name)
    const right = after.get(name)
    if (left === undefined || right === undefined || sameBytes(left, right)) return false
  }
  for (const name of added) if (before.has(name) || !after.has(name)) return false
  for (const name of removed) if (!before.has(name) || after.has(name)) return false
  return true
}

function owned(elements: readonly MarkupElement[], shape: MarkupElement, kind: string): MarkupElement[] {
  const found = []
  for (const element of elements) {
    if (element.kind !== kind) continue
    let parent = element.parent
    let nearest: MarkupElement | null = null
    while (parent >= 0) {
      const ancestor = elements[parent]
      if (ancestor === undefined) break
      if (shapeKinds.has(ancestor.kind)) {
        nearest = ancestor
        break
      }
      parent = ancestor.parent
    }
    if (nearest !== null && nearest.index === shape.index) found.push(element)
  }
  return found
}

function topShapes(bytes: Uint8Array): { id: string; shape: MarkupElement; elements: readonly MarkupElement[] }[] {
  const elements = markup(bytes)
  const shapes = []
  const seen = new Set<number>()
  for (const mark of elements) {
    if (mark.kind !== "p:cNvPr" || mark.id === null) continue
    let shape: MarkupElement
    try {
      shape = shapeById(elements, mark.id)
    } catch {
      continue
    }
    if (seen.has(shape.index)) continue
    const parent = elements[shape.parent]
    if (parent === undefined || parent.kind !== "p:spTree") continue
    seen.add(shape.index)
    shapes.push({ id: mark.id, shape, elements })
  }
  shapes.sort((left, right) => left.shape.start - right.shape.start)
  return shapes
}

function slideNames(parts: ReadonlyMap<string, Uint8Array>): string[] {
  return [...parts.keys()].filter((name) => slideFileNumber(name) !== null).sort()
}

function plainText(bytes: Uint8Array, element: MarkupElement): string | null {
  if (element.selfClosing || element.closeStart < element.openEnd) return null
  let text: string
  try {
    text = decodeUtf8(bytes.subarray(element.openEnd, element.closeStart))
  } catch {
    return null
  }
  if (text.length === 0) return null
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code !== 9 && code !== 10 && code !== 13 && (code < 32 || code > 126)) return null
  }
  return text
}

function textHost(parts: ReadonlyMap<string, Uint8Array>): { part: string; id: string; text: string } | null {
  for (const name of slideNames(parts)) {
    const bytes = parts.get(name)
    if (bytes === undefined) continue
    for (const item of topShapes(bytes)) {
      if (item.shape.kind !== "p:sp") continue
      const runs = owned(item.elements, item.shape, "a:r")
      const texts = owned(item.elements, item.shape, "a:t")
      if (texts.length !== 1 || runs.length > 1) continue
      if (owned(item.elements, item.shape, "a:br").length > 0 || owned(item.elements, item.shape, "a:fld").length > 0) {
        continue
      }
      const text = texts[0] === undefined ? null : plainText(bytes, texts[0])
      if (text === null) continue
      return { part: name, id: item.id, text }
    }
  }
  return null
}

function integerAttr(element: MarkupElement, name: string): number | null {
  const value = attribute(element, name)
  if (value === null || !/^-?\d+$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : null
}

function xfrmHost(
  parts: ReadonlyMap<string, Uint8Array>,
  kind: "a:off" | "a:ext",
): { part: string; id: string; x: number; y: number; cx: number; cy: number } | null {
  for (const name of slideNames(parts)) {
    const bytes = parts.get(name)
    if (bytes === undefined) continue
    for (const item of topShapes(bytes)) {
      for (const element of owned(item.elements, item.shape, kind)) {
        if (kind === "a:off") {
          const x = integerAttr(element, "x")
          const y = integerAttr(element, "y")
          if (x === null || y === null) continue
          return { part: name, id: item.id, x, y, cx: 0, cy: 0 }
        }
        const cx = integerAttr(element, "cx")
        const cy = integerAttr(element, "cy")
        if (cx === null || cy === null || cx < 2 || cy < 2) continue
        return { part: name, id: item.id, x: 0, y: 0, cx, cy }
      }
    }
  }
  return null
}

function shapePair(parts: ReadonlyMap<string, Uint8Array>): { part: string; first: string; second: string } | null {
  for (const name of slideNames(parts)) {
    const bytes = parts.get(name)
    if (bytes === undefined) continue
    const shapes = topShapes(bytes)
    const first = shapes[0]
    const second = shapes[1]
    if (first !== undefined && second !== undefined) return { part: name, first: first.id, second: second.id }
  }
  return null
}

function oneShape(parts: ReadonlyMap<string, Uint8Array>): { part: string; id: string } | null {
  for (const name of slideNames(parts)) {
    const bytes = parts.get(name)
    if (bytes === undefined) continue
    const first = topShapes(bytes)[0]
    if (first !== undefined) return { part: name, id: first.id }
  }
  return null
}

function sldIds(parts: ReadonlyMap<string, Uint8Array>): MarkupElement[] {
  return presentation(parts)
    .filter((element) => element.kind === "p:sldId" && element.id !== null)
    .sort((left, right) => left.start - right.start)
}

function sectionIds(parts: ReadonlyMap<string, Uint8Array>): MarkupElement[] {
  return presentation(parts)
    .filter((element) => (element.kind === "p:section" || element.kind === "p14:section") && element.id !== null)
    .sort((left, right) => left.start - right.start)
}

function rowBytes(bytes: Uint8Array): Uint8Array[] {
  return markup(bytes)
    .filter((element) => element.kind === "a:tr")
    .map((element) => bytes.slice(element.start, element.end))
}

function tableHost(
  parts: ReadonlyMap<string, Uint8Array>,
): { part: string; rows: number; swap: { row: number; before: number } | null } | null {
  for (const name of slideNames(parts)) {
    const bytes = parts.get(name)
    if (bytes === undefined) continue
    const rows = rowBytes(bytes)
    if (rows.length === 0) continue
    let swap: { row: number; before: number } | null = null
    for (let index = 0; index < rows.length - 1; index += 1) {
      const left = rows[index]
      const right = rows[index + 1]
      if (left !== undefined && right !== undefined && !sameBytes(left, right)) {
        swap = { row: index + 2, before: index + 1 }
        break
      }
    }
    return { part: name, rows: rows.length, swap }
  }
  return null
}

function hasOwned(
  elements: readonly MarkupElement[],
  shape: MarkupElement,
  kind: string,
  names: readonly string[],
): boolean {
  return owned(elements, shape, kind).some((element) =>
    names.every((name) => element.attributes.some((item) => item.name === name)),
  )
}

function inheritedHost(
  parts: ReadonlyMap<string, Uint8Array>,
  kind: "a:off" | "a:ext",
): { part: string; id: string } | null {
  const names = kind === "a:off" ? ["x", "y"] : ["cx", "cy"]
  for (const name of slideNames(parts)) {
    const bytes = parts.get(name)
    if (bytes === undefined) continue
    for (const item of topShapes(bytes)) {
      if (owned(item.elements, item.shape, "p:ph").length === 0) continue
      if (hasOwned(item.elements, item.shape, kind, names)) continue
      return { part: name, id: item.id }
    }
  }
  return null
}

function groupHost(parts: ReadonlyMap<string, Uint8Array>): { part: string; id: string } | null {
  for (const name of slideNames(parts)) {
    const bytes = parts.get(name)
    if (bytes === undefined) continue
    for (const item of topShapes(bytes)) {
      if (item.shape.kind === "p:grpSp") return { part: name, id: item.id }
    }
  }
  return null
}

function attempt(
  operation: (typeof routeOperations)[number],
  build: () => { readonly touch: PartTouch; readonly parts: ReadonlyMap<string, Uint8Array> },
): RouteRun {
  try {
    const built = build()
    return { operation, route: routeName[operation], touch: built.touch, parts: built.parts, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { operation, route: routeName[operation], touch: null, parts: null, error: message }
  }
}

export function routeRuns(parts: ReadonlyMap<string, Uint8Array>): readonly RouteRun[] {
  const runs: RouteRun[] = []
  const text = textHost(parts)
  if (text !== null) {
    const route = {
      name: "text",
      part: text.part,
      shape: text.id,
      text: text.text === "AirDesignProbe" ? "AirDesignProbe2" : "AirDesignProbe",
    } as const
    runs.push(attempt("text", () => ({ touch: partTouch(parts, route), parts: applyRoute(parts, route) })))
  }
  const inheritedMove = inheritedHost(parts, "a:off")
  if (inheritedMove !== null) {
    const route = { name: "move", part: inheritedMove.part, shape: inheritedMove.id, x: box.x, y: box.y } as const
    runs.push(attempt("move", () => ({ touch: partTouch(parts, route), parts: applyRoute(parts, route) })))
  } else {
    const move = xfrmHost(parts, "a:off")
    if (move !== null) {
      const route = { name: "move", part: move.part, shape: move.id, x: move.x + 9525, y: move.y + 9525 } as const
      runs.push(attempt("move", () => ({ touch: partTouch(parts, route), parts: applyRoute(parts, route) })))
    }
  }
  const inheritedResize = inheritedHost(parts, "a:ext")
  if (inheritedResize !== null) {
    const route = {
      name: "resize",
      part: inheritedResize.part,
      shape: inheritedResize.id,
      cx: box.cx,
      cy: box.cy,
    } as const
    runs.push(attempt("resize", () => ({ touch: partTouch(parts, route), parts: applyRoute(parts, route) })))
  } else {
    const resize = xfrmHost(parts, "a:ext")
    if (resize !== null) {
      const route = {
        name: "resize",
        part: resize.part,
        shape: resize.id,
        cx: resize.cx + 9525,
        cy: resize.cy + 9525,
      } as const
      runs.push(attempt("resize", () => ({ touch: partTouch(parts, route), parts: applyRoute(parts, route) })))
    }
  }
  const slide = slideNames(parts)[0]
  if (slide !== undefined) {
    const route = { name: "spTree.add", part: slide, text: "Added", ...box } as const
    runs.push(
      attempt("spTree.add", () => ({ touch: partTouch(parts, route), parts: applyStructuralRoute(parts, route) })),
    )
    const table = { name: "graphicFrame.addTable", part: slide } as const
    runs.push(
      attempt("graphicFrame.addTable", () => ({
        touch: partTouch(parts, table),
        parts: applyStructuralRoute(parts, table),
      })),
    )
  }
  const pair = shapePair(parts)
  if (pair !== null) {
    const route = { name: "spTree.order", part: pair.part, shape: pair.second, before: pair.first } as const
    runs.push(
      attempt("spTree.order", () => ({ touch: partTouch(parts, route), parts: applyStructuralRoute(parts, route) })),
    )
  }
  const shape = oneShape(parts)
  if (shape !== null) {
    const removed = { name: "spTree.remove", part: shape.part, shape: shape.id } as const
    runs.push(
      attempt("spTree.remove", () => ({
        touch: partTouch(parts, removed),
        parts: applyStructuralRoute(parts, removed),
      })),
    )
  }
  const clonedShape = groupHost(parts) ?? shape
  if (clonedShape !== null) {
    const cloned = { name: "spTree.clone", part: clonedShape.part, shape: clonedShape.id } as const
    runs.push(
      attempt("spTree.clone", () => ({ touch: partTouch(parts, cloned), parts: applyStructuralRoute(parts, cloned) })),
    )
  }
  const slides = sldIds(parts)
  const firstSlide = slides[0]
  const secondSlide = slides[1]
  if (firstSlide?.id !== null && firstSlide?.id !== undefined) {
    const added = { name: "sldIdLst.add", after: firstSlide.id } as const
    runs.push(
      attempt("sldIdLst.add", () => ({ touch: partTouch(parts, added), parts: applyStructuralRoute(parts, added) })),
    )
    const cloned = { name: "sldIdLst.clone", slide: firstSlide.id } as const
    runs.push(
      attempt("sldIdLst.clone", () => ({
        touch: partTouch(parts, cloned),
        parts: applyStructuralRoute(parts, cloned),
      })),
    )
  }
  if (
    secondSlide?.id !== null &&
    secondSlide?.id !== undefined &&
    firstSlide?.id !== null &&
    firstSlide?.id !== undefined
  ) {
    const removed = { name: "sldIdLst.remove", slide: secondSlide.id } as const
    runs.push(
      attempt("sldIdLst.remove", () => ({
        touch: partTouch(parts, removed),
        parts: applyStructuralRoute(parts, removed),
      })),
    )
    const ordered = { name: "sldIdLst.order", slide: secondSlide.id, before: firstSlide.id } as const
    runs.push(
      attempt("sldIdLst.order", () => ({
        touch: partTouch(parts, ordered),
        parts: applyStructuralRoute(parts, ordered),
      })),
    )
  }
  const sections = sectionIds(parts)
  const addedSection = { name: "sectionLst.add", title: "AirDesign" } as const
  runs.push(
    attempt("sectionLst.add", () => ({
      touch: partTouch(parts, addedSection),
      parts: applyStructuralRoute(parts, addedSection),
    })),
  )
  const firstSection = sections[0]
  const secondSection = sections[1]
  if (firstSection?.id !== null && firstSection?.id !== undefined) {
    const removed = { name: "sectionLst.remove", section: firstSection.id } as const
    runs.push(
      attempt("sectionLst.remove", () => ({
        touch: partTouch(parts, removed),
        parts: applyStructuralRoute(parts, removed),
      })),
    )
  }
  if (
    firstSection?.id !== null &&
    firstSection?.id !== undefined &&
    secondSection?.id !== null &&
    secondSection?.id !== undefined
  ) {
    const ordered = { name: "sectionLst.order", section: secondSection.id, before: firstSection.id } as const
    runs.push(
      attempt("sectionLst.order", () => ({
        touch: partTouch(parts, ordered),
        parts: applyStructuralRoute(parts, ordered),
      })),
    )
  }
  const table = tableHost(parts)
  if (table !== null) {
    const added = { name: "tbl.addRow", part: table.part, row: 1 } as const
    runs.push(
      attempt("tbl.addRow", () => ({ touch: partTouch(parts, added), parts: applyStructuralRoute(parts, added) })),
    )
    const removed = { name: "tbl.removeRow", part: table.part, row: table.rows } as const
    runs.push(
      attempt("tbl.removeRow", () => ({
        touch: partTouch(parts, removed),
        parts: applyStructuralRoute(parts, removed),
      })),
    )
    if (table.swap !== null) {
      const ordered = {
        name: "tbl.orderRow",
        part: table.part,
        row: table.swap.row,
        before: table.swap.before,
      } as const
      runs.push(
        attempt("tbl.orderRow", () => ({
          touch: partTouch(parts, ordered),
          parts: applyStructuralRoute(parts, ordered),
        })),
      )
    }
  }
  return runs
}
