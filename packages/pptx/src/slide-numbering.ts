import type { SlideNumbers } from "@airdesign/document"
import { readSlides } from "./read-shapes.js"
import { sectionStarts } from "./section-read.js"
import { firstSlideNumber } from "./slide-placeholders.js"

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
