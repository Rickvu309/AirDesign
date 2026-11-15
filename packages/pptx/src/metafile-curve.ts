import type { Box, Point } from "./metafile-state.js"

export type Curve = readonly Point[]

const quarter = Math.PI / 2
const whole = Math.PI * 2

type Oval = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

function ovalOf(box: Box): Oval {
  return {
    x: (box.left + box.right) / 2,
    y: (box.top + box.bottom) / 2,
    width: Math.abs(box.right - box.left) / 2,
    height: Math.abs(box.bottom - box.top) / 2,
  }
}

function on(oval: Oval, angle: number): Point {
  return [oval.x + oval.width * Math.cos(angle), oval.y - oval.height * Math.sin(angle)]
}

function swept(oval: Oval, from: number, to: number): Point[] {
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / quarter - 1e-9))
  const step = (to - from) / steps
  const reach = (4 / 3) * Math.tan(step / 4)
  const points: Point[] = [on(oval, from)]
  for (let index = 0; index < steps; index += 1) {
    const start = from + index * step
    const end = start + step
    const [startX, startY] = on(oval, start)
    const [endX, endY] = on(oval, end)
    points.push(
      [startX - reach * oval.width * Math.sin(start), startY - reach * oval.height * Math.cos(start)],
      [endX + reach * oval.width * Math.sin(end), endY + reach * oval.height * Math.cos(end)],
      [endX, endY],
    )
  }
  return points
}

export function ellipsePoints(box: Box): Curve {
  return swept(ovalOf(box), 0, whole)
}

function angleOf(oval: Oval, point: Point): number {
  const across = oval.width === 0 ? 0 : (point[0] - oval.x) / oval.width
  const down = oval.height === 0 ? 0 : (oval.y - point[1]) / oval.height
  return Math.atan2(down, across)
}

export function arcPoints(box: Box, start: Point, end: Point): Curve {
  const oval = ovalOf(box)
  const from = angleOf(oval, start)
  let to = angleOf(oval, end)
  while (to <= from) to += whole
  return swept(oval, from, to)
}

export function roundPoints(box: Box, corner: Point): Curve {
  const left = Math.min(box.left, box.right)
  const right = Math.max(box.left, box.right)
  const top = Math.min(box.top, box.bottom)
  const bottom = Math.max(box.top, box.bottom)
  const across = Math.min(Math.abs(corner[0]) / 2, (right - left) / 2)
  const down = Math.min(Math.abs(corner[1]) / 2, (bottom - top) / 2)
  const turn = (x: number, y: number, from: number): Point[] =>
    swept({ x, y, width: across, height: down }, from, from + quarter).slice(1)
  const start: Point = [right, top + down]
  return [
    start,
    ...turn(right - across, top + down, 0),
    ...line([left + across, top]),
    ...turn(left + across, top + down, quarter),
    ...line([left, bottom - down]),
    ...turn(left + across, bottom - down, Math.PI),
    ...line([right - across, bottom]),
    ...turn(right - across, bottom - down, Math.PI + quarter),
    ...line(start),
  ]
}

function line(to: Point): Point[] {
  return [to, to, to]
}
