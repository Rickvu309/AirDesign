import { groupBounds, type Member } from "./element-group.js"
import type { Flow, LayoutAlign } from "./frame-layout.js"

const point = 12_700

function spread(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values)
}

function middle(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const half = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? (sorted[half] ?? 0) : ((sorted[half - 1] ?? 0) + (sorted[half] ?? 0)) / 2
}

export function guessed(members: readonly Member[]): {
  readonly flow: Exclude<Flow, "none">
  readonly gap: number
  readonly align: LayoutAlign
  readonly order: readonly Member[]
} {
  const bounds = members.map((member) => ({ member, box: groupBounds([member]) }))
  const centresX = bounds.map(({ box }) => box.x + box.cx / 2)
  const centresY = bounds.map(({ box }) => box.y + box.cy / 2)
  const horizontal = spread(centresX) >= spread(centresY)
  const order = [...bounds].sort((left, right) => (horizontal ? left.box.x - right.box.x : left.box.y - right.box.y))
  const gaps = order.slice(1).map((each, at) => {
    const before = order[at]?.box ?? each.box
    return horizontal ? each.box.x - (before.x + before.cx) : each.box.y - (before.y + before.cy)
  })
  const gap = gaps.length === 0 ? 0 : Math.max(0, Math.round(middle(gaps) / point) * point)
  const starts = order.map(({ box }) => (horizontal ? box.y : box.x))
  const centres = horizontal ? centresY : centresX
  const ends = order.map(({ box }) => (horizontal ? box.y + box.cy : box.x + box.cx))
  const fits = [spread(starts), spread(centres), spread(ends)]
  const best = fits.indexOf(Math.min(...fits))
  const named: readonly (readonly [LayoutAlign, LayoutAlign])[] = [
    ["topLeft", "topLeft"],
    ["left", "top"],
    ["bottomLeft", "topRight"],
  ]
  const align = named[best]?.[horizontal ? 0 : 1] ?? "topLeft"
  return { flow: horizontal ? "horizontal" : "vertical", gap, align, order: order.map(({ member }) => member) }
}
