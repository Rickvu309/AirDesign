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

export type FramingFill = { readonly node: ElementId; readonly width: boolean; readonly height: boolean }

export type Framing = {
  readonly backdrop: ElementId
  readonly children: readonly ElementId[]
  readonly layout: FramingLayout
  readonly fills?: readonly FramingFill[]
}

function readFills(raw: unknown, children: readonly ElementId[]): readonly FramingFill[] | null {
  if (!Array.isArray(raw) || raw.length > children.length) return null
  const fills: FramingFill[] = []
  for (const item of raw) {
    const row = record(item)
    const node = readElementId(row?.node)
    if (row === null || !onlyKeys(row, ["node", "width", "height"]) || node === undefined) return null
    if (!children.includes(node) || typeof row.width !== "boolean" || typeof row.height !== "boolean") return null
    fills.push({ node, width: row.width, height: row.height })
  }
  return fills
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
  const filled = row?.fills === undefined ? [] : ["fills"]
  if (row === null || !onlyKeys(row, ["backdrop", "children", "layout", ...filled])) return null
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
  const fills = row.fills === undefined ? [] : readFills(row.fills, children)
  if (fills === null) return null
  return { backdrop, children, layout, ...(fills.length === 0 ? {} : { fills }) }
}

const fillsFiled = new WeakMap<readonly { readonly framing?: Framing }[], ReadonlyMap<ElementId, FramingFill>>()

export function filedFill(
  elements: readonly { readonly framing?: Framing }[],
  node: ElementId,
): FramingFill | undefined {
  const known = fillsFiled.get(elements)
  if (known !== undefined) return known.get(node)
  const found = new Map(elements.flatMap((element) => element.framing?.fills ?? []).map((fill) => [fill.node, fill]))
  fillsFiled.set(elements, found)
  return found.get(node)
}
