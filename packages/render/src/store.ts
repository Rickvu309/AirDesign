import { kinds, overLimit } from "@airdesign/document"
import type { Box, ElementId, SlideId } from "@airdesign/document"
import { sameBox } from "./box-gesture.js"
import type { ElementRecord, SlideRecord } from "./record.js"
import { sameRows, type MeasuredRows } from "./table-rows.js"

export type PaintResult = { readonly ok: true } | { readonly ok: false; readonly code: "limit" | "absent" | "kind" }

export type BoxGrip = {
  readonly place: (box: Box | null) => void
  readonly keep: () => void
  readonly release: () => void
}

export type RotationGrip = {
  readonly place: (rotation: number | null) => void
  readonly keep: () => void
  readonly release: () => void
}

export type MeasuredFit = { readonly written: string; readonly scale: number; readonly reduction: number }

export type FitPainter = "canvas" | "thumbnail"

export type { MeasuredRows } from "./table-rows.js"

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
  readonly getBox: (id: ElementId) => Box | null
  readonly getRestingBox: (id: ElementId) => Box | null
  readonly placeBox: (id: ElementId, box: Box | null) => void
  readonly gripBox: (id: ElementId) => BoxGrip
  readonly getRotation: (id: ElementId) => number | null
  readonly placeRotation: (id: ElementId, rotation: number | null) => void
  readonly gripRotation: (id: ElementId) => RotationGrip
  readonly boxSubscribe: (id: ElementId) => (listener: () => void) => () => void
  readonly lay: (boxes: ReadonlyMap<ElementId, Box> | null) => void
  readonly getLaid: (id: ElementId) => Box | null
  readonly laidNow: () => ReadonlyMap<ElementId, Box> | null
  readonly placeFit: (id: ElementId, fit: MeasuredFit, painter: FitPainter) => void
  readonly getFit: (id: ElementId) => MeasuredFit | null
  readonly fits: () => ReadonlyMap<ElementId, MeasuredFit>
  readonly placeRows: (id: ElementId, rows: MeasuredRows | null) => void
  readonly getRows: (id: ElementId) => MeasuredRows | null
  readonly rows: () => ReadonlyMap<ElementId, MeasuredRows>
}

const accepted: PaintResult = Object.freeze({ ok: true })

function frozenBox(box: Box): Box {
  return Object.freeze({ x: box.x, y: box.y, cx: box.cx, cy: box.cy })
}

function copyRecord(record: ElementRecord): ElementRecord {
  return Object.freeze({
    id: record.id,
    kind: record.kind,
    text: record.text,
  })
}

function refuseRecord(record: ElementRecord): PaintResult | null {
  return kinds.includes(record.kind) ? null : { ok: false, code: "kind" }
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
  const boxes = new Map<ElementId, Box>()
  const boxListeners = new Map<ElementId, Set<() => void>>()
  let laid: ReadonlyMap<ElementId, Box> | null = null
  const boxSubscribeCache = new Map<ElementId, (listener: () => void) => () => void>()
  const gripped = new Map<ElementId, { held: Box | null }>()
  const rotations = new Map<ElementId, number>()
  const grippedRotations = new Map<ElementId, { held: number | null }>()
  const composing = new Set<ElementId>()
  const held = new Map<ElementId, ElementRecord[]>()
  const measured = new Map<ElementId, MeasuredFit & { readonly painter: FitPainter }>()
  const paintedRows = new Map<ElementId, MeasuredRows>()
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

  function showBox(id: ElementId, box: Box | null): void {
    if (sameBox(boxes.get(id) ?? null, box)) return
    if (box === null) boxes.delete(id)
    else boxes.set(id, frozenBox(box))
    notify(boxListeners, id)
  }

  function placeBox(id: ElementId, box: Box | null): void {
    const grip = gripped.get(id)
    if (grip === undefined) {
      showBox(id, box)
      return
    }
    if (sameBox(grip.held, box)) return
    grip.held = box === null ? null : frozenBox(box)
    notify(boxListeners, id)
  }

  function getRestingBox(id: ElementId): Box | null {
    const grip = gripped.get(id)
    return grip === undefined ? (boxes.get(id) ?? null) : grip.held
  }

  function gripBox(id: ElementId): BoxGrip {
    const grip = { held: boxes.get(id) ?? null }
    gripped.set(id, grip)
    function ended(): boolean {
      if (gripped.get(id) !== grip) return false
      gripped.delete(id)
      return true
    }
    return {
      place(box) {
        if (gripped.get(id) === grip) showBox(id, box)
      },
      keep() {
        if (ended() && !sameBox(grip.held, boxes.get(id) ?? null)) notify(boxListeners, id)
      },
      release() {
        if (ended()) showBox(id, grip.held)
      },
    }
  }

  function showRotation(id: ElementId, rotation: number | null): void {
    const current = rotations.get(id) ?? null
    if (current === rotation) return
    if (rotation === null) rotations.delete(id)
    else rotations.set(id, rotation)
    notify(boxListeners, id)
  }

  function placeRotation(id: ElementId, rotation: number | null): void {
    const grip = grippedRotations.get(id)
    if (grip === undefined) showRotation(id, rotation)
    else grip.held = rotation
  }

  function gripRotation(id: ElementId): RotationGrip {
    const grip = { held: rotations.get(id) ?? null }
    grippedRotations.set(id, grip)
    function ended(): boolean {
      if (grippedRotations.get(id) !== grip) return false
      grippedRotations.delete(id)
      return true
    }
    return {
      place(rotation) {
        if (grippedRotations.get(id) === grip) showRotation(id, rotation)
      },
      keep() {
        ended()
      },
      release() {
        if (ended()) showRotation(id, grip.held)
      },
    }
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
        commit({ id: current.id, kind: current.kind, text: data })
      }
      for (const record of queue) commit(record)
    },
    getBox: (id) => boxes.get(id) ?? null,
    getRestingBox,
    placeBox,
    gripBox,
    getRotation: (id) => rotations.get(id) ?? null,
    placeRotation,
    gripRotation,
    boxSubscribe: (id) => subscribeTo(boxListeners, boxSubscribeCache, id),
    lay: (next) => {
      const touched = new Set([...(laid?.keys() ?? []), ...(next?.keys() ?? [])])
      laid = next
      for (const id of touched) notify(boxListeners, id)
    },
    getLaid: (id) => laid?.get(id) ?? null,
    laidNow: () => laid,
    placeFit: (id, fit, painter) => {
      const kept = measured.get(id)
      if (painter === "thumbnail" && kept?.painter === "canvas" && kept.written === fit.written) return
      measured.set(id, { ...fit, painter })
    },
    getFit: (id) => {
      const kept = measured.get(id)
      return kept === undefined ? null : { written: kept.written, scale: kept.scale, reduction: kept.reduction }
    },
    fits: () =>
      new Map(
        [...measured].map(([id, kept]) => [
          id,
          { written: kept.written, scale: kept.scale, reduction: kept.reduction },
        ]),
      ),
    placeRows: (id, rows) => {
      if (sameRows(paintedRows.get(id) ?? null, rows)) return
      if (rows === null) paintedRows.delete(id)
      else paintedRows.set(id, rows)
      notify(boxListeners, id)
    },
    getRows: (id) => paintedRows.get(id) ?? null,
    rows: () => new Map(paintedRows),
  }
}
