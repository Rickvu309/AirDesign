import type { Box, StackMove } from "@airdesign/document"
import type { UndoName } from "@/copy/undo-copy"
import type { ElementChange } from "@/element-edit"
import type { SlideChange } from "@/slide-edit"

export const slideNames: Readonly<Record<SlideChange, UndoName>> = {
  add: "new",
  clone: "duplicate",
  remove: "delete",
  move: "order",
}

export const elementNames: Readonly<Record<Exclude<ElementChange["change"], "order">, UndoName>> = {
  text: "add-box",
  table: "add-table",
  shape: "add-shape",
  remove: "delete-element",
  group: "group",
  ungroup: "ungroup",
  frame: "add-auto-layout",
  join: "layer-order",
}

export const stackNames: Readonly<Record<StackMove, UndoName>> = {
  front: "front",
  forward: "forward",
  backward: "backward",
  back: "back",
}

export function boxName(before: Box, after: Box): UndoName | null {
  if (before.cx !== after.cx || before.cy !== after.cy) return "resize"
  return before.x === after.x && before.y === after.y ? null : "move"
}
