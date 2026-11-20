import { imageTexts } from "@/patch-images"
import {
  currentBox,
  rebasedGroups,
  slideId,
  type Box,
  type ElementId,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { paintReader, readShapes, readSlides, slideNumbering, themeSwatches, type ReadShape } from "@airdesign/pptx"
import type { ElementRecord, PaintStore } from "@airdesign/render"
import type { SlideCanvases } from "@/canvas-slide"
import type { StripGroup } from "@/editor/slide-sidebar"
import { stripGroups } from "@/strip-groups"
import type { TextBox } from "@/commit-edit"
import { landedBox } from "@/element-move"
import { editedParts, newSlideElement, writtenBase, type PictureBytes } from "@/exported-parts"
import { framedOf } from "@/frame-boxes"
import { movableInGroups } from "@/group-boxes"
import { indexedRegister } from "@/indexed-register"
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

type PaintedSlide = {
  readonly shapes: SlideShapes
  readonly values: string
  readonly framed: string
  canvas: PaintedCanvas | null
}

export type Painted = {
  readonly count: number
  readonly groups: readonly StripGroup[]
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
  readonly leftOut: readonly SlideCommand[]
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
  return current !== null && current.kind === next.kind && current.text === next.text
}

function laidOut(register: Register | null, id: ElementId): boolean {
  const rows = register?.elements[id]?.landed ?? []
  return rows.some((row) => row.visible && row.v !== undefined && (row.patch.body ?? row.patch.text) !== undefined)
}

function sizeChanged(register: Register): boolean {
  return register.nodes.some((node) => {
    const body = register.elements[node]
    const floor = body?.floorBox
    if (body === undefined || floor === undefined) return false
    const box = currentBox(body)
    return box !== null && (box.cx !== floor.cx || box.cy !== floor.cy)
  })
}

const rememberedFloors = new WeakMap<Parts, ReadonlyMap<string, Box>>()

function fileFloors(parts: Parts): ReadonlyMap<string, Box> {
  const remembered = rememberedFloors.get(parts)
  if (remembered !== undefined) return remembered
  const floors = new Map<string, Box>()
  for (const shape of readShapes(parts)) {
    if (shape.box !== null) floors.set(`${shape.slide}.${shape.shape}`, shape.box)
  }
  rememberedFloors.set(parts, floors)
  return floors
}

export function withFileFloors(register: Register, parts: Parts): Register {
  const missing = register.nodes.filter((node) => {
    const body = register.elements[node]
    return body !== undefined && body.floorBox === undefined && landedBox(register, node) !== null
  })
  if (missing.length === 0) return register
  const floors = fileFloors(parts)
  const elements = missing.reduce((elements, node) => {
    const floor = floors.get(node)
    const body = elements[node]
    if (floor === undefined || body === undefined) return elements
    return { ...elements, [node]: { ...body, floorBox: floor } }
  }, register.elements)
  return elements === register.elements ? register : { ...register, elements }
}

function addedLayer(register: Register | null, id: ElementId): boolean {
  return (
    register?.order.some(
      (command) => command.slide === "element-add" && command.element.node === id && command.pasted === undefined,
    ) === true
  )
}

function refitted(register: Register | null, { id, file, opening }: SlideShape): boolean {
  const box = landedBox(register, id)
  const resized = box !== null && (box.cx !== opening?.cx || box.cy !== opening?.cy)
  if (resized || laidOut(register, id) || newSlideElement(register, id) !== undefined || addedLayer(register, id))
    return true
  return shownValue(register, id, file) !== file
}

function shownOf(register: Register | null, id: ElementId, text: string): string {
  return JSON.stringify([text, landedBox(register, id)])
}

const stylePart = /^ppt\/theme\/theme\d+\.xml$/

function changedStyleParts(base: Parts, display: Parts): Parts {
  const shown = [...display].filter(([name, bytes]) => stylePart.test(name) && base.get(name) !== bytes)
  return shown.length === 0 ? base : new Map([...base, ...shown])
}

export function paint(
  store: PaintStore,
  parts: Parts,
  given: Register | null,
  busy: BusyElements,
  pictureBytes: PictureBytes = new Map(),
  previous: Painted | null = null,
): Painted {
  const earlier = previous?.from === parts ? previous : null
  const written = given === null ? null : writtenBase(parts, given, pictureBytes)
  const register = written?.register ?? null
  const base = sameIdentity(written?.parts ?? parts, earlier?.base)
  const floored = register === null ? null : withFileFloors(register, base)
  const cover = floored !== null && sizeChanged(floored)
  const edited =
    floored !== null &&
    (floored.order.length > 0 ||
      tableEdited(floored) ||
      designRows(floored).length > 0 ||
      imageTexts(floored).length > 0 ||
      cover ||
      rebasedGroups(indexedRegister(parts, floored)).length > 0)
      ? editedParts(base, indexedRegister(parts, floored), pictureBytes)
      : base
  const display = sameIdentity(edited, earlier?.display)
  const read = readSlides(display)
  const numberText = numberedText(slideNumbering(display))
  const slideParts = new Set(read.map((each) => each.part))
  const shared = sharedParts(display, slideParts)
  const reusable = earlier !== null && sameShared(shared, earlier.shared, slideParts)
  const before = new Map(reusable ? earlier.slides.map((each) => [each.shapes.part, each]) : [])
  const repainted: SlideId[] = []
  const laid = register === null ? null : indexedRegister(parts, register)
  const framed = framedOf(laid)
  const inGroups = movableInGroups(laid)
  const placed = { has: (id: ElementId) => framed.children.has(id) || inGroups.has(id) }
  const placedKey = `${framed.key}|${[...inGroups].join(",")}`
  const slides = read.map(({ slide, part }): PaintedSlide => {
    const old = before.get(part)
    const same = old !== undefined && old.framed === placedKey && sameSlide(old.shapes, slide, base, display)
    const shapes = same ? old.shapes : slideShapes(shared, slide, part, base, display, placed)
    const values = shapes.shapes
      .map(({ id, file }) => shownOf(laid, id, numberText(id, shownValue(register, id, file))))
      .join("\n")
    if (same && old.values === values && old.canvas !== null && sameMedia(old.canvas, display))
      return { shapes, values, framed: placedKey, canvas: old.canvas }
    if (!same || old.values !== values) repainted.push(slideId(slide))
    return { shapes, values, framed: placedKey, canvas: null }
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
      }
      if (!sameRecord(current, record)) store.publish(record)
      store.placeBox(id, landedBox(laid, id))
      store.placeRotation(id, null)
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
    const fileTexts = () => (texts ??= paintReader(changedStyleParts(base, display), { fallbackPrompt }))
    const swatches = themeSwatches(display, painted.shapes.part)
    const refit = new Set(painted.shapes.shapes.filter((shape) => refitted(laid, shape)).map((shape) => shape.id))
    painted.canvas = paintCanvas(painted.shapes, reader, fileTexts, pictures.src, display, swatches, refit, framed)
    return painted.canvas.slide
  }
  return {
    count: read.length,
    groups: stripGroups(parts, register),
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
    leftOut: written?.leftOut ?? [],
  }
}
