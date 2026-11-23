import type * as doom from "@airdesign/doom"

type Box = Pick<doom.Box, "x" | "y" | "w" | "h">

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

type Point = { readonly x: number; readonly y: number }

type Edge = "top" | "right" | "bottom" | "left"

export type ResizeGrip = Corner | Edge

export type RotateGrip = `rotate-${Corner}`

export type TransformGrip = "move" | ResizeGrip | RotateGrip

type ResizeModifiers = {
  readonly keepRatio: boolean
  readonly fromCenter: boolean
}

export type RotatedLayer = {
  readonly box: Box
  readonly rotation: number
}

export type FlippableLayer = RotatedLayer & {
  readonly flipH: boolean
  readonly flipV: boolean
}

type FlipAxis = "horizontal" | "vertical"

type FlippedLayer<K> = {
  readonly id: K
  readonly box?: Box
  readonly rotation?: number
  readonly flipH?: boolean
  readonly flipV?: boolean
}

type SelectionResize<K> = {
  readonly frame: Box
  readonly boxes: ReadonlyMap<K, Box>
}

const snapDegrees = 15

const handleAngle: Readonly<Record<ResizeGrip, number>> = {
  right: 0,
  "bottom-right": 45,
  bottom: 90,
  "bottom-left": 135,
  left: 180,
  "top-left": 225,
  top: 270,
  "top-right": 315,
}

const resizeCursors = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"] as const

const rotateCornerOffset: Readonly<Record<Corner, number>> = {
  "top-right": 0,
  "bottom-right": 90,
  "bottom-left": 180,
  "top-left": 270,
}

export function normalizeDegrees(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360
  return wrapped === 0 || wrapped === 360 ? 0 : wrapped
}

function rotatePoint(point: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos }
}

function gripSigns(grip: ResizeGrip): { readonly sx: -1 | 0 | 1; readonly sy: -1 | 0 | 1 } {
  const sx = grip.includes("left") ? -1 : grip.includes("right") ? 1 : 0
  const sy = grip.includes("top") ? -1 : grip.includes("bottom") ? 1 : 0
  return { sx, sy }
}

function clampedSide(size: number, delta: number): number {
  return Math.max(size + delta, 0)
}

function constrainedSize(
  start: Box,
  freeW: number,
  freeH: number,
  sx: -1 | 0 | 1,
  sy: -1 | 0 | 1,
): { readonly w: number; readonly h: number } {
  if (start.w <= 0 || start.h <= 0) return { w: freeW, h: freeH }
  const across = freeW / start.w
  const down = freeH / start.h
  const chosen =
    sx !== 0 && sy !== 0 ? (Math.abs(across - 1) >= Math.abs(down - 1) ? across : down) : sx !== 0 ? across : down
  const scale = Math.max(chosen, 0)
  return { w: Math.round(start.w * scale), h: Math.round(start.h * scale) }
}

export function resizeBox(
  start: Box,
  grip: ResizeGrip,
  dx: number,
  dy: number,
  modifiers: ResizeModifiers,
  rotation = 0,
): Box {
  const own = rotation === 0 ? { x: dx, y: dy } : rotatePoint({ x: dx, y: dy }, -rotation)
  const ldx = Math.round(own.x)
  const ldy = Math.round(own.y)
  const { sx, sy } = gripSigns(grip)
  const factor = modifiers.fromCenter ? 2 : 1
  const freeW = sx === 0 ? start.w : clampedSide(start.w, sx * ldx * factor)
  const freeH = sy === 0 ? start.h : clampedSide(start.h, sy * ldy * factor)
  const { w, h } = modifiers.keepRatio ? constrainedSize(start, freeW, freeH, sx, sy) : { w: freeW, h: freeH }
  const ax = modifiers.fromCenter ? 0 : -sx
  const ay = modifiers.fromCenter ? 0 : -sy
  const oldAnchor = { x: (ax * start.w) / 2, y: (ay * start.h) / 2 }
  const newAnchor = { x: (ax * w) / 2, y: (ay * h) / 2 }
  const kept = rotation === 0 ? oldAnchor : rotatePoint(oldAnchor, rotation)
  const next = rotation === 0 ? newAnchor : rotatePoint(newAnchor, rotation)
  return {
    x: Math.round(start.x + start.w / 2 + kept.x - next.x - w / 2),
    y: Math.round(start.y + start.h / 2 + kept.y - next.y - h / 2),
    w,
    h,
  }
}

export function visualBounds(box: Box, rotation: number): Box {
  const angle = normalizeDegrees(rotation)
  if (angle === 0) return box
  const radians = (angle * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const square = angle % 90 === 0
  const across = square ? (angle % 180 === 0 ? box.w : box.h) : box.w * cos + box.h * sin
  const down = square ? (angle % 180 === 0 ? box.h : box.w) : box.w * sin + box.h * cos
  return { x: box.x + (box.w - across) / 2, y: box.y + (box.h - down) / 2, w: across, h: down }
}

export function selectionFrame<K>(layers: ReadonlyMap<K, RotatedLayer>): Box | null {
  if (layers.size === 0) return null
  const bounds = [...layers.values()].map((layer) => visualBounds(layer.box, layer.rotation))
  const left = Math.min(...bounds.map((each) => each.x))
  const top = Math.min(...bounds.map((each) => each.y))
  const right = Math.max(...bounds.map((each) => each.x + each.w))
  const bottom = Math.max(...bounds.map((each) => each.y + each.h))
  return { x: left, y: top, w: right - left, h: bottom - top }
}

export function resizeSelection<K>(
  starts: ReadonlyMap<K, RotatedLayer>,
  grip: ResizeGrip,
  dx: number,
  dy: number,
  modifiers: ResizeModifiers,
): SelectionResize<K> {
  const startFrame = selectionFrame(starts)
  if (startFrame === null) return { frame: { x: 0, y: 0, w: 0, h: 0 }, boxes: new Map() }
  const nextFrame = resizeBox(startFrame, grip, dx, dy, modifiers, 0)
  const scaleX = startFrame.w > 0 ? nextFrame.w / startFrame.w : 1
  const scaleY = startFrame.h > 0 ? nextFrame.h / startFrame.h : 1
  const boxes = new Map<K, Box>()
  for (const [id, { box, rotation }] of starts) {
    const angle = normalizeDegrees(rotation)
    if (angle === 0) {
      const w = Math.max(Math.round(box.w * scaleX), 0)
      const h = Math.max(Math.round(box.h * scaleY), 0)
      const x = Math.round(nextFrame.x + (box.x - startFrame.x) * scaleX)
      const y = Math.round(nextFrame.y + (box.y - startFrame.y) * scaleY)
      boxes.set(id, { x, y, w, h })
      continue
    }
    const radians = (angle * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const localScaleX = Math.hypot(cos * scaleX, sin * scaleY)
    const localScaleY = Math.hypot(-sin * scaleX, cos * scaleY)
    const w = Math.round(box.w * localScaleX)
    const h = Math.round(box.h * localScaleY)
    const midX = nextFrame.x + (box.x + box.w / 2 - startFrame.x) * scaleX
    const midY = nextFrame.y + (box.y + box.h / 2 - startFrame.y) * scaleY
    boxes.set(id, { x: Math.round(midX - w / 2), y: Math.round(midY - h / 2), w, h })
  }
  return { frame: nextFrame, boxes }
}

function roundRotation(degrees: number, snapAngle: boolean): number {
  if (snapAngle) return normalizeDegrees(Math.round(degrees / snapDegrees) * snapDegrees)
  return normalizeDegrees(Math.round(degrees * 10) / 10)
}

export function rotatedAngle(center: Point, from: Point, at: Point, startRotation: number, snapAngle: boolean): number {
  const fromAngle = Math.atan2(from.y - center.y, from.x - center.x)
  const atAngle = Math.atan2(at.y - center.y, at.x - center.x)
  const delta = ((atAngle - fromAngle) * 180) / Math.PI
  return roundRotation(startRotation + delta, snapAngle)
}

export function flipSelection<K>(layers: ReadonlyMap<K, FlippableLayer>, axis: FlipAxis): readonly FlippedLayer<K>[] {
  const frame = selectionFrame(layers)
  if (frame === null) return []
  const centerX = frame.x + frame.w / 2
  const centerY = frame.y + frame.h / 2
  return [...layers].map(([id, layer]): FlippedLayer<K> => {
    const box =
      axis === "horizontal"
        ? { ...layer.box, x: Math.round(2 * centerX - layer.box.x - layer.box.w) }
        : { ...layer.box, y: Math.round(2 * centerY - layer.box.y - layer.box.h) }
    const current = normalizeDegrees(layer.rotation)
    return {
      id,
      ...(box.x === layer.box.x && box.y === layer.box.y ? {} : { box }),
      ...(current === 0 ? {} : { rotation: normalizeDegrees(360 - current) }),
      ...(axis === "horizontal" ? { flipH: !layer.flipH } : { flipV: !layer.flipV }),
    }
  })
}

export function resizeCursor(grip: ResizeGrip, rotation: number): string {
  const across = (((handleAngle[grip] + rotation) % 180) + 180) % 180
  return resizeCursors[Math.round(across / 45) % resizeCursors.length] ?? "move"
}

const rotateCursorPath = "M8 8.5 A7.5 7.5 0 0 1 15.5 16 M10.5 6 L8 8.5 L10.5 11 M13 13.5 L15.5 16 L18 13.5"

export function rotateCursor(corner: Corner, rotation: number): string {
  const turn = Math.round((rotateCornerOffset[corner] + rotation) / 5) * 5
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
    `<g transform="rotate(${String(turn)} 12 12)" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${rotateCursorPath}" stroke="white" stroke-width="3.5"/>` +
    `<path d="${rotateCursorPath}" stroke="black" stroke-width="1.5"/>` +
    `</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, grab`
}
