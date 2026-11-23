import type { Box, ElementId } from "@airdesign/document"

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export type Point = { readonly x: number; readonly y: number }

export type Edge = "top" | "right" | "bottom" | "left"

export type ResizeGrip = Corner | Edge

export type RotateGrip = `rotate-${Corner}`

export type TransformGrip = "move" | ResizeGrip | RotateGrip

export type ResizeModifiers = {
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

export type FlipAxis = "horizontal" | "vertical"

export type FlippedLayer<K = ElementId> = {
  readonly id: K
  readonly box?: Box
  readonly rotation?: number
  readonly flipH?: boolean
  readonly flipV?: boolean
}

export type SelectionResize<K = ElementId> = {
  readonly frame: Box
  readonly boxes: ReadonlyMap<K, Box>
}

export const snapDegrees = 15

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
  freeCx: number,
  freeCy: number,
  sx: -1 | 0 | 1,
  sy: -1 | 0 | 1,
): { readonly cx: number; readonly cy: number } {
  if (start.cx <= 0 || start.cy <= 0) return { cx: freeCx, cy: freeCy }
  const across = freeCx / start.cx
  const down = freeCy / start.cy
  const chosen =
    sx !== 0 && sy !== 0 ? (Math.abs(across - 1) >= Math.abs(down - 1) ? across : down) : sx !== 0 ? across : down
  const scale = Math.max(chosen, 0)
  return { cx: Math.round(start.cx * scale), cy: Math.round(start.cy * scale) }
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
  const freeCx = sx === 0 ? start.cx : clampedSide(start.cx, sx * ldx * factor)
  const freeCy = sy === 0 ? start.cy : clampedSide(start.cy, sy * ldy * factor)
  const { cx, cy } = modifiers.keepRatio ? constrainedSize(start, freeCx, freeCy, sx, sy) : { cx: freeCx, cy: freeCy }
  const ax = modifiers.fromCenter ? 0 : -sx
  const ay = modifiers.fromCenter ? 0 : -sy
  const oldAnchor = { x: (ax * start.cx) / 2, y: (ay * start.cy) / 2 }
  const newAnchor = { x: (ax * cx) / 2, y: (ay * cy) / 2 }
  const kept = rotation === 0 ? oldAnchor : rotatePoint(oldAnchor, rotation)
  const next = rotation === 0 ? newAnchor : rotatePoint(newAnchor, rotation)
  return {
    x: Math.round(start.x + start.cx / 2 + kept.x - next.x - cx / 2),
    y: Math.round(start.y + start.cy / 2 + kept.y - next.y - cy / 2),
    cx,
    cy,
  }
}

export function visualBounds(box: Box, rotation: number): Box {
  const angle = normalizeDegrees(rotation)
  if (angle === 0) return box
  const radians = (angle * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const square = angle % 90 === 0
  const across = square ? (angle % 180 === 0 ? box.cx : box.cy) : box.cx * cos + box.cy * sin
  const down = square ? (angle % 180 === 0 ? box.cy : box.cx) : box.cx * sin + box.cy * cos
  return { x: box.x + (box.cx - across) / 2, y: box.y + (box.cy - down) / 2, cx: across, cy: down }
}

export function selectionFrame<K>(layers: ReadonlyMap<K, RotatedLayer>): Box | null {
  if (layers.size === 0) return null
  const bounds = [...layers.values()].map((layer) => visualBounds(layer.box, layer.rotation))
  const left = Math.min(...bounds.map((each) => each.x))
  const top = Math.min(...bounds.map((each) => each.y))
  const right = Math.max(...bounds.map((each) => each.x + each.cx))
  const bottom = Math.max(...bounds.map((each) => each.y + each.cy))
  return { x: left, y: top, cx: right - left, cy: bottom - top }
}

export function resizeSelection<K>(
  starts: ReadonlyMap<K, RotatedLayer>,
  grip: ResizeGrip,
  dx: number,
  dy: number,
  modifiers: ResizeModifiers,
): SelectionResize<K> {
  const startFrame = selectionFrame(starts)
  if (startFrame === null) return { frame: { x: 0, y: 0, cx: 0, cy: 0 }, boxes: new Map() }
  const nextFrame = resizeBox(startFrame, grip, dx, dy, modifiers, 0)
  const scaleX = startFrame.cx > 0 ? nextFrame.cx / startFrame.cx : 1
  const scaleY = startFrame.cy > 0 ? nextFrame.cy / startFrame.cy : 1
  const boxes = new Map<K, Box>()
  for (const [id, { box, rotation }] of starts) {
    const angle = normalizeDegrees(rotation)
    if (angle === 0) {
      const cx = Math.max(Math.round(box.cx * scaleX), 0)
      const cy = Math.max(Math.round(box.cy * scaleY), 0)
      const x = Math.round(nextFrame.x + (box.x - startFrame.x) * scaleX)
      const y = Math.round(nextFrame.y + (box.y - startFrame.y) * scaleY)
      boxes.set(id, { x, y, cx, cy })
      continue
    }
    const radians = (angle * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const localScaleX = Math.hypot(cos * scaleX, sin * scaleY)
    const localScaleY = Math.hypot(-sin * scaleX, cos * scaleY)
    const cx = Math.round(box.cx * localScaleX)
    const cy = Math.round(box.cy * localScaleY)
    const midX = nextFrame.x + (box.x + box.cx / 2 - startFrame.x) * scaleX
    const midY = nextFrame.y + (box.y + box.cy / 2 - startFrame.y) * scaleY
    boxes.set(id, { x: Math.round(midX - cx / 2), y: Math.round(midY - cy / 2), cx, cy })
  }
  return { frame: nextFrame, boxes }
}

export function roundRotation(degrees: number, snapAngle: boolean): number {
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
  const centerX = frame.x + frame.cx / 2
  const centerY = frame.y + frame.cy / 2
  return [...layers].map(([id, layer]): FlippedLayer<K> => {
    const box =
      axis === "horizontal"
        ? { ...layer.box, x: Math.round(2 * centerX - layer.box.x - layer.box.cx) }
        : { ...layer.box, y: Math.round(2 * centerY - layer.box.y - layer.box.cy) }
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
