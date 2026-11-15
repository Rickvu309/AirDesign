import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { within } from "./part-markup.js"
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
