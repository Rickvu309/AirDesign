import type { Box } from "@airdesign/document"
import type { UndoName } from "@/copy/undo-copy"
import type { SlideChange } from "@/slide-edit"

export const slideNames: Readonly<Record<SlideChange, UndoName>> = {
  add: "new",
  clone: "duplicate",
  remove: "delete",
  move: "order",
}

export function boxName(before: Box, after: Box): UndoName | null {
  if (before.cx !== after.cx || before.cy !== after.cy) return "resize"
  return before.x === after.x && before.y === after.y ? null : "move"
}
