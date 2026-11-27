import { largestFreeBox } from "./box-placement.js"
import { type Draft, type Natural, Stop, draftOf, stop } from "./agent-draft.js"
import type { NodeId } from "./ids.js"
import type { Px } from "./paint.js"
import type { Doom, Node } from "./doom.js"
import { boxOf, childrenOf, deckOf, descendantsOf, isLaidOut, propOf } from "./doom-walk.js"
import type { PlacementRules } from "./placement-rules.js"
import type { Theme } from "./theme.js"

export type Area = { readonly x: Px; readonly y: Px; readonly w: Px; readonly h: Px }

export function themeOf(draft: Draft): Theme {
  const deck = deckOf(draft.doom)
  return (deck === undefined ? undefined : propOf(deck, "theme")) ?? stop("missing")
}

export function slideSize(draft: Draft): { readonly w: Px; readonly h: Px } {
  const deck = deckOf(draft.doom)
  return (deck === undefined ? undefined : propOf(deck, "size")) ?? stop("missing")
}

export const gapFor = (width: Px, rules: PlacementRules): Px => Math.round(width * rules.gapShare)
export const padFor = (width: Px, rules: PlacementRules): Px => Math.round(width * rules.padShare)
export const cardRadiusFor = (width: Px, rules: PlacementRules): Px => Math.round(padFor(width, rules) / 2)

export function sizeOf(draft: Draft, parent: Node): { readonly w: Px; readonly h: Px } {
  if (parent.type === "slide") return slideSize(draft)
  const box = boxOf(parent, draft.reading.boxes)
  return { w: box.w, h: box.h }
}

export const fitScale = (natural: Natural, room: Pick<Area, "w" | "h">): number =>
  Math.min(room.w / natural.width, room.h / natural.height)

export function freeArea(draft: Draft, parent: Node, natural?: Natural): Area | undefined {
  const { w, h } = sizeOf(draft, parent)
  if (w <= 0 || h <= 0) return undefined
  if (isLaidOut(parent)) return { x: 0, y: 0, w, h }
  const rules = draft.placement
  const clear = gapFor(slideSize(draft).w, rules)
  const children = childrenOf(draft.doom, parent.id).filter((child) => propOf(child, "hidden") !== true)
  const free = (underTitles: boolean): Area | undefined => {
    const taken = children
      .map((child) => {
        const box = boxOf(child, draft.reading.boxes)
        return underTitles && propOf(child, "role") === "title" ? { ...box, y: 0, h: box.y + box.h } : box
      })
      .map((box) => ({ x: box.x - clear, y: box.y - clear, cx: box.w + 2 * clear, cy: box.h + 2 * clear }))
    const best = largestFreeBox(
      { width: w, height: h },
      taken,
      rules,
      natural === undefined ? undefined : ({ cx, cy }) => fitScale(natural, { w: cx, h: cy }),
    )
    if (best === undefined || best.cx < w * rules.smallestFreeShare.w || best.cy < h * rules.smallestFreeShare.h)
      return undefined
    return { x: best.x, y: best.y, w: best.cx, h: best.cy }
  }
  return free(true) ?? free(false)
}

export function alignedWithTitle(draft: Draft, slide: Node, area: Area): Area {
  const title = descendantsOf(draft.doom, slide.id).find((node) => propOf(node, "role") === "title")
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

function underTitle(draft: Draft, slide: Node, area: Area): Area {
  const size = slideSize(draft)
  const title = descendantsOf(draft.doom, slide.id).find((node) => propOf(node, "role") === "title")
  const titleBox = title === undefined ? undefined : boxOf(title, draft.reading.boxes)
  const top =
    titleBox === undefined ? area.y : Math.max(area.y, titleBox.y + titleBox.h + gapFor(size.w, draft.placement))
  const bottom = Math.min(area.y + area.h, bottomLimitOf(size.h, draft.placement))
  return bottom > top ? { x: area.x, y: top, w: area.w, h: bottom - top } : area
}

export function gridArea(draft: Draft, parent: Node, box: Area | undefined): Area {
  if (box !== undefined) return box
  const free = areaFor(draft, parent, undefined)
  return parent.type === "slide" ? underTitle(draft, parent, free) : free
}

export const bottomLimitOf = (height: Px, rules: PlacementRules): Px => height - Math.round(height * rules.edgeShare)

export function contentAreaOf(doom: Doom, parent: NodeId, rules: PlacementRules): Area | undefined {
  const node = doom.nodes.get(parent)
  if (node === undefined) return undefined
  const draft = draftOf(doom, () => parent, rules)
  try {
    const area = areaFor(draft, node, undefined)
    if (node.type !== "slide") return area
    const { w, h } = slideSize(draft)
    const side = Math.round(w * rules.marginShare)
    const edge = Math.round(h * rules.edgeShare)
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
