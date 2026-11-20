export type ShownSlide = number | "kept"

export function shownSlideAfter(wanted: ShownSlide, now: number, count: number): number {
  return Math.max(0, Math.min(wanted === "kept" ? now : wanted, count - 1))
}
