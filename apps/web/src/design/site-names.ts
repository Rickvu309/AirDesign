import { siteCount, siteSpot, type Outline } from "@airdesign/document"
import { connectionCopy } from "@/copy/connection-copy"

type Frame = { readonly cx: number; readonly cy: number }

type Third = 0 | 1 | 2

function third(at: number, length: number): Third {
  const fraction = length === 0 ? 0.5 : at / length
  return fraction < 1 / 3 ? 0 : fraction > 2 / 3 ? 2 : 1
}

function side(across: Third, down: Third): string | null {
  const { top, middle, bottom, left, right, center } = connectionCopy.sites
  const vertical = [top, middle, bottom][down] ?? middle
  const horizontal = [left, center, right][across] ?? center
  if (across === 1 && down === 1) return center
  if (across === 1) return vertical
  if (down === 1) return horizontal
  return `${vertical} ${horizontal.toLowerCase()}`
}

export function siteNames(outline: Outline, frame: Frame): readonly string[] {
  const names = Array.from({ length: siteCount(outline.preset) }, (_, site) => {
    const spot = siteSpot(outline.preset, frame.cx, frame.cy, outline.adjust, site)
    return spot === null ? null : side(third(spot.x, frame.cx), third(spot.y, frame.cy))
  })
  return names.map((name, site) =>
    name === null || names.indexOf(name) !== names.lastIndexOf(name) ? connectionCopy.point(site + 1) : name,
  )
}
