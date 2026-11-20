import type { Box } from "./box.js"
import type { ElementId } from "./element-id.js"
import type { layoutAligns, sizings } from "./trait-layout.js"

type Align = (typeof layoutAligns)[number]
type Sizing = (typeof sizings)[number]
type Sides = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

export type FlowSlot = {
  readonly node: ElementId
  readonly box: Box
  readonly bounds: (box: Box) => Box
  readonly fills: { readonly width: boolean; readonly height: boolean }
}

export type FlowChild = {
  readonly node: ElementId
  readonly box: Box
  readonly fill?: { readonly width: boolean; readonly height: boolean }
}

export type FlowFields = {
  readonly horizontal: boolean
  readonly gap: number
  readonly padding: Sides
  readonly align: Align
  readonly width: Sizing
  readonly height: Sizing
}

function shareAcross(align: Align, horizontal: boolean): number {
  const name = align.toLowerCase()
  if (horizontal) return name.endsWith("left") ? 0 : name.endsWith("right") ? 1 : 0.5
  return name.startsWith("top") ? 0 : name.startsWith("bottom") ? 1 : 0.5
}

export function flowPlaced(
  slots: readonly FlowSlot[],
  origin: Box,
  fields: FlowFields,
): { readonly box: Box; readonly children: readonly FlowChild[] } {
  const { horizontal, padding, gap } = fields
  const along = (box: Box) => (horizontal ? box.cx : box.cy)
  const across = (box: Box) => (horizontal ? box.cy : box.cx)
  const [sizedAlong, sizedAcross] = horizontal ? [fields.width, fields.height] : [fields.height, fields.width]
  const fillsAlong = (slot: FlowSlot) => sizedAlong !== "hug" && (horizontal ? slot.fills.width : slot.fills.height)
  const fillsAcross = (slot: FlowSlot) => sizedAcross !== "hug" && (horizontal ? slot.fills.height : slot.fills.width)
  const [start, end] = horizontal ? [padding.left, padding.right] : [padding.top, padding.bottom]
  const [crossStart, crossEnd] = horizontal ? [padding.top, padding.bottom] : [padding.left, padding.right]
  const kept = slots.filter((slot) => !fillsAlong(slot))
  const content =
    kept.reduce((sum, slot) => sum + along(slot.bounds(slot.box)), 0) + gap * Math.max(0, slots.length - 1)
  const standing = slots.filter((slot) => !fillsAcross(slot))
  const thickest = Math.max(0, ...(standing.length > 0 ? standing : slots).map((slot) => across(slot.bounds(slot.box))))
  const length = sizedAlong === "hug" ? start + content + end : along(origin)
  const thickness = sizedAcross === "hug" ? crossStart + thickest + crossEnd : across(origin)
  const room = thickness - crossStart - crossEnd
  const free = length - start - end - content
  const filling = slots.length - kept.length
  const share = Math.max(0, Math.floor(free / Math.max(1, filling)))
  const sized = (slot: FlowSlot): Box => {
    const alongSize = fillsAlong(slot) ? share : along(slot.box)
    const acrossSize = fillsAcross(slot) ? room : across(slot.box)
    return { ...slot.box, cx: horizontal ? alongSize : acrossSize, cy: horizontal ? acrossSize : alongSize }
  }
  const crossShare = shareAcross(fields.align, !horizontal)
  const children: FlowChild[] = []
  let cursor = start + (filling > 0 ? 0 : Math.round(free * shareAcross(fields.align, horizontal)))
  for (const slot of slots) {
    const box = sized(slot)
    const bounds = slot.bounds(box)
    const cross = crossStart + Math.round((room - across(bounds)) * crossShare)
    const slotX = origin.x + (horizontal ? cursor : cross)
    const slotY = origin.y + (horizontal ? cross : cursor)
    children.push({
      node: slot.node,
      box: { ...box, x: slotX + box.x - bounds.x, y: slotY + box.y - bounds.y },
      ...(slot.fills.width || slot.fills.height ? { fill: slot.fills } : {}),
    })
    cursor += along(bounds) + gap
  }
  const box = { x: origin.x, y: origin.y, cx: horizontal ? length : thickness, cy: horizontal ? thickness : length }
  return { box, children }
}
