import type { Draft } from "./agent-draft.js"
import { put } from "./agent-draft.js"
import { type Area, gapFor, slideSize, themeOf } from "./agent-place.js"
import { footerTop } from "./slide-footer.js"
import type { Node } from "./doom.js"
import { boxOf, childrenOf, propOf } from "./doom-walk.js"
import type { Px } from "./paint.js"
import type { Block, Styles } from "./pattern-parts.js"
import { textHeight } from "./text-estimate.js"

type Lender = { readonly row: Node; readonly spare: Px }

function cardNeed(draft: Draft, card: Node, width: Px): Px | undefined {
  const layout = propOf(card, "layout")
  if (layout?.mode !== "column") return undefined
  const room = width - layout.padding.l - layout.padding.r
  const theme = themeOf(draft)
  const members = childrenOf(draft.doom, card.id)
  let total = layout.padding.t + layout.padding.b + layout.gap * Math.max(0, members.length - 1)
  for (const member of members) {
    const text = propOf(member, "text")
    total += text === undefined ? boxOf(member, draft.reading.boxes).h : textHeight(text, theme, room)
  }
  return total
}

function rowNeed(draft: Draft, row: Node): Px | undefined {
  const layout = propOf(row, "layout")
  if (layout?.mode !== "row") return undefined
  const cards = childrenOf(draft.doom, row.id)
  if (cards.length === 0) return undefined
  const { w } = boxOf(row, draft.reading.boxes)
  const width = (w - layout.padding.l - layout.padding.r - layout.gap * (cards.length - 1)) / cards.length
  const needs = cards.map((card) => cardNeed(draft, card, width))
  if (needs.some((need) => need === undefined)) return undefined
  return layout.padding.t + layout.padding.b + Math.max(...(needs as Px[]))
}

function lenderAbove(draft: Draft, parent: Node, area: Area): Lender | undefined {
  if (parent.type !== "slide") return undefined
  const clear = gapFor(slideSize(draft).w)
  for (const row of childrenOf(draft.doom, parent.id)) {
    if (propOf(row, "hidden") === true) continue
    const box = boxOf(row, draft.reading.boxes)
    const touches = Math.abs(box.y + box.h + clear - area.y) <= 1
    const overlaps = box.x < area.x + area.w && area.x < box.x + box.w
    if (!touches || !overlaps) continue
    const need = rowNeed(draft, row)
    return need === undefined || box.h <= need ? undefined : { row, spare: box.h - need }
  }
  return undefined
}

const boxOfBlock = (block: Block | undefined) =>
  block === undefined || typeof block.values === "function" ? undefined : block.values.box

export const endsInside = (draft: Draft, block: Block | undefined): boolean => {
  const box = boxOfBlock(block)
  return box !== undefined && box.y + box.h <= footerTop(slideSize(draft).h)
}

export function borrowing(
  draft: Draft,
  parent: Node,
  area: Area,
  make: (area: Area, styles: Styles) => Block | undefined,
  styles: Styles,
): Block | undefined {
  const lender = lenderAbove(draft, parent, area)
  if (lender === undefined) return undefined
  const limit = Math.min(area.y + area.h, footerTop(slideSize(draft).h))
  const top = area.y - lender.spare
  const block = make({ ...area, y: top, h: limit - top }, styles)
  const box = boxOfBlock(block)
  if (block === undefined || box === undefined || typeof block.values === "function") return undefined
  const placed = Math.min(area.y, limit - box.h)
  const lent = boxOf(lender.row, draft.reading.boxes)
  put(draft, lender.row.id, { box: { ...lent, h: lent.h - (area.y - placed) } })
  return { ...block, values: { ...block.values, box: { ...box, y: placed } } }
}
