import type { ElementId, Kind } from "@airdesign/document"
import type {
  PaintColor,
  PaintElement,
  PaintFill,
  PaintLine,
  PaintParagraph,
  PaintReader,
  PaintRunStyle,
  PaintText,
  ShapeKind,
  SlidePaint,
} from "@airdesign/pptx"
import {
  unshownFill,
  type CanvasElement,
  type CanvasLine,
  type CanvasOutline,
  type CanvasParagraph,
  type CanvasRunStyle,
  type CanvasSlide,
  type CanvasText,
} from "@airdesign/render"

export type CanvasShape = { readonly id: ElementId; readonly kind: Kind; readonly editable: boolean }

export type CanvasSource = { readonly part: string; readonly shapes: ReadonlyMap<string, CanvasShape> }

export type SlideCanvases = (index: number) => CanvasSlide | null

const standardSlide = { width: 9_144_000, height: 6_858_000 }
const emuPerPoint = 12_700
const quarterTurn = 90
const outlines = new Map<string, CanvasOutline>([
  ["ellipse", "ellipse"],
  ["roundRect", "round"],
  ["line", "line"],
  ["straightConnector1", "line"],
])
const dashes = new Map<string, readonly number[]>([
  ["sysDot", [1, 1]],
  ["sysDash", [3, 1]],
  ["dash", [4, 3]],
  ["dashDot", [4, 3, 1, 3]],
  ["lgDash", [8, 3]],
  ["lgDashDot", [8, 3, 1, 3]],
  ["lgDashDotDot", [8, 3, 1, 3, 1, 3]],
  ["sysDashDot", [3, 1, 1, 1]],
  ["sysDashDotDot", [3, 1, 1, 1, 1, 1]],
])
const aligned = { left: "left", center: "center", right: "right", justify: "justify", distributed: "justify" } as const

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

function cssColor(color: PaintColor): string {
  if (color.alpha >= 1) return `#${color.hex}`
  return `#${color.hex}${Math.round(color.alpha * 255)
    .toString(16)
    .padStart(2, "0")}`
}

function cssGradient(fill: Extract<PaintFill, { type: "gradient" }>): string {
  const stops = fill.stops.map((stop) => `${cssColor(stop.color)} ${stop.position * 100}%`).join(", ")
  return fill.angle === null ? `radial-gradient(${stops})` : `linear-gradient(${fill.angle + quarterTurn}deg, ${stops})`
}

function cssFill(fill: PaintFill | null): string | null {
  if (fill === null || fill.type === "none" || fill.type === "picture") return null
  if (fill.type === "solid") return cssColor(fill.color)
  return fill.type === "gradient" ? cssGradient(fill) : cssColor(fill.background)
}

function outlineOf(row: PaintElement): CanvasOutline {
  if (row.kind === "p:cxnSp") return "line"
  return outlines.get(row.geometry ?? "") ?? "box"
}

function shapeFill(row: PaintElement, outline: CanvasOutline): string | null {
  if (outline === "line") return null
  return row.fill?.type === "picture" ? unshownFill : cssFill(row.fill)
}

function lineColor(fill: PaintFill): string | null {
  if (fill.type === "solid") return cssColor(fill.color)
  if (fill.type === "pattern") return cssColor(fill.foreground)
  if (fill.type !== "gradient") return null
  const first = fill.stops[0]
  return first === undefined ? null : cssColor(first.color)
}

function canvasLine(line: PaintLine | null): CanvasLine | null {
  if (line === null) return null
  const color = lineColor(line.fill)
  return color === null ? null : { color, width: line.width, dash: dashes.get(line.dash ?? "") ?? null }
}

function runStyle(run: PaintRunStyle, scale: number): CanvasRunStyle {
  return {
    font: run.font,
    size: run.size * emuPerPoint * scale,
    bold: run.bold,
    italic: run.italic,
    color: run.color === null ? null : cssColor(run.color),
  }
}

function canvasParagraph(paragraph: PaintParagraph, scale: number): CanvasParagraph {
  return {
    from: paragraph.from,
    align: aligned[paragraph.align],
    runs: paragraph.runs.map((run) => ({ from: run.from, text: run.text, ...runStyle(run, scale) })),
    endStyle: runStyle(paragraph.endStyle, scale),
  }
}

function canvasText(text: PaintText | null): CanvasText | null {
  if (text === null) return null
  return {
    paragraphs: text.paragraphs.map((paragraph) => canvasParagraph(paragraph, text.fontScale)),
    anchor: text.anchor,
    insets: text.insets,
    wrap: text.wrap,
  }
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
    const outline = outlineOf(row)
    elements.push({
      key: count === 0 ? name : `${name}#${count}`,
      id: shape?.id ?? null,
      kind: shape?.kind ?? paintKind(row.kind),
      box: row.box,
      editable: shape?.editable ?? false,
      placeholder: row.placeholder !== null,
      filled: visibleFill(row.fill),
      fill: shapeFill(row, outline),
      line: canvasLine(row.line),
      outline,
      text: canvasText(row.text),
    })
  }
  return elements
}

function unplaced(source: CanvasSource): readonly CanvasElement[] {
  return [...source.shapes]
    .filter(([, shape]) => shape.kind !== "group")
    .map(([name, shape]) => ({
      key: `${source.part}#${name}`,
      ...shape,
      box: null,
      placeholder: false,
      filled: false,
      fill: null,
      line: null,
      outline: "box",
      text: null,
    }))
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
  if (paint === null) return { ...standardSlide, background: null, elements: unplaced(source) }
  const size = paint.width > 0 && paint.height > 0 ? paint : standardSlide
  const rows = canvasElements(paint.elements, source)
  const readsSlide = paint.elements.some((row) => row.from === "slide")
  return {
    width: size.width,
    height: size.height,
    background: cssFill(paint.background),
    elements: readsSlide ? rows : [...rows, ...unplaced(source)],
  }
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
