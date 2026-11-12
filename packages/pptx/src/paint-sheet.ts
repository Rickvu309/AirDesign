import type { MarkupElement } from "./element-span.js"
import { markupDocument } from "./element-span.js"
import { isShapeTag, shapeTags, type ShapeKind } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"
import type { PaintBox, PaintElement } from "./paint-reader.js"
type Placeholder = NonNullable<PaintElement["placeholder"]>

type Placement = {
  readonly centreX: number
  readonly centreY: number
  readonly width: number
  readonly height: number
  readonly turn: number
  readonly flipH: boolean
  readonly flipV: boolean
}

type GroupFrame = {
  readonly offX: number
  readonly offY: number
  readonly childX: number
  readonly childY: number
  readonly scaleX: number
  readonly scaleY: number
  readonly centreX: number
  readonly centreY: number
  readonly turn: number
  readonly cos: number
  readonly sin: number
  readonly flipH: boolean
  readonly flipV: boolean
}

type Frames = { readonly frame: GroupFrame | null; readonly outer: Frames | null }

type Own = Placement | "missing" | "malformed"

export type Drawn = {
  readonly element: MarkupElement
  readonly shape: string
  readonly kind: ShapeKind
  readonly hidden: boolean
  readonly group: string | null
  readonly frames: Frames | null
  readonly own: Own
  readonly placeholder: Placeholder | null
}

export type Sheet = {
  readonly bytes: Uint8Array
  readonly elements: readonly MarkupElement[]
  readonly children: MarkupChildren
  readonly part: string
  readonly showsMaster: boolean
  readonly drawn: readonly Drawn[]
}

type Visit = {
  readonly element: MarkupElement
  readonly hidden: boolean
  readonly group: string | null
  readonly frames: Frames | null
}

const wholeNumber = /^[+-]?\d+$/
const fullTurn = 21_600_000
const turnsPerDegree = 60_000
const omittedType = "obj"
const masterTypes = new Map([
  ["ctrTitle", "title"],
  ["subTitle", "body"],
  [omittedType, "body"],
])

export const attr = (element: MarkupElement, name: string): string | null => {
  for (const item of element.attributes) if (item.name === name) return item.value
  return null
}

const childOf = (children: MarkupChildren, parent: MarkupElement, kind: string): MarkupElement | undefined =>
  children[parent.index]?.find((item) => item.kind === kind)

const sizeOf = (children: MarkupChildren, parent: MarkupElement): MarkupElement | undefined =>
  children[parent.index]?.find((item) => item.kind === "a:ext" && attr(item, "cx") !== null)

const integer = (value: string | null): number | null => {
  if (value === null || !wholeNumber.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : null
}

export const extent = (value: string | null): number | null => {
  const number = integer(value)
  return number === null || number < 0 ? null : number
}

const isTrue = (value: string | null): boolean => value === "1" || value === "true"

const isFalse = (value: string | null): boolean => value === "0" || value === "false"

const angle = (element: MarkupElement): number | null => {
  const value = attr(element, "rot")
  return value === null ? 0 : integer(value)
}

const transformOf = (children: MarkupChildren, shape: MarkupElement): MarkupElement | undefined => {
  if (!isShapeTag(shape.kind)) return undefined
  const facts = shapeTags[shape.kind]
  const holder = facts.properties === null ? shape : childOf(children, shape, facts.properties)
  return holder === undefined ? undefined : childOf(children, holder, facts.transform)
}

export const ownPlacement = (children: MarkupChildren, xfrm: MarkupElement | undefined): Own => {
  if (xfrm === undefined) return "missing"
  const off = childOf(children, xfrm, "a:off")
  const ext = sizeOf(children, xfrm)
  if (off === undefined || ext === undefined) return "missing"
  const x = integer(attr(off, "x"))
  const y = integer(attr(off, "y"))
  const width = extent(attr(ext, "cx"))
  const height = extent(attr(ext, "cy"))
  const turn = angle(xfrm)
  if (x === null || y === null || width === null || height === null || turn === null) return "malformed"
  return {
    centreX: x + width / 2,
    centreY: y + height / 2,
    width,
    height,
    turn,
    flipH: isTrue(attr(xfrm, "flipH")),
    flipV: isTrue(attr(xfrm, "flipV")),
  }
}

const groupFrame = (children: MarkupChildren, xfrm: MarkupElement): GroupFrame | null => {
  const off = childOf(children, xfrm, "a:off")
  const ext = sizeOf(children, xfrm)
  const childOff = childOf(children, xfrm, "a:chOff")
  const childExt = childOf(children, xfrm, "a:chExt")
  if (off === undefined || ext === undefined || childOff === undefined || childExt === undefined) return null
  const offX = integer(attr(off, "x"))
  const offY = integer(attr(off, "y"))
  const width = extent(attr(ext, "cx"))
  const height = extent(attr(ext, "cy"))
  const childX = integer(attr(childOff, "x"))
  const childY = integer(attr(childOff, "y"))
  const childWidth = extent(attr(childExt, "cx"))
  const childHeight = extent(attr(childExt, "cy"))
  const turn = angle(xfrm)
  if (offX === null || offY === null || width === null || height === null) return null
  if (childX === null || childY === null || childWidth === null || childHeight === null) return null
  if (turn === null) return null
  const radians = (turn / turnsPerDegree) * (Math.PI / 180)
  return {
    offX,
    offY,
    childX,
    childY,
    scaleX: childWidth === 0 ? 1 : width / childWidth,
    scaleY: childHeight === 0 ? 1 : height / childHeight,
    centreX: offX + width / 2,
    centreY: offY + height / 2,
    turn,
    cos: Math.cos(radians),
    sin: Math.sin(radians),
    flipH: isTrue(attr(xfrm, "flipH")),
    flipV: isTrue(attr(xfrm, "flipV")),
  }
}

const framesInside = (
  children: MarkupChildren,
  xfrm: MarkupElement | undefined,
  outer: Frames | null,
): Frames | null => {
  if (xfrm === undefined || (children[xfrm.index] ?? []).length === 0) return outer
  return { frame: groupFrame(children, xfrm), outer }
}

const throughFrame = (frame: GroupFrame, place: Placement): Placement => {
  const scaledX = frame.offX + (place.centreX - frame.childX) * frame.scaleX
  const scaledY = frame.offY + (place.centreY - frame.childY) * frame.scaleY
  const fromCentreX = (frame.flipH ? 2 * frame.centreX - scaledX : scaledX) - frame.centreX
  const fromCentreY = (frame.flipV ? 2 * frame.centreY - scaledY : scaledY) - frame.centreY
  return {
    centreX: frame.centreX + fromCentreX * frame.cos - fromCentreY * frame.sin,
    centreY: frame.centreY + fromCentreX * frame.sin + fromCentreY * frame.cos,
    width: place.width * frame.scaleX,
    height: place.height * frame.scaleY,
    turn: (frame.flipH !== frame.flipV ? -place.turn : place.turn) + frame.turn,
    flipH: place.flipH !== frame.flipH,
    flipV: place.flipV !== frame.flipV,
  }
}

const throughFrames = (place: Placement, frames: Frames | null): Placement | null => {
  let placed = place
  for (let at = frames; at !== null; at = at.outer) {
    if (at.frame === null) return null
    placed = throughFrame(at.frame, placed)
  }
  return placed
}

export const boxOf = (place: Placement | null): PaintBox | null => {
  if (place === null) return null
  const x = place.centreX - place.width / 2
  const y = place.centreY - place.height / 2
  if (![x, y, place.width, place.height].every(Number.isFinite)) return null
  return {
    x,
    y,
    width: place.width,
    height: place.height,
    rotation: (((place.turn % fullTurn) + fullTurn) % fullTurn) / turnsPerDegree,
    flipH: place.flipH,
    flipV: place.flipV,
  }
}

const placeholderOf = (children: MarkupChildren, nonVisual: MarkupElement | undefined): Placeholder | null => {
  const application = nonVisual === undefined ? undefined : childOf(children, nonVisual, "p:nvPr")
  const placeholder = application === undefined ? undefined : childOf(children, application, "p:ph")
  if (placeholder === undefined) return null
  return { type: attr(placeholder, "type") ?? omittedType, index: integer(attr(placeholder, "idx")) }
}

const drawnIn = (tree: MarkupElement | undefined, children: MarkupChildren): readonly Drawn[] => {
  if (tree === undefined) return []
  const drawn: Drawn[] = []
  const visits: Visit[] = []
  const visitInside = (parent: MarkupElement, visit: Omit<Visit, "element">) => {
    const inside = children[parent.index] ?? []
    for (let at = inside.length - 1; at >= 0; at -= 1) {
      const element = inside[at]
      if (element !== undefined) visits.push({ ...visit, element })
    }
  }
  visitInside(tree, { hidden: false, group: null, frames: null })
  for (let visit = visits.pop(); visit !== undefined; visit = visits.pop()) {
    const { element } = visit
    if (element.kind === "mc:AlternateContent") {
      const choice = childOf(children, element, "mc:Choice")
      if (choice !== undefined) visitInside(choice, visit)
      continue
    }
    if (!isShapeTag(element.kind)) continue
    const nonVisual = childOf(children, element, shapeTags[element.kind].nonVisual)
    const identity = nonVisual === undefined ? undefined : childOf(children, nonVisual, "p:cNvPr")
    if (identity === undefined || identity.id === null) continue
    const hidden = visit.hidden || isTrue(attr(identity, "hidden"))
    const xfrm = transformOf(children, element)
    drawn.push({
      element,
      shape: identity.id,
      kind: element.kind,
      hidden,
      group: visit.group,
      frames: visit.frames,
      own: ownPlacement(children, xfrm),
      placeholder: placeholderOf(children, nonVisual),
    })
    if (element.kind === "p:grpSp") {
      visitInside(element, { hidden, group: identity.id, frames: framesInside(children, xfrm, visit.frames) })
    }
  }
  return drawn
}

export const finalPlacement = (item: Drawn): Placement | null =>
  typeof item.own === "string" ? null : throughFrames(item.own, item.frames)

const masterType = (type: string): string => masterTypes.get(type) ?? type

export const layoutMatch = (layout: Sheet, wanted: Placeholder): Drawn | undefined => {
  const byIndex =
    wanted.index === null ? undefined : layout.drawn.find((item) => item.placeholder?.index === wanted.index)
  return byIndex ?? layout.drawn.find((item) => item.placeholder?.type === wanted.type)
}

export const masterMatch = (master: Sheet, wanted: Placeholder): Drawn | undefined =>
  master.drawn.find(
    (item) => item.placeholder !== null && masterType(item.placeholder.type) === masterType(wanted.type),
  )

const inheritedPlacement = (wanted: Placeholder, layout: Sheet | null, master: Sheet | null): Placement | null => {
  const above = layout === null ? undefined : layoutMatch(layout, wanted)
  const placed = above === undefined ? null : finalPlacement(above)
  if (placed !== null) return placed
  const base = master === null ? undefined : masterMatch(master, above?.placeholder ?? wanted)
  return base === undefined ? null : finalPlacement(base)
}

export const slidePlacement = (item: Drawn, layout: Sheet | null, master: Sheet | null): Placement | null => {
  if (item.own === "malformed") return null
  if (item.own !== "missing") return throughFrames(item.own, item.frames)
  if (item.placeholder === null) return null
  const inherited = inheritedPlacement(item.placeholder, layout, master)
  return inherited === null ? null : throughFrames(inherited, item.frames)
}

const treeOf = (children: MarkupChildren, root: MarkupElement | undefined): MarkupElement | undefined => {
  const body = root === undefined ? undefined : childOf(children, root, "p:cSld")
  return body === undefined ? undefined : childOf(children, body, "p:spTree")
}

export const sheetFrom = (part: string, bytes: Uint8Array): Sheet => {
  const { elements } = markupDocument(bytes)
  const root = elements[0]
  const children = markupChildren(elements)
  return {
    bytes,
    elements,
    children,
    part,
    showsMaster: root === undefined || !isFalse(attr(root, "showMasterSp")),
    drawn: drawnIn(treeOf(children, root), children),
  }
}

export const drawingFrom = (part: string, bytes: Uint8Array, elements: readonly MarkupElement[]): Sheet => {
  const children = markupChildren(elements)
  const root = elements[0]
  const tree = root === undefined ? undefined : childOf(children, root, "p:spTree")
  return { bytes, elements, children, part, showsMaster: false, drawn: drawnIn(tree, children) }
}
