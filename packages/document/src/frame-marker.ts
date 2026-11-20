import type { Box } from "./box.js"
import { shapeOf, type ElementId } from "./element-id.js"
import type { Framing, FramingFill, FramingLayout } from "./frame-index.js"
import type { LayoutView } from "./frame-layout.js"
import { flows, layoutAligns } from "./trait-layout.js"

export type SeenGroup = {
  readonly node: ElementId
  readonly box: Box
  readonly frame: Box | null
  readonly children: readonly { readonly node: ElementId; readonly box: Box }[]
}

const version = "1"
const flowCodes: Readonly<Record<FramingLayout["flow"], string>> = { none: "n", horizontal: "h", vertical: "v" }
const whole = /^(?:0|[1-9][0-9]{0,14})$/

function boxText(box: Box): string {
  return `${String(box.x)},${String(box.y)},${String(box.cx)},${String(box.cy)}`
}

function seal(box: Box, children: readonly { readonly node: ElementId; readonly box: Box }[]): string {
  const text = [boxText(box), ...children.map((child) => `${shapeOf(child.node).shape}:${boxText(child.box)}`)].join(
    "|",
  )
  let hash = 0x811c9dc5
  for (const unit of text) hash = Math.imul(hash ^ unit.charCodeAt(0), 0x01000193) >>> 0
  return hash.toString(16).padStart(8, "0")
}

function fillsText(children: LayoutView["children"]): readonly string[] {
  const filled = children.flatMap(({ node, fill }) =>
    fill === undefined ? [] : [`${shapeOf(node).shape}:${fill.width ? "w" : ""}${fill.height ? "h" : ""}`],
  )
  return filled.length === 0 ? [] : [`l=${filled.join(",")}`]
}

function fillsOf(text: string | undefined, children: readonly ElementId[]): readonly FramingFill[] {
  const named = new Map(children.map((child) => [shapeOf(child).shape, child]))
  return (text ?? "").split(",").flatMap((item) => {
    const [shape, sides] = item.split(":")
    const node = shape === undefined ? undefined : named.get(shape)
    if (node === undefined || sides === undefined || !/^w?h?$/.test(sides) || sides === "") return []
    return [{ node, width: sides.includes("w"), height: sides.includes("h") }]
  })
}

export function layoutMarker(view: LayoutView): string {
  const { left, top, right, bottom } = view.padding
  return [
    version,
    `b=${shapeOf(view.backdrop).shape}`,
    `f=${flowCodes[view.flow]}`,
    `g=${String(view.gap)}`,
    `p=${[left, top, right, bottom].map(String).join(",")}`,
    `a=${view.align}`,
    ...(view.width === "fixed" ? ["w=f"] : []),
    ...(view.height === "fixed" ? ["h=f"] : []),
    `c=${view.children.map((child) => shapeOf(child.node).shape).join(",")}`,
    ...fillsText(view.children),
    `s=${seal(view.box, view.children)}`,
  ].join(";")
}

function fieldsOf(marker: string): ReadonlyMap<string, string> | null {
  const [head, ...rest] = marker.split(";")
  if (head !== version) return null
  const fields = new Map<string, string>()
  for (const item of rest) {
    const at = item.indexOf("=")
    if (at < 1 || fields.has(item.slice(0, at))) return null
    fields.set(item.slice(0, at), item.slice(at + 1))
  }
  return fields
}

function sizes(text: string | undefined, count: number): readonly number[] | null {
  const parts = text === undefined || text === "" ? [] : text.split(",")
  return parts.length === count && parts.every((part) => whole.test(part)) ? parts.map(Number) : null
}

function layoutOf(fields: ReadonlyMap<string, string>): FramingLayout | null {
  const flow = flows.find((each) => flowCodes[each] === fields.get("f"))
  const align = layoutAligns.find((each) => each === fields.get("a"))
  const [gap] = sizes(fields.get("g"), 1) ?? []
  const [left, top, right, bottom] = sizes(fields.get("p"), 4) ?? []
  if (flow === undefined || align === undefined || gap === undefined) return null
  if (left === undefined || top === undefined || right === undefined || bottom === undefined) return null
  const sized = (key: string) =>
    fields.get(key) === "f" ? ({ [key === "w" ? "width" : "height"]: "fixed" } as const) : {}
  return { flow, gap, padding: [left, top, right, bottom], align, ...sized("w"), ...sized("h") }
}

export function layoutFromFile(marker: string | null, seen: SeenGroup): Framing | null {
  const fields = marker === null ? null : fieldsOf(marker)
  const layout = fields === null ? null : layoutOf(fields)
  const [backdrop, ...rest] = seen.children
  if (fields === null || layout === null || backdrop === undefined) return null
  if (shapeOf(backdrop.node).shape !== fields.get("b")) return null
  const frame = seen.frame ?? seen.box
  if (frame.cx !== seen.box.cx || frame.cy !== seen.box.cy) return null
  const named = (fields.get("c") ?? "").split(",").filter((shape) => shape !== "")
  const placed = rest.map((child) => ({
    node: child.node,
    box: { ...child.box, x: child.box.x + seen.box.x - frame.x, y: child.box.y + seen.box.y - frame.y },
  }))
  const written = named.flatMap((shape) => placed.filter((child) => shapeOf(child.node).shape === shape))
  const kept = written.length === placed.length && seal(seen.box, written) === fields.get("s")
  if (kept) {
    const children = written.map((child) => child.node)
    const fills = fillsOf(fields.get("l"), children)
    return { backdrop: backdrop.node, children, layout, ...(fills.length === 0 ? {} : { fills }) }
  }
  return {
    backdrop: backdrop.node,
    children: placed.map((child) => child.node),
    layout: { ...layout, flow: "none" },
  }
}
