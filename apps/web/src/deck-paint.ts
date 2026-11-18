import { slideId, type ElementId, type Register, type SlideId } from "@airdesign/document"
import {
  paintReader,
  readSlides,
  slideNumbering,
  sectionStarts,
  themeSwatches,
  type ReadShape,
  type SectionStart,
} from "@airdesign/pptx"
import type { ElementRecord, PaintStore } from "@airdesign/render"
import type { SlideCanvases } from "@/canvas-slide"
import type { TextBox } from "@/commit-edit"
import { landedBox } from "@/element-move"
import { editedParts, newSlideElement, slideBase, type PictureBytes } from "@/exported-parts"
import { pictureSources, type PictureSources } from "@/picture-fill"
import { shownValue, type BusyElements } from "@/live-repaint"
import { fallbackPrompt } from "@/copy/placeholder-copy"
import { numberedText } from "@/numbered-text"
import { tableEdited } from "@/table-edit"
import { designRows } from "@/design-rows"
import {
  namedShapes,
  paintCanvas,
  sameMedia,
  sameSlide,
  slideRels,
  slideShapes,
  type PaintedCanvas,
  type SlideShape,
  type SlideShapes,
} from "@/slide-paint"

export { valueStorable } from "@/slide-paint"

type Parts = ReadonlyMap<string, Uint8Array>

type PaintedSlide = { readonly shapes: SlideShapes; readonly values: string; canvas: PaintedCanvas | null }

export type Painted = {
  readonly count: number
  readonly sections: readonly SectionStart[]
  readonly canvases: SlideCanvases
  readonly boxes: ReadonlyMap<ElementId, TextBox>
  readonly movables: ReadonlyMap<ElementId, TextBox>
  readonly shapes: ReadonlyMap<ElementId, ReadShape>
  readonly pictures: PictureSources
  readonly numberText: ReturnType<typeof numberedText>
  readonly files: ReadonlyMap<ElementId, string>
  readonly base: Parts
  readonly display: Parts
  readonly repainted: readonly SlideId[]
  readonly from: Parts
  readonly shared: Parts
  readonly slides: readonly PaintedSlide[]
}

export function elementIds(parts: Parts): readonly ElementId[] {
  return namedShapes(parts).map((named) => named.id)
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false
  return true
}

function sameIdentity(next: Parts, before: Parts | undefined): Parts {
  if (before === undefined || before === next) return next
  let held: Map<string, Uint8Array> | null = null
  for (const [name, bytes] of next) {
    const old = before.get(name)
    if (old === undefined || old === bytes || !sameBytes(old, bytes)) continue
    held ??= new Map(next)
    held.set(name, old)
  }
  return held ?? next
}

function sharedParts(display: Parts, slideParts: ReadonlySet<string>): Parts {
  const shared = new Map<string, Uint8Array>()
  for (const [name, bytes] of display) if (!slideParts.has(name)) shared.set(name, bytes)
  return shared
}

function deckWide(shared: Parts, slideParts: ReadonlySet<string>): readonly (readonly [string, Uint8Array])[] {
  const rels = new Set([...slideParts].map(slideRels))
  return [...shared].filter(
    ([name]) => !rels.has(name) && !name.startsWith("ppt/media/") && !name.startsWith("ppt/notesSlides/"),
  )
}

function sameShared(shared: Parts, before: Parts, slideParts: ReadonlySet<string>): boolean {
  const now = deckWide(shared, slideParts)
  return now.length === deckWide(before, slideParts).length && now.every(([name, bytes]) => before.get(name) === bytes)
}

function sameRecord(current: ElementRecord | null, next: ElementRecord): boolean {
  return (
    current !== null && current.kind === next.kind && current.text === next.text && current.picture === next.picture
  )
}

function laidOut(register: Register | null, id: ElementId): boolean {
  const rows = register?.elements[id]?.landed ?? []
  return rows.some((row) => row.visible && row.v !== undefined && (row.patch.body ?? row.patch.text) !== undefined)
}

function refitted(register: Register | null, { id, file, opening }: SlideShape): boolean {
  const box = landedBox(register, id)
  const resized = box !== null && (box.cx !== opening?.cx || box.cy !== opening?.cy)
  if (resized || laidOut(register, id) || newSlideElement(register, id) !== undefined) return true
  return shownValue(register, id, file) !== file
}

function shownOf(register: Register | null, id: ElementId, text: string): string {
  return JSON.stringify([text, landedBox(register, id)])
}

const themePart = /^ppt\/theme\/theme\d+\.xml$/

function themed(base: Parts, display: Parts): Parts {
  const shown = [...display].filter(([name, bytes]) => themePart.test(name) && base.get(name) !== bytes)
  return shown.length === 0 ? base : new Map([...base, ...shown])
}

export function paint(
  store: PaintStore,
  parts: Parts,
  register: Register | null,
  busy: BusyElements,
  pictureBytes: PictureBytes = new Map(),
  previous: Painted | null = null,
): Painted {
  const earlier = previous?.from === parts ? previous : null
  const base = sameIdentity(register === null ? parts : slideBase(parts, register, pictureBytes), earlier?.base)
  const edited =
    register !== null && (register.order.length > 0 || tableEdited(register) || designRows(register).length > 0)
      ? editedParts(base, register, pictureBytes)
      : base
  const display = sameIdentity(edited, earlier?.display)
  const read = readSlides(display)
  const numberText = numberedText(slideNumbering(display, register))
  const slideParts = new Set(read.map((each) => each.part))
  const shared = sharedParts(display, slideParts)
  const reusable = earlier !== null && sameShared(shared, earlier.shared, slideParts)
  const before = new Map(reusable ? earlier.slides.map((each) => [each.shapes.part, each]) : [])
  const repainted: SlideId[] = []
  const slides = read.map(({ slide, part }): PaintedSlide => {
    const old = before.get(part)
    const same = old !== undefined && sameSlide(old.shapes, slide, base, display)
    const shapes = same ? old.shapes : slideShapes(shared, slide, part, base, display)
    const values = shapes.shapes
      .map(({ id, file }) => shownOf(register, id, numberText(id, shownValue(register, id, file))))
      .join("\n")
    if (same && old.values === values && old.canvas !== null && sameMedia(old.canvas, display))
      return { shapes, values, canvas: old.canvas }
    if (!same || old.values !== values) repainted.push(slideId(slide))
    return { shapes, values, canvas: null }
  })
  const boxes = new Map<ElementId, TextBox>()
  const movables = new Map<ElementId, TextBox>()
  const rows = new Map<ElementId, ReadShape>()
  const files = new Map<ElementId, string>()
  for (const { shapes } of slides) {
    for (const { id, kind, file } of shapes.shapes) {
      files.set(id, file)
      const current = store.getElement(id)
      if (busy.has(id) && current !== null) continue
      const record = {
        id,
        kind,
        text: numberText(id, shownValue(register, id, file)),
        picture: kind === "picture" ? "" : null,
      }
      if (!sameRecord(current, record)) store.publish(record)
      store.placeBox(id, landedBox(register, id))
    }
    for (const [id, box] of shapes.boxes) boxes.set(id, box)
    for (const [id, box] of shapes.movables) movables.set(id, box)
    for (const [id, shape] of shapes.editable) rows.set(id, shape)
  }
  store.setSlides(
    slides.map(({ shapes }) => ({ id: slideId(shapes.slide), elements: shapes.shapes.map((each) => each.id) })),
  )
  const pictures = earlier?.pictures.carried(display) ?? pictureSources(display)
  let reader: ReturnType<typeof paintReader> | null = null
  let texts: ReturnType<typeof paintReader> | null = null
  const canvases: SlideCanvases = (index) => {
    const painted = slides[index]
    if (painted === undefined) return null
    if (painted.canvas !== null) return painted.canvas.slide
    reader ??= paintReader(display, { fallbackPrompt })
    const fileTexts = () => (texts ??= paintReader(themed(base, display), { fallbackPrompt }))
    const swatches = themeSwatches(display, painted.shapes.part)
    const refit = new Set(painted.shapes.shapes.filter((shape) => refitted(register, shape)).map((shape) => shape.id))
    painted.canvas = paintCanvas(painted.shapes, reader, fileTexts, pictures.src, display, swatches, refit)
    return painted.canvas.slide
  }
  return {
    count: read.length,
    sections: sectionStarts(display),
    canvases,
    boxes,
    movables,
    shapes: rows,
    pictures,
    files,
    numberText,
    base,
    display,
    repainted,
    from: parts,
    shared,
    slides,
  }
}
