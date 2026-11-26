import type { Box, GroupFit, LayoutBox, Point } from "./resolved.js"

export type Matrix = readonly [number, number, number, number, number, number]

export const identity: Matrix = [1, 0, 0, 1, 0, 0]

export function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left
  const [g, h, i, j, k, l] = right
  return [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f]
}

export function apply(matrix: Matrix, at: Point): Point {
  const [a, b, c, d, e, f] = matrix
  return { x: a * at.x + c * at.y + e, y: b * at.x + d * at.y + f }
}

export function invert(matrix: Matrix): Matrix {
  const [a, b, c, d, e, f] = matrix
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

export function boxMatrix(parent: Matrix, box: Box): Matrix {
  const radians = (box.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const centerX = box.x + box.w / 2
  const centerY = box.y + box.h / 2
  const turn: Matrix = [
    cos,
    sin,
    -sin,
    cos,
    centerX - cos * (box.w / 2) + sin * (box.h / 2),
    centerY - sin * (box.w / 2) - cos * (box.h / 2),
  ]
  return multiply(parent, turn)
}

export function artMatrix(parent: Matrix, box: Box): Matrix {
  const flip: Matrix = [box.flipH ? -1 : 1, 0, 0, box.flipV ? -1 : 1, box.flipH ? box.w : 0, box.flipV ? box.h : 0]
  return multiply(boxMatrix(parent, box), flip)
}

export function contentMatrix(matrix: Matrix, box: LayoutBox): Matrix {
  const origin = box.fit?.origin
  return origin === undefined ? matrix : multiply(matrix, [1, 0, 0, 1, -origin.x, -origin.y])
}

export function fitShift(box: Pick<Box, "w" | "h" | "rotation">, fit: GroupFit | undefined): Point {
  if (fit === undefined) return { x: 0, y: 0 }
  if (box.rotation % 360 === 0) return fit.origin
  const matrix = boxMatrix(identity, { ...box, x: 0, y: 0, flipH: false, flipV: false })
  const at = apply(matrix, { x: fit.pivot.x - fit.origin.x, y: fit.pivot.y - fit.origin.y })
  return { x: fit.pivot.x - at.x, y: fit.pivot.y - at.y }
}

export function unfittedBox(placed: LayoutBox): Box {
  if (placed.fit === undefined) return placed
  const { fit, ...box } = placed
  const shift = fitShift(box, fit)
  return { ...box, x: box.x - shift.x, y: box.y - shift.y }
}
