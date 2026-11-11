import type { ElementId, Kind } from "@airdesign/document"
import type { PaintElement, PaintFill, PaintReader, ShapeKind, SlidePaint } from "@airdesign/pptx"
import type { CanvasElement, CanvasSlide } from "@airdesign/render"

export type CanvasShape = { readonly id: ElementId; readonly kind: Kind; readonly editable: boolean }

export type CanvasSource = { readonly part: string; readonly shapes: ReadonlyMap<string, CanvasShape> }

export type SlideCanvases = (index: number) => CanvasSlide | null

const standardSlide = { width: 9_144_000, height: 6_858_000 }

export function paintKind(kind: ShapeKind): Kind {
  if (kind === "p:pic") return "picture"
  if (kind === "p:cxnSp") return "connector"
  if (kind === "p:grpSp") return "group"
  if (kind === "p:graphicFrame") return "chart"
  return "shape"
}

function visibleFill(fill: PaintFill | null): boolean {
  if (fill === null || fill.type === "none") return false
  if (fill.type === "solid") return fill.color.alpha > 0
  if (fill.type === "gradient") return fill.stops.some((stop) => stop.color.alpha > 0)
  if (fill.type === "pattern") return fill.foreground.alpha > 0 || fill.background.alpha > 0
  return true
}

function canvasElements(rows: readonly PaintElement[], source: CanvasSource): readonly CanvasElement[] {
  const seen = new Map<string, number>()
  const elements: CanvasElement[] = []
  for (const row of rows) {
    if (row.kind === "p:grpSp") continue
    const name = `${row.part}#${row.shape}`
    const count = seen.get(name) ?? 0
    seen.set(name, count + 1)
    const shape = row.from === "slide" ? source.shapes.get(row.shape) : undefined
    elements.push({
      key: count === 0 ? name : `${name}#${count}`,
      id: shape?.id ?? null,
      kind: shape?.kind ?? paintKind(row.kind),
      box: row.box,
      editable: shape?.editable ?? false,
      placeholder: row.placeholder !== null,
      filled: visibleFill(row.fill),
    })
  }
  return elements
}

function unplaced(source: CanvasSource): readonly CanvasElement[] {
  return [...source.shapes]
    .filter(([, shape]) => shape.kind !== "group")
    .map(([name, shape]) => ({ key: `${source.part}#${name}`, ...shape, box: null, placeholder: false, filled: false }))
}

function paintOf(reader: PaintReader, part: string): SlidePaint | null {
  try {
    return reader.slide(part)
  } catch {
    return null
  }
}

function canvasOf(reader: PaintReader, source: CanvasSource): CanvasSlide {
  const paint = paintOf(reader, source.part)
  if (paint === null) return { ...standardSlide, elements: unplaced(source) }
  const size = paint.width > 0 && paint.height > 0 ? paint : standardSlide
  const rows = canvasElements(paint.elements, source)
  const readsSlide = paint.elements.some((row) => row.from === "slide")
  return { width: size.width, height: size.height, elements: readsSlide ? rows : [...rows, ...unplaced(source)] }
}

export function slideCanvases(reader: PaintReader, sources: readonly CanvasSource[]): SlideCanvases {
  const known = new Map<number, CanvasSlide>()
  return (index) => {
    const painted = known.get(index)
    if (painted !== undefined) return painted
    const source = sources[index]
    if (source === undefined) return null
    const canvas = canvasOf(reader, source)
    known.set(index, canvas)
    return canvas
  }
}
