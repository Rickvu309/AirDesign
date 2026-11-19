import type { ElementId } from "@airdesign/document"
import { travelled, type Point } from "./box-gesture.js"
import type { CanvasElement, CanvasSlide, PaintBox } from "./record.js"
import { noSelection, parentOf, selectionOf, type Selection } from "./selection.js"

export type MarqueeRect = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export type MarqueeOptions = {
  readonly deep: boolean
  readonly resolveBox?: (element: CanvasElement) => PaintBox | null
}

const degreesToRadians = Math.PI / 180

export function marqueeRect(start: Point, end: Point): MarqueeRect {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  }
}

export function marqueeMoved(start: Point, end: Point): boolean {
  return travelled(start, end)
}

export function boxIntersectsRect(box: PaintBox, rect: MarqueeRect): boolean {
  const turn = box.rotation % 360
  if (turn === 0) {
    return (
      rect.left <= box.x + box.width && rect.right >= box.x && rect.top <= box.y + box.height && rect.bottom >= box.y
    )
  }
  const radians = turn * degreesToRadians
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const absCos = Math.abs(cos)
  const absSin = Math.abs(sin)
  const hw = box.width / 2
  const hh = box.height / 2
  const rhw = (rect.right - rect.left) / 2
  const rhh = (rect.bottom - rect.top) / 2
  const dx = (rect.left + rect.right) / 2 - (box.x + hw)
  const dy = (rect.top + rect.bottom) / 2 - (box.y + hh)
  if (Math.abs(dx) > rhw + hw * absCos + hh * absSin) return false
  if (Math.abs(dy) > rhh + hw * absSin + hh * absCos) return false
  if (Math.abs(dx * cos + dy * sin) > hw + rhw * absCos + rhh * absSin) return false
  return Math.abs(-dx * sin + dy * cos) <= hh + rhw * absSin + rhh * absCos
}

function outermostUnit(slide: CanvasSlide, present: ReadonlySet<ElementId>, id: ElementId): ElementId {
  let unit = id
  for (let parent = parentOf(slide, unit); parent !== null && present.has(parent); parent = parentOf(slide, unit)) {
    unit = parent
  }
  return unit
}

function containerIds(slide: CanvasSlide): ReadonlySet<ElementId> {
  const containers = new Set<ElementId>()
  for (const each of slide.elements) {
    if (each.id === null || each.backdrop === true || each.group === undefined) continue
    containers.add(each.group.id)
  }
  return containers
}

function lockedIds(slide: CanvasSlide): ReadonlySet<ElementId> {
  return new Set(slide.elements.flatMap((each) => (each.id !== null && each.locked === true ? [each.id] : [])))
}

export function marqueeHits(slide: CanvasSlide, rect: MarqueeRect, options: MarqueeOptions): readonly ElementId[] {
  const resolveBox = options.resolveBox ?? ((element: CanvasElement) => element.box)
  const locked = lockedIds(slide)
  if (options.deep) {
    const containers = containerIds(slide)
    const hits: ElementId[] = []
    for (const each of slide.elements) {
      if (each.id === null || each.backdrop === true || locked.has(each.id)) continue
      if (each.kind === "group" && containers.has(each.id)) continue
      const box = resolveBox(each)
      if (box !== null && boxIntersectsRect(box, rect)) hits.push(each.id)
    }
    return hits
  }
  const present = new Set(slide.elements.flatMap((each) => (each.id === null ? [] : [each.id])))
  const touched = new Set<ElementId>()
  for (const each of slide.elements) {
    if (each.id === null || each.backdrop === true || locked.has(each.id)) continue
    const unit = outermostUnit(slide, present, each.id)
    if (touched.has(unit) || locked.has(unit)) continue
    const box = resolveBox(each)
    if (box !== null && boxIntersectsRect(box, rect)) touched.add(unit)
  }
  const ordered: ElementId[] = []
  for (const each of slide.elements) {
    if (each.id !== null && touched.has(each.id)) ordered.push(each.id)
  }
  return ordered
}

export function marqueeSelection(
  slide: CanvasSlide,
  before: Selection,
  hits: readonly ElementId[],
  adding: boolean,
): Selection {
  if (adding) {
    const extra = hits.filter((id) => !before.ids.includes(id))
    if (extra.length === 0) return before
    return selectionOf(slide, [...before.ids, ...extra])
  }
  if (hits.length === 0) return noSelection
  return selectionOf(slide, hits)
}
