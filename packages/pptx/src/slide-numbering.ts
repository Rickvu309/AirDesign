import { gridRows, readSlideId, type Box, type SlideNumbers, type SlideState } from "@airdesign/document"
import { linkedPart } from "./notes-part.js"
import { boxOf, sheetFrom, slidePlacement } from "./paint-sheet.js"
import { readSlides } from "./read-shapes.js"
import { firstSlideNumber, layoutPart } from "./slide-placeholders.js"

type Parts = ReadonlyMap<string, Uint8Array>

export function slideNumbering(parts: Parts, state: SlideState | null = null): ReadonlyMap<string, SlideNumbers> {
  const slides = readSlides(parts)
  const first = firstSlideNumber(parts)
  const file = slides.flatMap(({ slide }) => {
    const id = readSlideId(slide)
    return id === undefined ? [] : [id]
  })
  const rows = new Map(
    gridRows({ file: state?.file.length ? state.file : file, order: state?.order ?? [] }).flatMap((row) =>
      row.map((slide, at) => [slide, at + 1] as const),
    ),
  )
  return new Map(
    slides.map(({ slide }, at) => {
      const id = readSlideId(slide)
      return [
        slide,
        { number: first + at, total: slides.length, rowNumber: id === undefined ? 1 : (rows.get(id) ?? 1) },
      ]
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
