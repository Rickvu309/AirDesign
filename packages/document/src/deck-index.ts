import { readBox, type Box } from "./box.js"
import { readElementId, shapeOf, type ElementId } from "./element-id.js"
import { bytesOf, limits } from "./limits.js"
import { onlyKeys, record } from "./plain-object.js"
import { kinds, type Kind } from "./properties.js"

export type IndexSlide = { readonly id: string; readonly position: number }
export type IndexElement = {
  readonly node: ElementId
  readonly kind: Kind
  readonly value: string | null
  readonly box: Box | null
  readonly grouped: boolean
}
export type IndexPage = {
  readonly once: string
  readonly offset: number
  readonly total: number
  readonly slides: readonly IndexSlide[]
  readonly elements: readonly IndexElement[]
}
export type DeckIndex = {
  readonly total: number
  readonly slides: readonly IndexSlide[]
  readonly elements: readonly IndexElement[]
  readonly pages: readonly { readonly once: string; readonly offset: number; readonly count: number }[]
}

const slidePattern = /^(?:[0-9]{1,10}|n[0-9a-z]{12})$/
const oncePattern = /^[A-Za-z0-9_-]{1,200}$/

function whole(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0
}

function openingText(raw: unknown): raw is string | null {
  if (raw === null) return true
  if (typeof raw !== "string" || bytesOf(raw) > limits.body) return false
  for (const symbol of raw) {
    const code = symbol.codePointAt(0) ?? 0
    if (code === 0 || (code >= 0xd800 && code <= 0xdfff)) return false
  }
  return true
}

function readSlide(raw: unknown, position: number): IndexSlide | null {
  const row = record(raw)
  if (row === null || !onlyKeys(row, ["id", "position"])) return null
  if (typeof row.id !== "string" || !slidePattern.test(row.id) || row.position !== position) return null
  return { id: row.id, position }
}

function readElement(raw: unknown, slides: ReadonlySet<string>): IndexElement | null {
  const row = record(raw)
  if (row === null || !onlyKeys(row, ["node", "kind", "value", "box", "grouped"])) return null
  const node = readElementId(row.node)
  if (node === undefined || !slides.has(shapeOf(node).slide) || typeof row.grouped !== "boolean") return null
  const kind = kinds.find((kind) => kind === row.kind)
  if (kind === undefined || !openingText(row.value)) return null
  const box = row.box === null ? null : readBox(row.box)
  if (row.box !== null && box === null) return null
  return { node, kind, value: row.value, box, grouped: row.grouped }
}

export function readIndexPage(raw: unknown): IndexPage | null {
  const row = record(raw)
  if (row === null || !onlyKeys(row, ["once", "offset", "total", "slides", "elements"])) return null
  if (typeof row.once !== "string" || !oncePattern.test(row.once)) return null
  if (!whole(row.offset) || !whole(row.total) || row.total > limits.elements || row.offset > row.total) return null
  if (!Array.isArray(row.slides) || row.slides.length < 1 || row.slides.length > limits.slides) return null
  const slides: IndexSlide[] = []
  for (const [position, raw] of row.slides.entries()) {
    const slide = readSlide(raw, position)
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
  return { once: row.once, offset: row.offset, total: row.total, slides, elements }
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

export function appendIndex(
  current: DeckIndex | undefined,
  page: IndexPage,
):
  | { readonly ok: true; readonly index: DeckIndex }
  | { readonly ok: false; readonly refusal: "present" | "stale" | "limit" } {
  if (readIndexPage(page) === null || bytesOf(JSON.stringify(page)) > limits.body)
    return { ok: false, refusal: "limit" }
  if (current !== undefined) {
    if (current.total !== page.total || !same(current.slides, page.slides)) return { ok: false, refusal: "present" }
    const prior = current.pages.find((kept) => kept.once === page.once)
    if (prior !== undefined && (prior.offset !== page.offset || prior.count !== page.elements.length)) {
      return { ok: false, refusal: "present" }
    }
    if (prior !== undefined || page.offset < current.elements.length || current.elements.length === current.total) {
      return same(current.elements.slice(page.offset, page.offset + page.elements.length), page.elements)
        ? { ok: true, index: current }
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
      total: page.total,
      slides: page.slides,
      elements: [...elements, ...page.elements],
      pages: [...(current?.pages ?? []), { once: page.once, offset: page.offset, count: page.elements.length }],
    },
  }
}
