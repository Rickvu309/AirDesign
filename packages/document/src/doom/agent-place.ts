import { largestFreeBox } from "../box-placement.js"
import { type Draft, Stop, draftOf, stop } from "./agent-draft.js"
import type { NodeId } from "./ids.js"
import type { Px } from "./paint.js"
import type { Doom, Node } from "./doom.js"
import { boxOf, childrenOf, deckOf, descendantsOf, get, isLaidOut } from "./doom-walk.js"
import type { Theme } from "./theme.js"

export type Area = { readonly x: Px; readonly y: Px; readonly w: Px; readonly h: Px }

const gapShare = 0.015
const padShare = 0.02
const smallestWidthShare = 0.1
const smallestHeightShare = 0.05

export function themeOf(draft: Draft): Theme {
  const deck = deckOf(draft.doom)
  return (deck === undefined ? undefined : get(deck, "theme")) ?? stop("missing")
}

export function slideSize(draft: Draft): { readonly w: Px; readonly h: Px } {
  const deck = deckOf(draft.doom)
  return (deck === undefined ? undefined : get(deck, "size")) ?? stop("missing")
}

export const gapFor = (width: Px): Px => Math.round(width * gapShare)
export const padFor = (width: Px): Px => Math.round(width * padShare)
export const cardRadiusFor = (width: Px): Px => Math.round(padFor(width) / 2)

export function sizeOf(draft: Draft, parent: Node): { readonly w: Px; readonly h: Px } {
  if (parent.type === "slide") return slideSize(draft)
  const box = boxOf(parent, draft.reading.boxes)
  return { w: box.w, h: box.h }
}

export function freeArea(draft: Draft, parent: Node): Area | undefined {
  const { w, h } = sizeOf(draft, parent)
  if (w <= 0 || h <= 0) return undefined
  if (isLaidOut(parent)) return { x: 0, y: 0, w, h }
  const clear = gapFor(slideSize(draft).w)
  const taken = childrenOf(draft.doom, parent.id)
    .filter((child) => get(child, "hidden") !== true)
    .map((child) => boxOf(child, draft.reading.boxes))
    .map((box) => ({ x: box.x - clear, y: box.y - clear, cx: box.w + 2 * clear, cy: box.h + 2 * clear }))
  const best = largestFreeBox({ width: w, height: h }, taken)
  if (best === undefined || best.cx < w * smallestWidthShare || best.cy < h * smallestHeightShare) return undefined
  return { x: best.x, y: best.y, w: best.cx, h: best.cy }
}

function alignedWithTitle(draft: Draft, slide: Node, area: Area): Area {
  const title = descendantsOf(draft.doom, slide.id).find((node) => get(node, "role") === "title")
  const box = title === undefined ? undefined : boxOf(title, draft.reading.boxes)
  if (box === undefined) return area
  const left = Math.max(area.x, box.x)
  const right = Math.min(area.x + area.w, box.x + box.w)
  return right > left && box.x >= area.x ? { ...area, x: left, w: right - left } : area
}

export function areaFor(draft: Draft, parent: Node, box: Area | undefined): Area {
  if (box !== undefined) return box
  const free = freeArea(draft, parent) ?? stop("limit", parent.id, "box")
  return parent.type === "slide" ? alignedWithTitle(draft, parent, free) : free
}

const slideMarginShare = 1 / 12
const slideEdgeShare = 1 / 13.5

export const bottomLimitOf = (height: Px): Px => height - Math.round(height * slideEdgeShare)

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
