import type { Box } from "./box.js"
import type { SlideSize } from "./deck-index.js"
import { shapeOf, type ElementId, type SlideId } from "./element-id.js"

type Loose = Readonly<Record<string, unknown>>
type Spot = { readonly x: number; readonly y: number }
type Frame = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
type PlaceView = { readonly node: ElementId; readonly box: Box | null; readonly placed?: Box }

function boxed(box: Box, input: Loose): Box {
  const x = typeof input.x === "number" ? input.x : box.x
  const y = typeof input.y === "number" ? input.y : box.y
  const cx = typeof input.w === "number" ? input.w : box.cx
  const cy = typeof input.h === "number" ? input.h : box.cy
  return { x, y, cx, cy }
}

function boundsOf(boxes: readonly Box[]): Frame {
  const left = Math.min(...boxes.map((box) => box.x))
  const top = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.cx))
  const bottom = Math.max(...boxes.map((box) => box.y + box.cy))
  return { x: left, y: top, w: right - left, h: bottom - top }
}

function alignedBox(box: Box, frame: Frame, align: string): Box {
  const across = (from: number, room: number, size: number, at: number) => Math.round(from + ((room - size) * at) / 2)
  if (align === "left") return { ...box, x: frame.x }
  if (align === "center") return { ...box, x: across(frame.x, frame.w, box.cx, 1) }
  if (align === "right") return { ...box, x: across(frame.x, frame.w, box.cx, 2) }
  if (align === "top") return { ...box, y: frame.y }
  if (align === "middle") return { ...box, y: across(frame.y, frame.h, box.cy, 1) }
  return { ...box, y: across(frame.y, frame.h, box.cy, 2) }
}

function distributedBoxes(boxes: readonly Box[], frame: Frame, across: boolean): readonly Box[] {
  const start = (box: Box) => (across ? box.x : box.y)
  const length = (box: Box) => (across ? box.cx : box.cy)
  const order = boxes.map((box, at) => ({ box, at })).sort((left, right) => start(left.box) - start(right.box))
  const room = across ? frame.w : frame.h
  const used = boxes.reduce((sum, box) => sum + length(box), 0)
  const lone = boxes.length === 1
  const gap = (room - used) / (lone ? 2 : boxes.length - 1)
  const next: Box[] = [...boxes]
  let cursor = (across ? frame.x : frame.y) + (lone ? gap : 0)
  for (const { box, at } of order) {
    const spot = Math.round(cursor)
    next[at] = across ? { ...box, x: spot } : { ...box, y: spot }
    cursor += length(box) + gap
  }
  return next
}

function slideFrame(size: SlideSize): Frame {
  return { x: 0, y: 0, w: size.width, h: size.height }
}

export function placements(
  input: Loose | undefined,
  views: readonly PlaceView[],
  size: (slide: SlideId) => SlideSize | null,
): ReadonlyMap<ElementId, Spot> {
  const placed = new Map<ElementId, Spot>()
  const align = typeof input?.align === "string" ? input.align : undefined
  const distribute = typeof input?.distribute === "string" ? input.distribute : undefined
  if (input === undefined || (align === undefined && distribute === undefined)) return placed
  const slides = new Map<string, PlaceView[]>()
  for (const view of views) {
    if ((view.box ?? view.placed) === undefined) continue
    const slide = shapeOf(view.node).slide
    slides.set(slide, [...(slides.get(slide) ?? []), view])
  }
  for (const [slide, group] of slides) {
    const slideSize = size(slide as SlideId)
    let boxes: readonly Box[] = group.map((view) => boxed((view.box ?? view.placed) as Box, input))
    const frame = boxes.length > 1 ? boundsOf(boxes) : slideSize === null ? null : slideFrame(slideSize)
    if (frame === null) continue
    if (align !== undefined) boxes = boxes.map((box) => alignedBox(box, frame, align))
    if (distribute !== undefined) boxes = distributedBoxes(boxes, frame, distribute === "horizontal")
    group.forEach((view, at) => {
      const box = boxes[at]
      if (box !== undefined) placed.set(view.node, { x: box.x, y: box.y })
    })
  }
  return placed
}
