const centreReach = 0.66

export type SliceLabel = { readonly x: number; readonly y: number }

export function sliceLabelSpot(
  radius: number,
  from: number,
  to: number,
  width: number,
  height: number,
): SliceLabel | null {
  const middle = (from + to) / 2
  const x = radius * centreReach * Math.cos(middle)
  const y = radius * centreReach * Math.sin(middle)
  for (const corner of [
    [x - width / 2, y - height / 2],
    [x + width / 2, y - height / 2],
    [x - width / 2, y + height / 2],
    [x + width / 2, y + height / 2],
  ] as const) {
    if (Math.hypot(corner[0], corner[1]) > radius) return null
    const turn = Math.atan2(corner[1], corner[0]) - from
    const inside = ((turn % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    if (inside > to - from) return null
  }
  return { x, y }
}
