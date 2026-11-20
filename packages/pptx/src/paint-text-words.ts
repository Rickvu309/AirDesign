import type { PaintParagraph, PaintRunStyle, PaintText } from "./paint-text.js"

export const anchors = new Map<string, PaintText["anchor"]>([
  ["t", "top"],
  ["ctr", "middle"],
  ["b", "bottom"],
  ["just", "top"],
  ["dist", "top"],
])
export const aligns = new Map<string, PaintParagraph["align"]>([
  ["l", "left"],
  ["ctr", "center"],
  ["r", "right"],
  ["just", "justify"],
  ["justLow", "justify"],
  ["dist", "distributed"],
  ["thaiDist", "distributed"],
])
export const caps = new Map<string, NonNullable<PaintRunStyle["caps"]>>([
  ["all", "all"],
  ["small", "small"],
  ["none", "none"],
])
