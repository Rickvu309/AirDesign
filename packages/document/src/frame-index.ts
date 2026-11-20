import { readElementId, shapeOf, type ElementId } from "./element-id.js"
import { limits } from "./limits.js"
import { onlyKeys, record } from "./plain-object.js"
import { flows, layoutAligns, sizings } from "./trait-layout.js"
import { coordinates } from "./box.js"

export type FramingLayout = {
  readonly flow: (typeof flows)[number]
  readonly gap: number
  readonly padding: readonly [number, number, number, number]
  readonly align: (typeof layoutAligns)[number]
  readonly width?: (typeof sizings)[number]
  readonly height?: (typeof sizings)[number]
}

export type Framing = {
  readonly backdrop: ElementId
  readonly children: readonly ElementId[]
  readonly layout: FramingLayout
}

function size(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 && raw <= coordinates.highest
}

function readFramingLayout(raw: unknown): FramingLayout | null {
  const row = record(raw)
  const sized = ["width", "height"].filter((key) => row?.[key] !== undefined)
  if (row === null || !onlyKeys(row, ["flow", "gap", "padding", "align", ...sized])) return null
  const flow = flows.find((each) => each === row.flow)
  const align = layoutAligns.find((each) => each === row.align)
  const sides = Array.isArray(row.padding) && row.padding.length === 4 ? row.padding.filter(size) : []
  const [left, top, right, bottom] = sides
  if (sides.length !== 4 || left === undefined || top === undefined || right === undefined || bottom === undefined)
    return null
  if (flow === undefined || align === undefined || !size(row.gap)) return null
  const width = sizings.find((each) => each === row.width)
  const height = sizings.find((each) => each === row.height)
  if ((row.width !== undefined && width === undefined) || (row.height !== undefined && height === undefined))
    return null
  return {
    flow,
    gap: row.gap,
    padding: [left, top, right, bottom],
    align,
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
  }
}

export function readFraming(raw: unknown, node: ElementId): Framing | null {
  const row = record(raw)
  if (row === null || !onlyKeys(row, ["backdrop", "children", "layout"])) return null
  const backdrop = readElementId(row.backdrop)
  const layout = readFramingLayout(row.layout)
  if (backdrop === undefined || layout === null || !Array.isArray(row.children)) return null
  if (row.children.length > limits.batch || shapeOf(backdrop).slide !== shapeOf(node).slide) return null
  const children: ElementId[] = []
  for (const item of row.children) {
    const child = readElementId(item)
    if (child === undefined || child === backdrop || children.includes(child)) return null
    if (shapeOf(child).slide !== shapeOf(node).slide) return null
    children.push(child)
  }
  return { backdrop, children, layout }
}
