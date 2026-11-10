import { kinds, overLimit } from "@airdesign/document"
import type { ElementId, SlideId } from "./brand.js"
import type { ElementRecord, SlideRecord } from "./record.js"

export type PaintResult = { readonly ok: true } | { readonly ok: false; readonly code: "limit" | "absent" | "kind" }

export type PaintStore = {
  readonly getElement: (id: ElementId) => ElementRecord | null
  readonly publish: (record: ElementRecord) => PaintResult
  readonly setSlides: (next: readonly SlideRecord[]) => PaintResult
  readonly slides: () => readonly SlideRecord[]
  readonly getSlide: (id: SlideId) => SlideRecord | null
  readonly elementSubscribe: (id: ElementId) => (listener: () => void) => () => void
  readonly slideSubscribe: (id: SlideId) => (listener: () => void) => () => void
  readonly beginComposition: (id: ElementId) => void
  readonly endComposition: (id: ElementId, data: string) => void
}

const accepted: PaintResult = Object.freeze({ ok: true })

function copyRecord(record: ElementRecord): ElementRecord {
  return Object.freeze({
    id: record.id,
    kind: record.kind,
    text: record.text,
    picture: record.picture,
  })
}

function refuseRecord(record: ElementRecord): PaintResult | null {
  if (!kinds.includes(record.kind)) return { ok: false, code: "kind" }
  if (record.kind === "picture") {
    if (record.picture === null) return { ok: false, code: "kind" }
    return null
  }
  if (record.picture !== null) return { ok: false, code: "kind" }
  return null
}

function copySlide(slide: SlideRecord): SlideRecord {
  return Object.freeze({
    id: slide.id,
    elements: Object.freeze(slide.elements.slice()),
  })
}

function sameElements(left: readonly ElementId[], right: readonly ElementId[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function sameSlide(left: SlideRecord, right: SlideRecord): boolean {
  return left.id === right.id && sameElements(left.elements, right.elements)
}

function sameSlides(left: readonly SlideRecord[], right: readonly SlideRecord[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const current = left[index]
    const next = right[index]
    if (current === undefined || next === undefined || !sameSlide(current, next)) return false
  }
  return true
}

function subscribeTo<Id>(
  listeners: Map<Id, Set<() => void>>,
  cache: Map<Id, (listener: () => void) => () => void>,
  id: Id,
): (listener: () => void) => () => void {
  const cached = cache.get(id)
  if (cached !== undefined) return cached
  const subscribe = (listener: () => void) => {
    const existing = listeners.get(id)
    const bucket = existing ?? new Set<() => void>()
    if (existing === undefined) listeners.set(id, bucket)
    bucket.add(listener)
    return () => {
      bucket.delete(listener)
    }
  }
  cache.set(id, subscribe)
  return subscribe
}

function notify<Id>(listeners: Map<Id, Set<() => void>>, id: Id): void {
  const bucket = listeners.get(id)
  if (bucket === undefined) return
  for (const listener of Array.from(bucket)) listener()
}

export function paintStore(): PaintStore {
  const elements = new Map<ElementId, ElementRecord>()
  const elementListeners = new Map<ElementId, Set<() => void>>()
  const elementSubscribeCache = new Map<ElementId, (listener: () => void) => () => void>()
  const slideListeners = new Map<SlideId, Set<() => void>>()
  const slideSubscribeCache = new Map<SlideId, (listener: () => void) => () => void>()
  const composing = new Set<ElementId>()
  const held = new Map<ElementId, ElementRecord[]>()
  let slideList: readonly SlideRecord[] = Object.freeze([])
  let slidesById = new Map<SlideId, SlideRecord>()

  function commit(record: ElementRecord): void {
    elements.set(record.id, copyRecord(record))
    notify(elementListeners, record.id)
  }

  function publish(record: ElementRecord): PaintResult {
    const refusal = refuseRecord(record)
    if (refusal !== null) return refusal
    if (composing.has(record.id)) {
      const queue = held.get(record.id) ?? []
      queue.push(copyRecord(record))
      held.set(record.id, queue)
      return accepted
    }
    commit(record)
    return accepted
  }

  function setSlides(next: readonly SlideRecord[]): PaintResult {
    if (overLimit({ decks: 1, slides: next.length, bytes: 0 })) return { ok: false, code: "limit" }
    for (const slide of next) {
      for (const id of slide.elements) {
        if (!elements.has(id)) return { ok: false, code: "absent" }
      }
    }
    if (sameSlides(slideList, next)) return accepted
    const previous = slidesById
    const nextById = new Map<SlideId, SlideRecord>()
    const nextList: SlideRecord[] = []
    for (const slide of next) {
      const existing = previous.get(slide.id)
      const record = existing !== undefined && sameSlide(existing, slide) ? existing : copySlide(slide)
      nextList.push(record)
      nextById.set(slide.id, record)
    }
    const changed: SlideId[] = []
    for (const [id, record] of nextById) {
      if (previous.get(id) !== record) changed.push(id)
    }
    for (const id of previous.keys()) {
      if (!nextById.has(id)) changed.push(id)
    }
    slideList = Object.freeze(nextList)
    slidesById = nextById
    for (const id of changed) notify(slideListeners, id)
    return accepted
  }

  return {
    getElement: (id) => elements.get(id) ?? null,
    publish,
    setSlides,
    slides: () => slideList,
    getSlide: (id) => slidesById.get(id) ?? null,
    elementSubscribe: (id) => subscribeTo(elementListeners, elementSubscribeCache, id),
    slideSubscribe: (id) => subscribeTo(slideListeners, slideSubscribeCache, id),
    beginComposition: (id) => {
      composing.add(id)
      if (!held.has(id)) held.set(id, [])
    },
    endComposition: (id, data) => {
      const current = elements.get(id) ?? null
      const queue = held.get(id) ?? []
      composing.delete(id)
      held.delete(id)
      if (current !== null) {
        commit({ id: current.id, kind: current.kind, text: data, picture: current.picture })
      }
      for (const record of queue) commit(record)
    },
  }
}
