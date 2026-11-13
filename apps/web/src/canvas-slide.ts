import type { PaintReader } from "@airdesign/pptx"
import type { CanvasElement, CanvasSlide, CanvasText, CanvasThemeColor } from "@airdesign/render"
import { backgroundOf } from "@/canvas-background"
import { isGroupKind } from "@/canvas-group"
import { paintElements } from "@/canvas-kind"
import type { CanvasSource, SlideCanvases } from "@/canvas-source"
import { fileTexts } from "@/file-text"
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
  return {
    width: size.width,
    height: size.height,
    background: backgroundOf(paint.background, src),
    elements: readsSlide ? rows : [...rows, ...unplaced(source)],
    part: source.part,
  }
}

function tintText(text: CanvasText | null, colors: readonly CanvasThemeColor[]): CanvasText | null {
  return text === null || colors.length === 0 ? text : { ...text, colors }
}

function withColors(element: CanvasElement, colors: readonly CanvasThemeColor[]): CanvasElement {
  if (colors.length === 0) return element
  const table =
    element.table === undefined
      ? undefined
      : {
          ...element.table,
          rows: element.table.rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell) => ({ ...cell, text: tintText(cell.text, colors) })),
          })),
        }
  const diagram = element.diagram?.map((child) => withColors(child, colors))
  return {
    ...element,
    text: tintText(element.text, colors),
    ...(table === undefined ? {} : { table }),
    ...(diagram === undefined ? {} : { diagram }),
  }
}

export function slideCanvases(
  reader: PaintReader,
  sources: readonly CanvasSource[],
  src: PictureSource = () => null,
  texts?: PaintReader,
  colors: (part: string) => readonly CanvasThemeColor[] = () => [],
): SlideCanvases {
  const known = new Map<number, CanvasSlide>()
  return (index) => {
    const painted = known.get(index)
    if (painted !== undefined) return painted
    const source = sources[index]
    if (source === undefined) return null
    const swatches = colors(source.part)
    const canvas = canvasOf(reader, source, src, texts)
    const tinted =
      swatches.length === 0
        ? canvas
        : { ...canvas, elements: canvas.elements.map((element) => withColors(element, swatches)) }
    known.set(index, tinted)
    return tinted
  }
}
