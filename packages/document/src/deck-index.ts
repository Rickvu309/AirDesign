import { readBox, type Box } from "./box.js"
import {
  designKeys,
  readDesign,
  readKept,
  readPalette,
  readRole,
  roles,
  sources,
  type Design,
  type DesignKey,
  type Palette,
  type Role,
} from "./design.js"
import { readElementId, shapeOf, type ElementId } from "./element-id.js"
import { format } from "./format.js"
import { bytesOf, limits } from "./limits.js"
import { onlyKeys, record } from "./plain-object.js"
import { kinds, type Kind } from "./kinds.js"

export type SlideSize = { readonly width: number; readonly height: number }
export type IndexSlide = {
  readonly id: string
  readonly position: number
  readonly size?: SlideSize
  readonly free?: number
  readonly animated?: readonly string[]
  readonly layout?: readonly IndexElement[]
  readonly palette?: number
}
export type IndexElement = {
  readonly node: ElementId
  readonly kind: Kind
  readonly value: string | null
  readonly box: Box | null
  readonly grouped: boolean
  readonly role?: Role
  readonly design?: Design
  readonly kept?: readonly DesignKey[]
}
export type IndexPage = {
  readonly format?: number
  readonly once: string
  readonly offset: number
  readonly total: number
  readonly palettes?: readonly Palette[]
  readonly slides: readonly IndexSlide[]
  readonly elements: readonly IndexElement[]
}
type BuiltIndex = {
  readonly format?: number
  readonly total: number
  readonly palettes?: readonly Palette[]
  readonly slides: readonly IndexSlide[]
  readonly elements: readonly IndexElement[]
  readonly pages: readonly { readonly once: string; readonly offset: number; readonly count: number }[]
}
export type DeckIndex = BuiltIndex & { readonly next?: BuiltIndex }

export const indexKeys = {
  page: ["format", "once", "offset", "total", "palettes", "slides", "elements"],
  slide: ["id", "position", "size", "free", "animated", "layout", "palette"],
  element: ["node", "kind", "value", "box", "grouped", "role", "design", "kept"],
  design: designKeys,
  roles,
  sources,
} as const

const paletteLimit = 16

const slidePattern = /^(?:[0-9]{1,10}|n[0-9a-z]{12})$/
const unwritable = /[\u0000\p{Cs}]/u
const oncePattern = /^[A-Za-z0-9_-]{1,200}$/

function whole(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0
}

function openingText(raw: unknown): raw is string | null {
  if (raw === null) return true
  if (typeof raw !== "string" || bytesOf(raw) > limits.body) return false
  return !unwritable.test(raw)
}

function readSize(raw: unknown): SlideSize | null {
  const row = record(raw)
  if (row === null || !onlyKeys(row, ["width", "height"])) return null
  const { width, height } = row
  if (typeof width !== "number" || !Number.isSafeInteger(width) || width < 1) return null
  if (typeof height !== "number" || !Number.isSafeInteger(height) || height < 1) return null
  return { width, height }
}

function readAnimated(raw: unknown): readonly string[] | null {
  if (!Array.isArray(raw) || raw.length > limits.batch) return null
  const shapes: string[] = []
  for (const shape of raw) {
    if (typeof shape !== "string" || !/^[0-9]{1,10}$/.test(shape) || shapes.includes(shape)) return null
    shapes.push(shape)
  }
  return shapes
}

const slideKeys: readonly string[] = indexKeys.slide

function readFree(raw: unknown): number | null {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 1 && raw <= 4294967295 ? raw : null
}

function readMeasures(row: Record<string, unknown>): Pick<IndexSlide, "size" | "free" | "animated"> | null {
  const size = row.size === undefined ? null : readSize(row.size)
  const free = row.free === undefined ? null : readFree(row.free)
  const animated = row.animated === undefined ? null : readAnimated(row.animated)
  if ((row.size !== undefined && size === null) || (row.free !== undefined && free === null)) return null
  if (row.animated !== undefined && animated === null) return null
  return {
    ...(size === null ? {} : { size }),
    ...(free === null ? {} : { free }),
    ...(animated === null ? {} : { animated }),
  }
}

function readSlide(raw: unknown, position: number, palettes: number): IndexSlide | null {
  const row = record(raw)
  if (row === null) return null
  const keys = slideKeys.filter((key) => key === "id" || key === "position" || row[key] !== undefined)
  if (!onlyKeys(row, keys)) return null
  if (typeof row.id !== "string" || !slidePattern.test(row.id) || row.position !== position) return null
  const read = readMeasures(row)
  if (read === null) return null
  if (row.palette !== undefined && (!whole(row.palette) || row.palette >= palettes)) return null
  const measures = row.palette === undefined ? read : { ...read, palette: row.palette }
  if (row.layout === undefined) return { id: row.id, position, ...measures }
  if (!Array.isArray(row.layout) || row.layout.length > limits.batch) return null
  const layout: IndexElement[] = []
  for (const raw of row.layout) {
    const element = readElement(raw, new Set([row.id]))
    if (element === null || layout.some((kept) => kept.node === element.node)) return null
    layout.push(element)
  }
  return { id: row.id, position, ...measures, layout }
}

const elementKeys: readonly string[] = indexKeys.element
const openingKeys = 5

function readDerived(row: Record<string, unknown>): Pick<IndexElement, "role" | "design" | "kept"> | null {
  const role = row.role === undefined ? undefined : readRole(row.role)
  const design = row.design === undefined ? undefined : readDesign(row.design)
  const kept = row.kept === undefined ? undefined : readKept(row.kept)
  if (design === null || kept === null || (row.role !== undefined && role === undefined)) return null
  return {
    ...(role === undefined ? {} : { role }),
    ...(design === undefined ? {} : { design }),
    ...(kept === undefined ? {} : { kept }),
  }
}

export function readElement(raw: unknown, slides: ReadonlySet<string>): IndexElement | null {
  const row = record(raw)
  if (row === null) return null
  const keys = elementKeys.filter((key, at) => at < openingKeys || row[key] !== undefined)
  if (!onlyKeys(row, keys)) return null
  const node = readElementId(row.node)
  if (node === undefined || !slides.has(shapeOf(node).slide) || typeof row.grouped !== "boolean") return null
  const kind = kinds.find((kind) => kind === row.kind)
  if (kind === undefined || !openingText(row.value)) return null
  const box = row.box === null ? null : readBox(row.box)
  if (row.box !== null && box === null) return null
  const derived = readDerived(row)
  if (derived === null) return null
  return { node, kind, value: row.value, box, grouped: row.grouped, ...derived }
}

function readPalettes(raw: unknown): readonly Palette[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > paletteLimit) return null
  const palettes: Palette[] = []
  for (const item of raw) {
    const palette = readPalette(item)
    if (palette === null) return null
    palettes.push(palette)
  }
  return palettes
}

const pageKeys: readonly string[] = indexKeys.page

export function readIndexPage(raw: unknown): IndexPage | null {
  const row = record(raw)
  if (row === null) return null
  if (
    !onlyKeys(
      row,
      pageKeys.filter((key) => (key !== "format" && key !== "palettes") || row[key] !== undefined),
    )
  )
    return null
  if (row.format !== undefined && (!whole(row.format) || row.format < 1 || row.format > format)) return null
  const palettes = row.palettes === undefined ? undefined : readPalettes(row.palettes)
  if (palettes === null) return null
  if (typeof row.once !== "string" || !oncePattern.test(row.once)) return null
  if (!whole(row.offset) || !whole(row.total) || row.total > limits.elements || row.offset > row.total) return null
  if (!Array.isArray(row.slides) || row.slides.length < 1 || row.slides.length > limits.slides) return null
  const slides: IndexSlide[] = []
  for (const [position, raw] of row.slides.entries()) {
    const slide = readSlide(raw, position, palettes?.length ?? 0)
    if (slide === null || slides.some((kept) => kept.id === slide.id)) return null
    slides.push(slide)
  }
  if (!Array.isArray(row.elements) || row.elements.length > limits.batch) return null
  if (row.elements.length === 0 && (row.total !== 0 || row.offset !== 0)) return null
  if (row.offset + row.elements.length > row.total) return null
  const ids = new Set(slides.map((slide) => slide.id))
  const elements: IndexElement[] = []
  for (const raw of row.elements) {
    const element = readElement(raw, ids)
    if (element === null || elements.some((kept) => kept.node === element.node)) return null
    elements.push(element)
  }
  return {
    ...(row.format === undefined ? {} : { format: row.format }),
    once: row.once,
    offset: row.offset,
    total: row.total,
    ...(palettes === undefined ? {} : { palettes }),
    slides,
    elements,
  }
}

function same(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, n) => same(item, right[n]))
  }
  const a = record(left)
  const b = record(right)
  if (a === null || b === null) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]))
}

function sameOpening(stored: readonly IndexElement[], sent: readonly IndexElement[]): boolean {
  return stored.every((element, at) => {
    const other = sent[at]
    return (
      other !== undefined &&
      other.node === element.node &&
      other.kind === element.kind &&
      other.value === element.value &&
      other.grouped === element.grouped &&
      same(other.box, element.box)
    )
  })
}

type Appended =
  | { readonly ok: true; readonly index: DeckIndex }
  | { readonly ok: false; readonly refusal: "present" | "stale" | "limit" }

function buildBeside(current: DeckIndex, page: IndexPage, pageFormat: number): Appended {
  if (current.total !== page.total || !same(slideOrder(current.slides), slideOrder(page.slides)))
    return { ok: false, refusal: "present" }
  const opening = current.elements.slice(page.offset, page.offset + page.elements.length)
  if (!sameOpening(opening, page.elements)) return { ok: false, refusal: "present" }
  const { next, ...stored } = current
  const built = appendBuilt((next?.format ?? 1) === pageFormat ? next : undefined, page)
  if (!built.ok) return built
  if (built.index === next) return { ok: true, index: current }
  if (built.index.elements.length < built.index.total) return { ok: true, index: { ...stored, next: built.index } }
  return { ok: true, index: built.index }
}

export function appendIndex(current: DeckIndex | undefined, page: IndexPage): Appended {
  if (readIndexPage(page) === null || bytesOf(JSON.stringify(page)) > limits.body)
    return { ok: false, refusal: "limit" }
  const pageFormat = page.format ?? 1
  const storedFormat = current?.format ?? 1
  if (current !== undefined && pageFormat > storedFormat) return buildBeside(current, page, pageFormat)
  if (current !== undefined && pageFormat < storedFormat) return { ok: false, refusal: "present" }
  const built = appendBuilt(current, page)
  if (!built.ok || current?.next === undefined || built.index === current) return built
  return { ok: true, index: { ...built.index, next: current.next } }
}

const slideOrder = (slides: readonly IndexSlide[]) => slides.map(({ id, position }) => ({ id, position }))

function appendBuilt(current: BuiltIndex | undefined, page: IndexPage): Appended {
  if (current !== undefined) {
    if (current.total !== page.total || !same(slideOrder(current.slides), slideOrder(page.slides)))
      return { ok: false, refusal: "present" }
    const prior = current.pages.find((kept) => kept.once === page.once)
    if (prior !== undefined && (prior.offset !== page.offset || prior.count !== page.elements.length)) {
      return { ok: false, refusal: "present" }
    }
    if (prior !== undefined || page.offset < current.elements.length || current.elements.length === current.total) {
      return same(current.elements.slice(page.offset, page.offset + page.elements.length), page.elements)
        ? {
            ok: true,
            index: same(current.slides, page.slides)
              ? current
              : {
                  ...current,
                  slides: page.slides.map((slide, n) =>
                    slide.layout === undefined && slide.free === undefined ? (current.slides[n] ?? slide) : slide,
                  ),
                },
          }
        : { ok: false, refusal: "present" }
    }
  }
  const elements = current?.elements ?? []
  if (page.offset !== elements.length) return { ok: false, refusal: "stale" }
  if (page.elements.some((row) => elements.some((kept) => kept.node === row.node)))
    return { ok: false, refusal: "present" }
  return {
    ok: true,
    index: {
      ...(page.format === undefined ? {} : { format: page.format }),
      total: page.total,
      ...(page.palettes === undefined ? {} : { palettes: page.palettes }),
      slides: page.slides,
      elements: [...elements, ...page.elements],
      pages: [...(current?.pages ?? []), { once: page.once, offset: page.offset, count: page.elements.length }],
    },
  }
}

export function indexDue(stored: DeckIndex | undefined): boolean {
  return stored === undefined || stored.elements.length !== stored.total || (stored.format ?? 1) < format
}

type Rowed = { readonly landed: readonly { readonly v?: number }[] }

function rowFormat(elements: Readonly<Partial<Record<string, Rowed>>>): number {
  let highest = 1
  for (const body of Object.values(elements))
    for (const row of body?.landed ?? []) highest = Math.max(highest, row.v ?? 1)
  return highest
}

export function answeredRegister<
  Stored extends { readonly index?: DeckIndex; readonly elements: Readonly<Partial<Record<string, Rowed>>> },
>(register: Stored): Stored & { readonly format?: number } {
  const rows = rowFormat(register.elements)
  if (register.index === undefined) return rows > 1 ? { ...register, format: rows } : register
  const { next, ...index } = register.index
  const stored = Math.max(index.format ?? 1, next?.format ?? 1, rows)
  return { ...register, index, ...(stored > 1 ? { format: stored } : {}) }
}
