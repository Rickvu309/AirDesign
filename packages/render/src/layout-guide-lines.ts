import type { LayoutGuide } from "@airdesign/document"
import type { GuideLines } from "./snapping.js"

export type Band = readonly [number, number]

const gridLimit = 400

export function layoutBands(lines: LayoutGuide, extent: number): readonly Band[] {
  const { count, gutter, offset } = lines
  const width = lines.align === "stretch" ? (extent - offset * 2 - gutter * (count - 1)) / count : lines.size
  if (!(width > 0)) return []
  const total = width * count + gutter * (count - 1)
  const first =
    lines.align === "stretch" || lines.align === "start"
      ? offset
      : lines.align === "end"
        ? extent - offset - total
        : (extent - total) / 2
  return Array.from({ length: count }, (_, index): Band => {
    const start = first + index * (width + gutter)
    return [start, index === count - 1 && lines.align === "stretch" ? extent - offset : start + width]
  })
}

export function gridLines(size: number, extent: number): readonly number[] {
  if (!(size > 0) || extent / size > gridLimit) return []
  const found: number[] = []
  for (let at = size; at < extent; at += size) found.push(at)
  return found
}

export function layoutSnapLines(guides: readonly LayoutGuide[], width: number, height: number): GuideLines {
  const x: number[] = []
  const y: number[] = []
  for (const guide of guides) {
    if (guide.pattern === "grid") {
      x.push(...gridLines(guide.size, width))
      y.push(...gridLines(guide.size, height))
    } else if (guide.pattern === "columns") x.push(...layoutBands(guide, width).flat())
    else y.push(...layoutBands(guide, height).flat())
  }
  return { x, y }
}
