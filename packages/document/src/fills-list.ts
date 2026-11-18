import { paintSlots, type PaintSlot, type ShownFills, type SlotPaint } from "./trait-fills.js"

export type ListedPaint = { readonly slot: PaintSlot; readonly paint: SlotPaint; readonly hidden: boolean }

export type FillsListEdit =
  | { readonly add: SlotPaint }
  | { readonly at: number; readonly paint: SlotPaint }
  | { readonly remove: number }
  | { readonly move: number; readonly to: number }
  | { readonly hide: number; readonly hidden: boolean }

const empty: SlotPaint = { none: true }

function unhidden(paint: SlotPaint): SlotPaint {
  return "hidden" in paint ? paint.hidden : paint
}

export function listedPaints(shown: ShownFills): readonly ListedPaint[] {
  return paintSlots.flatMap((slot): ListedPaint[] => {
    const held = shown[slot]
    if (held === undefined || "none" in held) return []
    return [{ slot, paint: unhidden(held), hidden: "hidden" in held }]
  })
}

function padded(list: readonly SlotPaint[]): readonly SlotPaint[] {
  return paintSlots.map((_, at) => list[at] ?? empty)
}

export function listedSlots(shown: ShownFills, edit: FillsListEdit): readonly SlotPaint[] | null {
  const list = paintSlots.flatMap((slot) => {
    const held = shown[slot]
    return held === undefined || "none" in held ? [] : [held]
  })
  if ("add" in edit) return list.length >= paintSlots.length ? null : padded([...list, edit.add])
  if ("remove" in edit) return padded(list.filter((_, at) => at !== edit.remove))
  if ("move" in edit) {
    const moved = list[edit.move]
    if (moved === undefined || edit.to < 0 || edit.to >= list.length) return null
    const rest = list.filter((_, at) => at !== edit.move)
    return padded([...rest.slice(0, edit.to), moved, ...rest.slice(edit.to)])
  }
  const index = "hide" in edit ? edit.hide : edit.at
  const held = list[index]
  if (held === undefined) return null
  const next = "hide" in edit ? (edit.hidden ? { hidden: unhidden(held) } : unhidden(held)) : edit.paint
  return padded(list.map((each, at) => (at === index ? (next as SlotPaint) : each)))
}
