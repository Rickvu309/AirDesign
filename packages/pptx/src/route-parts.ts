import { owns, shapeById } from "./shape-tree.js"
import { elementId, type TextValue } from "@airdesign/document"
import { sameBytes } from "./package-bytes.js"
import { exportElements } from "./element-export.js"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { contentTypesPart, presentationPart, presentationRels, relsOf, slidePart } from "./package-address.js"
import { shapeAnimated } from "./shape-id.js"
import { applyRoute, type SlideRoute } from "./slide-route.js"
import { nextSlideFile, slideFileNumber } from "./slide-list-route.js"
import { addedSlideTouch, clonedSlideTouch, removedSlideTouch, type PartTouch } from "./slide-touch.js"
import { applyStructuralRoute, type StructuralEdit } from "./structural-route.js"
import { markupChildren, shapeTextValue } from "./text-value-route.js"
import { createdShapesLanded } from "./created-shapes.js"

export { createdShapesLanded } from "./created-shapes.js"
import { routeName, routeOperations } from "./route-operations.js"
import { notesRuns } from "./notes-runs.js"
import { probedValue } from "./text-probe.js"
import { formatRuns } from "./text-format-runs.js"
import { writeTrait } from "./trait-xml.js"
import { tableEdits } from "./route-table-host.js"
export { routeOperations } from "./route-operations.js"

export type RouteRun = {
  readonly operation: (typeof routeOperations)[number]
  readonly route: string
  readonly edit: SlideRoute | StructuralEdit | null
  readonly touch: PartTouch | null
  readonly parts: ReadonlyMap<string, Uint8Array> | null
  readonly error: string | null
}

const slidePrefix = "ppt/slides/slide"
const slideSuffix = ".xml"
const box = { x: 914400, y: 914400, cx: 914400, cy: 914400 }

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

function slideFile(parts: ReadonlyMap<string, Uint8Array>, slide: string): string {
  presentation(parts)
  const rels = parts.get(presentationRels)
  if (rels === undefined) throw new Error("slide")
  markup(rels)
  const part = slidePart(parts, slide)
  if (part === null) throw new Error("slide")
  return part
}

function slideTouch(part: string): PartTouch {
  return { changed: [part], added: [], removed: [] }
}

function presentationTouch(): PartTouch {
  return { changed: [presentationPart], added: [], removed: [] }
}

const createdSlideFirst = "n000000000000"
const createdSlideA = "n000000000001"
const createdSlideB = "n000000000002"
const createdShapeA = "n000000000003"
const createdShapeB = "n000000000004"
const createdTextA = "AirDesignCreatedA"
const createdTextB = "AirDesignCreatedB"

export function elementExportTouch(parts: ReadonlyMap<string, Uint8Array>): PartTouch {
  const first = nextSlideFile(parts)
  const added: string[] = []
  for (let step = 0; step < 3; step += 1) {
    const part = `${slidePrefix}${first + step}${slideSuffix}`
    added.push(part, relsOf(part))
  }
  return {
    changed: [presentationPart, presentationRels, contentTypesPart],
    added,
    removed: [],
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
    case "tbl.addColumn":
    case "tbl.removeColumn":
      return slideTouch(route.part)
    case "sldIdLst.order":
    case "sectionLst.add":
    case "sectionLst.remove":
    case "sectionLst.order":
      return presentationTouch()
    case "sldIdLst.add":
      return addedSlideTouch(parts)
    case "sldIdLst.clone":
      return clonedSlideTouch(parts, slideFile(parts, route.slide))
    case "sldIdLst.remove":
      return removedSlideTouch(parts, slideFile(parts, route.slide))
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
    if (owns(elements, element.index, shape)) found.push(element)
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

function textHost(parts: ReadonlyMap<string, Uint8Array>): { part: string; id: string; value: TextValue } | null {
  let oneRun: { part: string; id: string; value: TextValue } | null = null
  for (const name of slideNames(parts)) {
    const bytes = parts.get(name)
    if (bytes === undefined) continue
    const shapes = topShapes(bytes)
    const children = markupChildren(shapes[0]?.elements ?? [])
    for (const item of shapes) {
      if (item.shape.kind !== "p:sp") continue
      if (owned(item.elements, item.shape, "a:br").length > 0 || owned(item.elements, item.shape, "a:fld").length > 0) {
        continue
      }
      const value = shapeTextValue(children, bytes, item.shape)
      const several = probedValue(value, 2)
      if (several !== null) return { part: name, id: item.id, value: several }
      const single: TextValue | null = oneRun === null ? probedValue(value, 1) : null
      if (single !== null) oneRun = { part: name, id: item.id, value: single }
    }
  }
  return oneRun
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
    const free = topShapes(bytes).find((item) => !shapeAnimated(item.elements, item.shape))
    if (free !== undefined) return { part: name, id: free.id }
  }
  return null
}

function highestSlide(parts: ReadonlyMap<string, Uint8Array>): number {
  let max = 0
  for (const element of sldIds(parts)) {
    if (element.id === null) continue
    const value = digits(element.id)
    if (value !== null && value > max) max = value
  }
  return max
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
  edit: SlideRoute | StructuralEdit | null,
  build: () => { readonly touch: PartTouch; readonly parts: ReadonlyMap<string, Uint8Array> },
): RouteRun {
  try {
    const built = build()
    return { operation, route: routeName[operation], edit, touch: built.touch, parts: built.parts, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { operation, route: routeName[operation], edit, touch: null, parts: null, error: message }
  }
}

export function routeRuns(parts: ReadonlyMap<string, Uint8Array>): readonly RouteRun[] {
  const runs = notesRuns(parts)
  for (const part of slideNames(parts)) {
    const bytes = parts.get(part)
    if (bytes === undefined) continue
    const host = topShapes(bytes).find((item) => {
      if (item.shape.kind !== "p:sp") return false
      const spPr = item.elements.find((mark) => mark.parent === item.shape.index && mark.kind === "p:spPr")
      return (
        spPr !== undefined && !item.elements.some((mark) => mark.parent === spPr.index && mark.kind === "a:blipFill")
      )
    })
    if (host === undefined) continue
    const fill = { value: { set: { solid: { rgb: "19A7E8" } } } } as const
    const at = { slide: "", part, shape: host.id }
    runs.push(
      attempt("spPr.fill", null, () => ({ touch: slideTouch(part), parts: writeTrait(parts, at, "fill", fill) })),
    )
    break
  }
  const text = textHost(parts)
  if (text !== null) {
    const route = {
      name: "text",
      part: text.part,
      shape: text.id,
      value: text.value,
    } as const
    runs.push(attempt("text", route, () => ({ touch: partTouch(parts, route), parts: applyRoute(parts, route) })))
  }
  runs.push(
    ...formatRuns(parts, (step, route) =>
      attempt(step, route, () => ({ touch: partTouch(parts, route), parts: applyRoute(parts, route) })),
    ),
  )
  const inheritedMove = inheritedHost(parts, "a:off")
  if (inheritedMove !== null) {
    const route = { name: "move", part: inheritedMove.part, shape: inheritedMove.id, x: box.x, y: box.y } as const
    runs.push(attempt("move", route, () => ({ touch: partTouch(parts, route), parts: applyRoute(parts, route) })))
  } else {
    const move = xfrmHost(parts, "a:off")
    if (move !== null) {
      const route = { name: "move", part: move.part, shape: move.id, x: move.x + 9525, y: move.y + 9525 } as const
      runs.push(attempt("move", route, () => ({ touch: partTouch(parts, route), parts: applyRoute(parts, route) })))
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
    runs.push(attempt("resize", route, () => ({ touch: partTouch(parts, route), parts: applyRoute(parts, route) })))
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
      runs.push(attempt("resize", route, () => ({ touch: partTouch(parts, route), parts: applyRoute(parts, route) })))
    }
  }
  const slide = slideNames(parts)[0]
  if (slide !== undefined) {
    const route = { name: "spTree.add", part: slide, text: "Added", ...box } as const
    runs.push(
      attempt("spTree.add", route, () => ({
        touch: partTouch(parts, route),
        parts: applyStructuralRoute(parts, route),
      })),
    )
    const table = { name: "graphicFrame.addTable", part: slide, ...box, rows: 3, columns: 3 } as const
    runs.push(
      attempt("graphicFrame.addTable", table, () => ({
        touch: partTouch(parts, table),
        parts: applyStructuralRoute(parts, table),
      })),
    )
  }
  const pair = shapePair(parts)
  if (pair !== null) {
    const route = { name: "spTree.order", part: pair.part, shape: pair.second, before: pair.first } as const
    runs.push(
      attempt("spTree.order", route, () => ({
        touch: partTouch(parts, route),
        parts: applyStructuralRoute(parts, route),
      })),
    )
  }
  const shape = oneShape(parts)
  if (shape !== null) {
    const removed = { name: "spTree.remove", part: shape.part, shape: shape.id } as const
    runs.push(
      attempt("spTree.remove", removed, () => ({
        touch: partTouch(parts, removed),
        parts: applyStructuralRoute(parts, removed),
      })),
    )
  }
  const clonedShape = groupHost(parts) ?? shape
  if (clonedShape !== null) {
    const cloned = { name: "spTree.clone", part: clonedShape.part, shape: clonedShape.id } as const
    runs.push(
      attempt("spTree.clone", cloned, () => ({
        touch: partTouch(parts, cloned),
        parts: applyStructuralRoute(parts, cloned),
      })),
    )
  }
  const slides = sldIds(parts)
  const firstSlide = slides[0]
  const secondSlide = slides[1]
  if (firstSlide?.id !== null && firstSlide?.id !== undefined) {
    const added = { name: "sldIdLst.add", after: firstSlide.id } as const
    runs.push(
      attempt("sldIdLst.add", added, () => ({
        touch: partTouch(parts, added),
        parts: applyStructuralRoute(parts, added),
      })),
    )
    const origin = highestSlide(parts)
    runs.push(
      attempt("element.export", null, () => {
        const touch = elementExportTouch(parts)
        const written = exportElements(parts, [
          { name: "sldIdLst.add", slide: createdSlideFirst, after: added.after },
          { name: "sldIdLst.add", slide: createdSlideA, after: added.after },
          { name: "sldIdLst.add", slide: createdSlideB, after: added.after },
          {
            id: elementId(`${createdSlideA}.${createdShapeA}`),
            name: "add",
            text: createdTextA,
            ...box,
          },
          {
            id: elementId(`${createdSlideB}.${createdShapeB}`),
            name: "add",
            text: createdTextB,
            ...box,
          },
        ])
        const landed = createdShapesLanded(
          written.parts,
          [
            { text: createdTextA, slide: String(origin + 2) },
            { text: createdTextB, slide: String(origin + 3) },
          ],
          [String(origin + 1)],
        )
        if (!landed) throw new Error("slide")
        return { touch, parts: new Map(written.parts) }
      }),
    )
    const cloned = { name: "sldIdLst.clone", slide: firstSlide.id } as const
    runs.push(
      attempt("sldIdLst.clone", cloned, () => ({
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
      attempt("sldIdLst.remove", removed, () => ({
        touch: partTouch(parts, removed),
        parts: applyStructuralRoute(parts, removed),
      })),
    )
    const ordered = { name: "sldIdLst.order", slide: secondSlide.id, before: firstSlide.id } as const
    runs.push(
      attempt("sldIdLst.order", ordered, () => ({
        touch: partTouch(parts, ordered),
        parts: applyStructuralRoute(parts, ordered),
      })),
    )
  }
  const sections = sectionIds(parts)
  const addedSection = { name: "sectionLst.add", title: "AirDesign" } as const
  runs.push(
    attempt("sectionLst.add", addedSection, () => ({
      touch: partTouch(parts, addedSection),
      parts: applyStructuralRoute(parts, addedSection),
    })),
  )
  const firstSection = sections[0]
  const secondSection = sections[1]
  if (firstSection?.id !== null && firstSection?.id !== undefined) {
    const removed = { name: "sectionLst.remove", section: firstSection.id } as const
    runs.push(
      attempt("sectionLst.remove", removed, () => ({
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
      attempt("sectionLst.order", ordered, () => ({
        touch: partTouch(parts, ordered),
        parts: applyStructuralRoute(parts, ordered),
      })),
    )
  }
  for (const edit of tableEdits(parts, slideNames(parts)))
    runs.push(
      attempt(edit.name, edit, () => ({ touch: partTouch(parts, edit), parts: applyStructuralRoute(parts, edit) })),
    )
  return runs
}
