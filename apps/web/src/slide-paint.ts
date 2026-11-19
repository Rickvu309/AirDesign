import { readElementId, type ElementId, type TextValue } from "@airdesign/document"
import { applyRoute, paintKind, readShapes, type PaintReader, type ReadShape } from "@airdesign/pptx"
import type { CanvasSlide, CanvasTemplateColor } from "@airdesign/render"
import { slideCanvas, type CanvasSource } from "@/canvas-slide"
import type { TextBox } from "@/commit-edit"
import { boxStorable } from "@/element-move"
import type { Framed } from "@/frame-boxes"
import { storedText } from "@/exported-parts"
import type { PictureSource } from "@/picture-fill"
import { tableEditable } from "@/table-edit"

type Parts = ReadonlyMap<string, Uint8Array>

export type NamedShape = { readonly id: ElementId; readonly shape: ReadShape }

export type SlideShape = NamedShape & {
  readonly kind: ReturnType<typeof paintKind>
  readonly file: string
  readonly opening: ReadShape["box"]
}

export type SlideShapes = {
  readonly slide: string
  readonly part: string
  readonly base: Uint8Array | undefined
  readonly shown: Uint8Array | undefined
  readonly rels: Uint8Array | undefined
  readonly shapes: readonly SlideShape[]
  readonly movables: ReadonlyMap<ElementId, TextBox>
  readonly boxes: ReadonlyMap<ElementId, TextBox>
  readonly editable: ReadonlyMap<ElementId, ReadShape>
  readonly source: CanvasSource
}

export type PaintedCanvas = {
  readonly slide: CanvasSlide
  readonly media: ReadonlyMap<string, Uint8Array | undefined>
}

export function namedShapes(parts: Parts): readonly NamedShape[] {
  const named: NamedShape[] = []
  for (const shape of readShapes(parts)) {
    const id = readElementId(`${shape.slide}.${shape.shape}`)
    if (id !== undefined) named.push({ id, shape })
  }
  return named
}

function trialValue(value: TextValue): TextValue | null {
  for (let paragraph = value.length - 1; paragraph >= 0; paragraph -= 1) {
    const runs = value[paragraph]?.runs ?? []
    for (let run = runs.length - 1; run >= 0; run -= 1) {
      const found = runs[run]
      if (found === undefined || found.text === "\n") continue
      return value.map((each, index) =>
        index === paragraph
          ? {
              ...each,
              runs: runs.map((kept, at) => (at === run ? { ...kept, text: `${kept.text}.` } : kept)),
            }
          : each,
      )
    }
  }
  const first = value[0]
  if (first === undefined) return null
  return [{ ...first, runs: [...first.runs, { from: -1, text: "." }] }, ...value.slice(1)]
}

export function valueStorable(parts: Parts, shape: ReadShape, value: TextValue | null): boolean {
  if (value === null) return false
  try {
    applyRoute(parts, {
      name: "text",
      part: shape.part,
      shape: shape.shape,
      value,
    })
    return true
  } catch {
    return false
  }
}

export function slideRels(part: string): string {
  const at = part.lastIndexOf("/") + 1
  return `${part.slice(0, at)}_rels/${part.slice(at)}.rels`
}

function withSlide(shared: Parts, part: string, bytes: Uint8Array | undefined): Parts {
  const parts = new Map(shared)
  if (bytes !== undefined) parts.set(part, bytes)
  return parts
}

export function sameSlide(painted: SlideShapes, slide: string, base: Parts, display: Parts): boolean {
  const { part } = painted
  return (
    painted.slide === slide &&
    painted.base === base.get(part) &&
    painted.shown === display.get(part) &&
    painted.rels === display.get(slideRels(part))
  )
}

export function slideShapes(
  shared: Parts,
  slide: string,
  part: string,
  base: Parts,
  display: Parts,
  framed: ReadonlyMap<ElementId, unknown> = new Map(),
): SlideShapes {
  const baseBytes = base.get(part)
  const shownBytes = display.get(part)
  const named = namedShapes(withSlide(shared, part, shownBytes))
  const based = new Map(namedShapes(withSlide(shared, part, baseBytes)).map((each) => [each.id, each.shape]))
  const seen = new Map<ElementId, number>()
  for (const { id } of named) seen.set(id, (seen.get(id) ?? 0) + 1)
  const holding = baseBytes === undefined ? null : new Map([[part, baseBytes]])
  const shapes: SlideShape[] = []
  const movables = new Map<ElementId, TextBox>()
  const boxes = new Map<ElementId, TextBox>()
  const editable = new Map<ElementId, ReadShape>()
  for (const { id, shape: shown } of named) {
    const shape = based.get(id) ?? shown
    const file = storedText(shape.text)
    shapes.push({ id, shape: shown, kind: paintKind(shown.kind), file, opening: shape.box })
    if (holding === null || seen.get(id) !== 1) continue
    const table = shape.contentKind === "table" && tableEditable(holding, shape)
    if (table || boxStorable(holding, shape, framed.has(id))) movables.set(id, { id, file })
    const numbered = [...shape.text, ...shown.text].some((each) =>
      each.runs.some((run) => run.slideNumber !== undefined),
    )
    if (!shape.locked && numbered) {
      editable.set(id, shape)
      continue
    }
    if (!table && (shape.locked || !valueStorable(holding, shape, trialValue(shape.text)))) continue
    boxes.set(id, { id, file })
    editable.set(id, shape)
  }
  const source = {
    part,
    shapes: new Map(
      shapes.map(({ id, shape, kind }) => [
        shape.shape,
        { id, kind, editable: boxes.has(id), movable: movables.has(id) },
      ]),
    ),
  }
  return {
    slide,
    part,
    base: baseBytes,
    shown: shownBytes,
    rels: display.get(slideRels(part)),
    shapes,
    movables,
    boxes,
    editable,
    source,
  }
}

export function sameMedia(canvas: PaintedCanvas, display: Parts): boolean {
  for (const [part, bytes] of canvas.media) if (display.get(part) !== bytes) return false
  return true
}

export function paintCanvas(
  painted: SlideShapes,
  reader: PaintReader,
  texts: () => PaintReader,
  src: PictureSource,
  display: Parts,
  swatches: readonly CanvasTemplateColor[],
  refit: ReadonlySet<ElementId>,
  framed?: Framed,
): PaintedCanvas {
  const media = new Map<string, Uint8Array | undefined>()
  const recorded: PictureSource = (image) => {
    media.set(image.part, display.get(image.part))
    return src(image)
  }
  const file = painted.base === painted.shown ? undefined : texts()
  const shapes = [...painted.source.shapes].map(([key, shape]) => {
    const marked = refit.has(shape.id) ? { ...shape, refit: true as const } : shape
    const frame = framed?.frames.get(shape.id)
    if (framed?.backdrops.has(shape.id) === true) return [key, { ...marked, backdrop: true as const }] as const
    const inFrame = framed?.children.get(shape.id)
    const measure =
      framed?.owed.has(shape.id) === true
        ? { measure: "owed" as const }
        : framed?.due.has(shape.id) === true
          ? { measure: "due" as const }
          : {}
    if (inFrame !== undefined) return [key, { ...marked, inFrame, ...measure }] as const
    const opacity = framed?.opacities.get(shape.id)
    const faded = opacity === undefined ? {} : { opacity }
    return [key, frame === undefined ? marked : { ...marked, frame, ...faded }] as const
  })
  const plain = refit.size === 0 && (framed === undefined || framed.frames.size === 0)
  const source = plain ? painted.source : { ...painted.source, shapes: new Map(shapes) }
  return { slide: slideCanvas(reader, source, recorded, file, swatches), media }
}
