import type { PaintBox } from "./paint-box.js"
import type { CanvasText } from "./text-record.js"

export type Hug = { readonly width: number | null; readonly height: number }

export type FitSize = { readonly width?: number; readonly height: number }

const lengthOf = (value: string): number => Number.parseFloat(value) || 0

export function hugs(text: CanvasText | null): boolean {
  return (
    text !== null &&
    text.fit?.kind === "grow" &&
    text.fit.held !== true &&
    (text.flow ?? "horz") === "horz" &&
    (text.columns ?? 1) === 1
  )
}

export function huggedBox(box: PaintBox, hug: Hug): PaintBox {
  return { ...box, width: hug.width ?? box.width, height: hug.height }
}

export function naturalSize(layer: HTMLElement, text: CanvasText): Hug | null {
  const body = layer.querySelector<HTMLElement>(":scope > [data-text-body]")
  if (body === null) return null
  const kept = { minHeight: body.style.minHeight, width: body.style.width }
  body.style.minHeight = "0px"
  if (!text.wrap) body.style.width = "max-content"
  const measured = getComputedStyle(body)
  const room = getComputedStyle(layer)
  const height = lengthOf(measured.height) + lengthOf(room.paddingTop) + lengthOf(room.paddingBottom)
  const across = lengthOf(measured.width) + lengthOf(room.paddingLeft) + lengthOf(room.paddingRight)
  body.style.minHeight = kept.minHeight
  body.style.width = kept.width
  if (text.wrap) return { width: null, height }
  return { width: body.textContent === "" ? Math.max(across, height) : across, height }
}

export function sameHug(left: Hug | null, right: Hug | null): boolean {
  if (left === null || right === null) return left === right
  const near = (one: number, other: number) => Math.abs(one - other) < 0.5
  const widths =
    left.width === null || right.width === null ? left.width === right.width : near(left.width, right.width)
  return widths && near(left.height, right.height)
}
