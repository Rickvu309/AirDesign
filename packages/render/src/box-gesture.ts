import type { Box } from "@airdesign/document"
import type { PaintBox } from "./record.js"

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export type Point = { readonly x: number; readonly y: number }

export function boxOf(paint: PaintBox): Box {
  return {
    x: Math.round(paint.x),
    y: Math.round(paint.y),
    cx: Math.round(paint.width),
    cy: Math.round(paint.height),
  }
}

export function sameBox(left: Box | null, right: Box | null): boolean {
  if (left === null || right === null) return left === right
  return left.x === right.x && left.y === right.y && left.cx === right.cx && left.cy === right.cy
}
