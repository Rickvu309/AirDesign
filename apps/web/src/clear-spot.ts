import type { Box } from "@airdesign/document"

type Size = { readonly width: number; readonly height: number }

function overlaps(left: Box, right: Box): boolean {
  return (
    left.x < right.x + right.cx &&
    right.x < left.x + left.cx &&
    left.y < right.y + right.cy &&
    right.y < left.y + left.cy
  )
}

export function clearSpot(
  size: Size,
  taken: readonly Box[],
  wanted: { readonly cx: number; readonly cy: number },
): Box {
  const x = Math.round((size.width - wanted.cx) / 2)
  const centred = { x, y: Math.round((size.height - wanted.cy) / 2), ...wanted }
  const gap = Math.round(size.height * 0.03)
  const below = taken.map((box) => box.y + box.cy + gap).sort((left, right) => left - right)
  for (const y of [centred.y, ...below]) {
    const spot = { x, y, ...wanted }
    if (y >= 0 && y + wanted.cy <= size.height && !taken.some((box) => overlaps(box, spot))) return spot
  }
  return centred
}
