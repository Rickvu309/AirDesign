export type GridNumberPlacement = "above" | "inside" | "hidden"

export function gridNumberPlacement({ width, gap }: { width: number; gap: number }): GridNumberPlacement {
  if (width < 88) return "hidden"
  return gap >= 88 ? "above" : "inside"
}
