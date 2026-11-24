import { largestFreeBox } from "./box-placement.js"
import { type Draft, Stop, draftOf, stop } from "./agent-draft.js"
import type { NodeId } from "./ids.js"
import type { Px } from "./paint.js"
import type { Doom, Node } from "./doom.js"
import { type Box, boxOf, childrenOf, deckOf, descendantsOf, isLaidOut, propOf } from "./doom-walk.js"
import { footerTop } from "./slide-footer.js"
import type { Theme } from "./theme.js"

export type Area = { readonly x: Px; readonly y: Px; readonly w: Px; readonly h: Px }

const gapShare = 0.015
const padShare = 0.02
const smallestWidthShare = 0.1
const smallestHeightShare = 0.05

export function themeOf(draft: Draft): Theme {
  const deck = deckOf(draft.doom)
  return (deck === undefined ? undefined : propOf(deck, "theme")) ?? stop("missing")
}

export function slideSize(draft: Draft): { readonly w: Px; readonly h: Px } {
  const deck = deckOf(draft.doom)
  return (deck === undefined ? undefined : propOf(deck, "size")) ?? stop("missing")
}

export const gapFor = (width: Px): Px => Math.round(width * gapShare)
export const padFor = (width: Px): Px => Math.round(width * padShare)
export const cardRadiusFor = (width: Px): Px => Math.round(padFor(width) / 2)

export function sizeOf(draft: Draft, parent: Node): { readonly w: Px; readonly h: Px } {
  if (parent.type === "slide") return slideSize(draft)
  const box = boxOf(parent, draft.reading.boxes)
  return { w: box.w, h: box.h }
}

type Taken = (child: Node) => boolean

const anyLayer: Taken = () => true
const placeholders: Taken = (child) => ["title", "subtitle"].includes(propOf(child, "role") ?? "")

function freeIn(draft: Draft, parent: Node, holds: Taken): Area | undefined {
  const { w, h } = sizeOf(draft, parent)
  if (w <= 0 || h <= 0) return undefined
  if (isLaidOut(parent)) return { x: 0, y: 0, w, h }
  const clear = gapFor(slideSize(draft).w)
  const shown = childrenOf(draft.doom, parent.id).filter((child) => propOf(child, "hidden") !== true)
  const footer = parent.type === "slide" ? [{ x: 0, y: footerTop(h), cx: w, cy: h }] : []
  const titleTops = shown
    .filter((child) => propOf(child, "role") === "title")
    .map((child) => boxOf(child, draft.reading.boxes).y)
  const aboveTitle =
    parent.type === "slide" && titleTops.length > 0 ? [{ x: 0, y: 0, cx: w, cy: Math.min(...titleTops) }] : []
  const taken = shown
    .filter(holds)
    .map((child) => boxOf(child, draft.reading.boxes))
    .map((box) => ({ x: box.x - clear, y: box.y - clear, cx: box.w + 2 * clear, cy: box.h + 2 * clear }))
  const best = largestFreeBox({ width: w, height: h }, [...taken, ...footer, ...aboveTitle])
  if (best === undefined || best.cx < w * smallestWidthShare || best.cy < h * smallestHeightShare) return undefined
  return { x: best.x, y: best.y, w: best.cx, h: best.cy }
}

export const freeArea = (draft: Draft, parent: Node): Area | undefined => freeIn(draft, parent, anyLayer)

const noRoom = "a box, as this slide or frame has no free room left for it"

function alignedWithTitle(draft: Draft, slide: Node, area: Area): Area {
  const title = descendantsOf(draft.doom, slide.id).find((node) => propOf(node, "role") === "title")
  const box = title === undefined ? undefined : boxOf(title, draft.reading.boxes)
  if (box === undefined) return area
  const left = Math.max(area.x, box.x)
  const right = Math.min(area.x + area.w, box.x + box.w)
  return right > left && box.x >= area.x ? { ...area, x: left, w: right - left } : area
}

export function areaFor(draft: Draft, parent: Node, box: Area | undefined): Area {
  if (box !== undefined) return box
  const free = freeArea(draft, parent) ?? stop("limit", parent.id, "box", "needs", noRoom)
  return parent.type === "slide" ? alignedWithTitle(draft, parent, free) : free
}

const slotColumns = 3
const slotRows = 2

const overlaps = (one: Area, two: Box) =>
  one.x < two.x + two.w && two.x < one.x + one.w && one.y < two.y + two.h && two.y < one.y + one.h

function slotGrid(draft: Draft, slide: Node): { readonly area: Area; readonly w: Px; readonly h: Px } | undefined {
  const band = freeIn(draft, slide, placeholders)
  if (band === undefined) return undefined
  const size = slideSize(draft)
  const gap = gapFor(size.w)
  const fits = (area: Area) => {
    const w = Math.floor((area.w - gap * (slotColumns - 1)) / slotColumns)
    const h = Math.floor((area.h - gap * (slotRows - 1)) / slotRows)
    return w >= size.w * smallestWidthShare && h >= size.h * smallestHeightShare ? { area, w, h } : undefined
  }
  return fits(alignedWithTitle(draft, slide, band)) ?? fits(band)
}

export function shapeSlot(draft: Draft, parent: Node): Area {
  const grid = parent.type === "slide" && !isLaidOut(parent) ? slotGrid(draft, parent) : undefined
  if (grid === undefined) return areaFor(draft, parent, undefined)
  const { area, w, h } = grid
  const gap = gapFor(slideSize(draft).w)
  const taken = childrenOf(draft.doom, parent.id)
    .filter((child) => propOf(child, "hidden") !== true)
    .map((child) => boxOf(child, draft.reading.boxes))
  for (let row = 0; row < slotRows; row += 1)
    for (let column = 0; column < slotColumns; column += 1) {
      const slot = { x: area.x + column * (w + gap), y: area.y + row * (h + gap), w, h }
      if (!taken.some((box) => overlaps(slot, box))) return slot
    }
  const free = areaFor(draft, parent, undefined)
  return { ...free, w: Math.min(free.w, w), h: Math.min(free.h, h) }
}

function underTitle(draft: Draft, slide: Node, area: Area): Area {
  const size = slideSize(draft)
  const title = descendantsOf(draft.doom, slide.id).find((node) => propOf(node, "role") === "title")
  const titleBox = title === undefined ? undefined : boxOf(title, draft.reading.boxes)
  const top = titleBox === undefined ? area.y : Math.max(area.y, titleBox.y + titleBox.h + gapFor(size.w))
  const bottom = Math.min(area.y + area.h, footerTop(size.h))
  return bottom > top ? { x: area.x, y: top, w: area.w, h: bottom - top } : area
}

export function patternArea(draft: Draft, parent: Node, box: Area | undefined): Area {
  if (box !== undefined) return box
  const free = areaFor(draft, parent, undefined)
  return parent.type === "slide" ? underTitle(draft, parent, free) : free
}

const slideMarginShare = 1 / 12
const slideEdgeShare = 1 / 13.5

export function contentAreaOf(doom: Doom, parent: NodeId): Area | undefined {
  const node = doom.nodes.get(parent)
  if (node === undefined) return undefined
  const draft = draftOf(doom, () => parent)
  try {
    const area = areaFor(draft, node, undefined)
    if (node.type !== "slide") return area
    const { w, h } = slideSize(draft)
    const side = Math.round(w * slideMarginShare)
    const edge = Math.round(h * slideEdgeShare)
    const left = Math.max(area.x, side)
    const top = Math.max(area.y, edge)
    return {
      x: left,
      y: top,
      w: Math.min(area.x + area.w, w - side) - left,
      h: Math.min(area.y + area.h, h - edge) - top,
    }
  } catch (thrown) {
    if (thrown instanceof Stop) return undefined
    throw thrown
  }
}
