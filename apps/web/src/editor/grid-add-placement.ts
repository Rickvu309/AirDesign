export function gridAddFits({
  width,
  height,
  columnGap,
  rowGap,
}: {
  width: number
  height: number
  columnGap: number
  rowGap: number
}): boolean {
  return Math.min(width, height, columnGap, rowGap) >= 24
}
