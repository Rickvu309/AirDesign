export type GridNumberPlacement = "above" | "inside" | "hidden"

export function gridNumberPlacement({ width, gap }: { width: number; gap: number }): GridNumberPlacement {
  if (width < 88) return "hidden"
  return gap >= 112 ? "above" : "inside"
}

export function gridElementPresses(screen: Parameters<typeof gridNumberPlacement>[0]): boolean {
  return gridNumberPlacement(screen) !== "hidden" && screen.gap >= 28
}
