import type { Box, SlideNumbers } from "@airdesign/document"
import { linkedPart } from "./notes-part.js"
import { boxOf, sheetFrom, slidePlacement } from "./paint-sheet.js"
import { readSlides } from "./read-shapes.js"
import { sectionStarts } from "./section-read.js"
import { firstSlideNumber, layoutPart } from "./slide-placeholders.js"

type Parts = ReadonlyMap<string, Uint8Array>

export function slideNumbering(parts: Parts): ReadonlyMap<string, SlideNumbers> {
  const slides = readSlides(parts)
  const first = firstSlideNumber(parts)
  const starts = sectionStarts(parts).map(({ start }) => start)
  return new Map(
    slides.map(({ slide }, at) => {
      const start = starts.findLast((each) => each <= at) ?? 0
      return [slide, { number: first + at, total: slides.length, groupNumber: at - start + 1 }]
    }),
  )
}

function sheetAt(parts: Parts, part: string | null) {
  if (part === null) return null
  const bytes = parts.get(part)
  return bytes === undefined ? null : sheetFrom(part, bytes)
}

export function slideNumberBox(parts: Parts, part: string): Box | null {
  const layout = sheetAt(parts, layoutPart(parts, part))
  if (layout === null) return null
  const number = layout.drawn.find((each) => each.placeholder?.type === "sldNum")
  if (number === undefined) return null
  const master = sheetAt(parts, linkedPart(parts, layout.part, "slideMaster"))
  const box = boxOf(slidePlacement(number, null, master))
  return box === null ? null : { x: box.x, y: box.y, cx: box.width, cy: box.height }
}
