import { gridSpacing, type GridLayout } from "@/editor/grid-lines"

export type GridNumberPlacement = "above" | "inside" | "hidden"

export function gridNumberPlacement({ width, gap }: { width: number; gap: number }): GridNumberPlacement {
  if (width < 88) return "hidden"
  return gap >= 88 ? "above" : "inside"
}

export function gridZoomPlacement(layout: GridLayout, scale: number): GridNumberPlacement {
  const card = layout.cards[0]
  if (card === undefined) return "hidden"
  return gridNumberPlacement({ width: card.width * scale, gap: gridSpacing(card).group * scale })
}
