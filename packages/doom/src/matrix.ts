import type { Box, Point } from "./resolved.js"

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
