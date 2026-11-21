import type { Box, SlideSize } from "@airdesign/document"

const emuPerPoint = 12_700

export type PointBox = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export type PointSize = { readonly w: number; readonly h: number }

function points(emu: number): number {
  return Math.round((emu / emuPerPoint) * 10) / 10
}

export function pointBox(box: Box): PointBox {
  return { x: points(box.x), y: points(box.y), w: points(box.cx), h: points(box.cy) }
}

export function pointSize(size: SlideSize): PointSize {
  return { w: points(size.width), h: points(size.height) }
}
