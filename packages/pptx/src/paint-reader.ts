import { markupDocument, type MarkupElement } from "./element-span.js"
import type { ShapeKind } from "./read-shapes.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"

export type PaintBox = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  flipH: boolean
  flipV: boolean
}

export type PaintElement = {
  part: string
  shape: string
  from: "slide" | "layout" | "master"
  kind: ShapeKind
  box: PaintBox | null
  group: string | null
  placeholder: { type: string; index: number | null } | null
}

export type SlidePaint = { width: number; height: number; elements: readonly PaintElement[] }

export type PaintReader = { slide(slidePart: string): SlidePaint }

export class PaintPartError extends Error {
  readonly part: string

  constructor(part: string) {
    super(`paint part ${part}`)
    this.name = "PaintPartError"
    this.part = part
  }
}

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

type Drawn = {
  readonly shape: string
  readonly kind: ShapeKind
  readonly hidden: boolean
  readonly group: string | null
  readonly frames: Frames | null
  readonly own: Own
  readonly placeholder: Placeholder | null
}

type Sheet = {
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

type Above = {
  readonly sheet: Sheet
  readonly painted: readonly PaintElement[]
}

const presentationPart = "ppt/presentation.xml"
const slideName = /^ppt\/slides\/[^/]+\.xml$/
const wholeNumber = /^[+-]?\d+$/
const fullTurn = 21_600_000
const turnsPerDegree = 60_000
const omittedType = "obj"
const nonVisualKinds: Record<ShapeKind, string> = {
  "p:sp": "p:nvSpPr",
  "p:pic": "p:nvPicPr",
  "p:graphicFrame": "p:nvGraphicFramePr",
  "p:cxnSp": "p:nvCxnSpPr",
  "p:grpSp": "p:nvGrpSpPr",
}
const masterTypes = new Map([
  ["ctrTitle", "title"],
  ["subTitle", "body"],
  [omittedType, "body"],
])

const shapeKind = (kind: string): kind is ShapeKind => Object.hasOwn(nonVisualKinds, kind)

const attr = (element: MarkupElement, name: string): string | null => {
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

const extent = (value: string | null): number | null => {
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
  if (shape.kind === "p:graphicFrame") return childOf(children, shape, "p:xfrm")
  const holder = childOf(children, shape, shape.kind === "p:grpSp" ? "p:grpSpPr" : "p:spPr")
  return holder === undefined ? undefined : childOf(children, holder, "a:xfrm")
}

const ownPlacement = (children: MarkupChildren, xfrm: MarkupElement | undefined): Own => {
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

const boxOf = (place: Placement | null): PaintBox | null => {
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

const drawnIn = (elements: readonly MarkupElement[], children: MarkupChildren): readonly Drawn[] => {
  const root = elements[0]
  const body = root === undefined ? undefined : childOf(children, root, "p:cSld")
  const tree = body === undefined ? undefined : childOf(children, body, "p:spTree")
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
    if (!shapeKind(element.kind)) continue
    const nonVisual = childOf(children, element, nonVisualKinds[element.kind])
    const identity = nonVisual === undefined ? undefined : childOf(children, nonVisual, "p:cNvPr")
    if (identity === undefined || identity.id === null) continue
    const hidden = visit.hidden || isTrue(attr(identity, "hidden"))
    const xfrm = transformOf(children, element)
    drawn.push({
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

const finalPlacement = (item: Drawn): Placement | null =>
  typeof item.own === "string" ? null : throughFrames(item.own, item.frames)

const targetPart = (source: string, target: string): string => {
  const path = target.startsWith("/") ? [] : source.split("/").slice(0, -1)
  for (const segment of target.split("/")) {
    if (segment === "..") path.pop()
    else if (segment !== "." && segment !== "") path.push(segment)
  }
  return path.join("/")
}

const relsPart = (part: string): string => {
  const path = part.split("/")
  const name = path.pop() ?? ""
  return [...path, "_rels", `${name}.rels`].join("/")
}

const masterType = (type: string): string => masterTypes.get(type) ?? type

const layoutMatch = (layout: Sheet, wanted: Placeholder): Drawn | undefined => {
  const byIndex =
    wanted.index === null ? undefined : layout.drawn.find((item) => item.placeholder?.index === wanted.index)
  return byIndex ?? layout.drawn.find((item) => item.placeholder?.type === wanted.type)
}

const masterMatch = (master: Sheet, wanted: Placeholder): Drawn | undefined =>
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

const slidePlacement = (item: Drawn, layout: Sheet | null, master: Sheet | null): Placement | null => {
  if (item.own === "malformed") return null
  if (item.own !== "missing") return throughFrames(item.own, item.frames)
  if (item.placeholder === null) return null
  const inherited = inheritedPlacement(item.placeholder, layout, master)
  return inherited === null ? null : throughFrames(inherited, item.frames)
}

const sheetFrom = (part: string, bytes: Uint8Array): Sheet => {
  const { elements } = markupDocument(bytes)
  const root = elements[0]
  return {
    part,
    showsMaster: root === undefined || !isFalse(attr(root, "showMasterSp")),
    drawn: drawnIn(elements, markupChildren(elements)),
  }
}

const paintedAbove = (sheet: Sheet, from: "layout" | "master"): readonly PaintElement[] =>
  sheet.drawn
    .filter((item) => !item.hidden && item.placeholder === null)
    .map((item) => ({
      part: sheet.part,
      shape: item.shape,
      from,
      kind: item.kind,
      box: boxOf(finalPlacement(item)),
      group: item.group,
      placeholder: null,
    }))

export function paintReader(parts: ReadonlyMap<string, Uint8Array>): PaintReader {
  const relationships = new Map<string, ReadonlyMap<string, string>>()
  const above = new Map<string, Above | null>()
  let size: { readonly width: number; readonly height: number } | null = null

  const slideSize = (): { readonly width: number; readonly height: number } => {
    if (size !== null) return size
    const bytes = parts.get(presentationPart)
    const element = bytes === undefined ? undefined : markupDocument(bytes).elements.find((e) => e.kind === "p:sldSz")
    size = {
      width: element === undefined ? 0 : (extent(attr(element, "cx")) ?? 0),
      height: element === undefined ? 0 : (extent(attr(element, "cy")) ?? 0),
    }
    return size
  }

  const relationshipsOf = (part: string): ReadonlyMap<string, string> => {
    const known = relationships.get(part)
    if (known !== undefined) return known
    const targets = new Map<string, string>()
    const bytes = parts.get(relsPart(part))
    const items = bytes === undefined ? [] : markupDocument(bytes).elements
    for (const item of items) {
      const type = attr(item, "Type")
      const target = attr(item, "Target")
      if (item.kind !== "Relationship" || type === null || target === null) continue
      if (attr(item, "TargetMode") === "External") continue
      const name = type.split("/").pop() ?? ""
      if (!targets.has(name)) targets.set(name, targetPart(part, target))
    }
    relationships.set(part, targets)
    return targets
  }

  const sheetAbove = (source: string, type: "slideLayout" | "slideMaster"): Above | null => {
    const part = relationshipsOf(source).get(type)
    if (part === undefined) return null
    const known = above.get(part)
    if (known !== undefined) return known
    const bytes = parts.get(part)
    const sheet = bytes === undefined ? null : sheetFrom(part, bytes)
    const read =
      sheet === null ? null : { sheet, painted: paintedAbove(sheet, type === "slideLayout" ? "layout" : "master") }
    above.set(part, read)
    return read
  }

  const knownSlide = (part: string, bytes: Uint8Array): boolean =>
    slideName.test(part) || markupDocument(bytes).elements[0]?.kind === "p:sld"

  return {
    slide(slidePart: string): SlidePaint {
      const bytes = parts.get(slidePart)
      if (bytes === undefined || !knownSlide(slidePart, bytes)) throw new PaintPartError(slidePart)
      const sheet = sheetFrom(slidePart, bytes)
      const layout = sheetAbove(slidePart, "slideLayout")
      const master = layout === null ? null : sheetAbove(layout.sheet.part, "slideMaster")
      const painted = sheet.drawn
        .filter((item) => !item.hidden)
        .map((item): PaintElement => ({
          part: slidePart,
          shape: item.shape,
          from: "slide",
          kind: item.kind,
          box: boxOf(slidePlacement(item, layout?.sheet ?? null, master?.sheet ?? null)),
          group: item.group,
          placeholder: item.placeholder,
        }))
      const showsLayout = sheet.showsMaster
      const showsMaster = showsLayout && layout !== null && layout.sheet.showsMaster
      return {
        ...slideSize(),
        elements: [
          ...(showsMaster && master !== null ? master.painted : []),
          ...(showsLayout && layout !== null ? layout.painted : []),
          ...painted,
        ],
      }
    },
  }
}
