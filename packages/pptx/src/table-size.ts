import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { partBytes, within } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { gridOf, type Grid } from "./table-grid.js"

export type FrameSize = { readonly cx: number; readonly cy: number }

function sizeOf(element: MarkupElement, name: string): number {
  const value = element.attributes.find((item) => item.name === name)?.value ?? ""
  const size = /^\d+$/.test(value) ? Number(value) : NaN
  if (!Number.isSafeInteger(size)) throw new Error(element.kind)
  return size
}

function extOf(grid: Grid, shape: string): MarkupElement {
  const frame = shapeById(grid.elements, shape)
  const ext = grid.elements.find(
    (element) =>
      element.kind === "a:ext" &&
      grid.elements[element.parent]?.kind === "p:xfrm" &&
      within(grid.elements, element, frame),
  )
  if (ext === undefined) throw new Error("p:xfrm")
  return ext
}

function sizedOf(grid: Grid, shape: string): FrameSize {
  const ext = extOf(grid, shape)
  return { cx: sizeOf(ext, "cx"), cy: sizeOf(ext, "cy") }
}

export function frameSize(bytes: Uint8Array, shape: string): FrameSize {
  return sizedOf(gridOf(bytes, shape), shape)
}

function scaled(elements: readonly MarkupElement[], name: string, from: number, to: number): ByteEdit[] {
  const sizes = elements.map((element) => sizeOf(element, name))
  const total = sizes.reduce((sum, size) => sum + size, 0)
  if (from === to || from === 0 || total === 0) return []
  const target = Math.round((total * to) / from)
  let before = 0
  let placed = 0
  return elements.flatMap((element, at) => {
    before += sizes[at] ?? 0
    const reached = Math.round((before * target) / total)
    const size = reached - placed
    placed = reached
    const value = element.attributes.find((item) => item.name === name)
    return value === undefined ? [] : [{ start: value.valueStart, end: value.valueEnd, next: encodeUtf8(String(size)) }]
  })
}

export function scaledGrid(bytes: Uint8Array, shape: string, from: FrameSize): Uint8Array {
  const grid = gridOf(bytes, shape)
  const to = sizedOf(grid, shape)
  const edits = [...scaled(grid.widths, "w", from.cx, to.cx), ...scaled(grid.rows, "h", from.cy, to.cy)]
  return edits.length === 0 ? bytes : spliceBytes(bytes, edits)
}

function shared(
  elements: readonly MarkupElement[],
  name: string,
  weights: readonly number[],
  total: number,
): ByteEdit[] {
  const sum = weights.reduce((all, weight) => all + weight, 0)
  if (weights.length !== elements.length || sum <= 0) throw new Error(name)
  let before = 0
  let placed = 0
  return elements.flatMap((element, at) => {
    before += weights[at] ?? 0
    const reached = Math.round((before * total) / sum)
    const size = reached - placed
    placed = reached
    const value = element.attributes.find((item) => item.name === name)
    if (value === undefined || sizeOf(element, name) === size) return []
    return [{ start: value.valueStart, end: value.valueEnd, next: encodeUtf8(String(size)) }]
  })
}

export function sizedGrid(
  bytes: Uint8Array,
  shape: string,
  widths: readonly number[] | undefined,
  heights: readonly number[] | undefined,
): Uint8Array {
  const grid = gridOf(bytes, shape)
  const frame = sizedOf(grid, shape)
  const edits = [
    ...(widths === undefined ? [] : shared(grid.widths, "w", widths, frame.cx)),
    ...(heights === undefined ? [] : shared(grid.rows, "h", heights, frame.cy)),
  ]
  return edits.length === 0 ? bytes : spliceBytes(bytes, edits)
}

function valueEdit(element: MarkupElement, name: string, size: number): ByteEdit[] {
  const value = element.attributes.find((item) => item.name === name)
  if (value === undefined || sizeOf(element, name) === size) return []
  return [{ start: value.valueStart, end: value.valueEnd, next: encodeUtf8(String(size)) }]
}

export function fittedGrid(bytes: Uint8Array, shape: string, heights: readonly number[]): Uint8Array {
  const grid = gridOf(bytes, shape)
  if (heights.length !== grid.rows.length || heights.some((height) => !Number.isSafeInteger(height) || height <= 0))
    throw new Error("a:tr")
  const total = heights.reduce((sum, height) => sum + height, 0)
  const edits = [
    ...grid.rows.flatMap((row, at) => valueEdit(row, "h", heights[at] ?? 0)),
    ...valueEdit(extOf(grid, shape), "cy", total),
  ]
  return edits.length === 0 ? bytes : spliceBytes(bytes, edits)
}

export function fittedTable(
  parts: ReadonlyMap<string, Uint8Array>,
  at: { readonly part: string; readonly shape: string; readonly height: number },
  heights: readonly number[],
): ReadonlyMap<string, Uint8Array> {
  const { part, shape } = at
  const bytes = partBytes(parts, part)
  if (frameSize(bytes, shape).cy !== at.height) return parts
  const fitted = fittedGrid(bytes, shape, heights)
  if (fitted === bytes) return parts
  const next = new Map(parts)
  next.set(part, fitted)
  return next
}
