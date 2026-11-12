import type { PaintReader } from "@airdesign/pptx"
import type { CanvasElement, CanvasSlide } from "@airdesign/render"
import { backgroundOf } from "@/canvas-background"
import { isGroupKind } from "@/canvas-group"
import { paintElements } from "@/canvas-kind"
import type { CanvasSource, SlideCanvases } from "@/canvas-source"
import type { PictureSource } from "@/picture-fill"

export type { CanvasShape, CanvasSource, SlideCanvases } from "@/canvas-source"

const standardSlide = { width: 9_144_000, height: 6_858_000 }

function unplaced(source: CanvasSource): readonly CanvasElement[] {
  return [...source.shapes]
    .filter(([, shape]) => !isGroupKind(shape.kind))
    .map(([name, shape]) => ({
      key: `${source.part}#${name}`,
      ...shape,
      box: null,
      movable: false,
      placeholder: false,
      filled: false,
      fill: null,
      line: null,
      outline: "box",
      text: null,
    }))
}

function paintOf(reader: PaintReader, part: string) {
  try {
    return reader.slide(part)
  } catch {
    return null
  }
}

function canvasOf(reader: PaintReader, source: CanvasSource, src: PictureSource): CanvasSlide {
  const paint = paintOf(reader, source.part)
  if (paint === null) return { ...standardSlide, background: null, elements: unplaced(source) }
  const size = paint.width > 0 && paint.height > 0 ? paint : standardSlide
  const rows = paintElements(paint.elements, source, src)
  const readsSlide = paint.elements.some((row) => row.from === "slide")
  return {
    width: size.width,
    height: size.height,
    background: backgroundOf(paint.background, src),
    elements: readsSlide ? rows : [...rows, ...unplaced(source)],
  }
}

export function slideCanvases(
  reader: PaintReader,
  sources: readonly CanvasSource[],
  src: PictureSource = () => null,
): SlideCanvases {
  const known = new Map<number, CanvasSlide>()
  return (index) => {
    const painted = known.get(index)
    if (painted !== undefined) return painted
    const source = sources[index]
    if (source === undefined) return null
    const canvas = canvasOf(reader, source, src)
    known.set(index, canvas)
    return canvas
  }
}
