import type { PaintReader } from "@airdesign/pptx"
import type { CanvasElement, CanvasSlide, CanvasText, CanvasTemplateColor } from "@airdesign/render"
import { backgroundOf } from "@/editing/canvas-background"
import { isGroupKind } from "@/editing/canvas-group"
import { paintElements } from "@/editing/canvas-kind"
import type { CanvasSource, SlideCanvases } from "@/editing/canvas-source"
import { fileTexts } from "@/editing/file-text"
import type { PictureSource } from "@/editing/picture-fill"

export type { CanvasShape, CanvasSource, SlideCanvases } from "@/editing/canvas-source"

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

function canvasOf(
  reader: PaintReader,
  source: CanvasSource,
  src: PictureSource,
  texts: PaintReader | undefined,
): CanvasSlide {
  const paint = paintOf(reader, source.part)
  if (paint === null) return { ...standardSlide, background: null, elements: unplaced(source), part: source.part }
  const size = paint.width > 0 && paint.height > 0 ? paint : standardSlide
  const file = texts === undefined ? null : paintOf(texts, source.part)
  const rows = paintElements(fileTexts(paint.elements, file), source, src)
  const readsSlide = paint.elements.some((row) => row.from === "slide")
  const elements = readsSlide ? rows : [...rows, ...unplaced(source)]
  const drawn = new Set(elements.map((each) => each.id))
  const unpainted = [...source.shapes.values()].flatMap(({ id }) => (drawn.has(id) ? [] : [id]))
  return {
    width: size.width,
    height: size.height,
    background: backgroundOf(paint.background, src),
    elements,
    ...(unpainted.length === 0 ? {} : { unpainted }),
    part: source.part,
  }
}

function tintText(text: CanvasText | null, colors: readonly CanvasTemplateColor[]): CanvasText | null {
  return text === null || colors.length === 0 ? text : { ...text, colors }
}

function withColors(element: CanvasElement, colors: readonly CanvasTemplateColor[]): CanvasElement {
  if (colors.length === 0) return element
  const diagram = element.diagram?.map((child) => withColors(child, colors))
  return {
    ...element,
    text: tintText(element.text, colors),
    ...(diagram === undefined ? {} : { diagram }),
  }
}

export function slideCanvas(
  reader: PaintReader,
  source: CanvasSource,
  src: PictureSource,
  texts: PaintReader | undefined,
  swatches: readonly CanvasTemplateColor[],
): CanvasSlide {
  const canvas = canvasOf(reader, source, src, texts)
  return swatches.length === 0
    ? canvas
    : { ...canvas, elements: canvas.elements.map((element) => withColors(element, swatches)) }
}

export function slideCanvases(
  reader: PaintReader,
  sources: readonly CanvasSource[],
  src: PictureSource = () => null,
  texts?: PaintReader,
  colors: (part: string) => readonly CanvasTemplateColor[] = () => [],
): SlideCanvases {
  const known = new Map<number, CanvasSlide>()
  return (index) => {
    const painted = known.get(index)
    if (painted !== undefined) return painted
    const source = sources[index]
    if (source === undefined) return null
    const tinted = slideCanvas(reader, source, src, texts, colors(source.part))
    known.set(index, tinted)
    return tinted
  }
}
