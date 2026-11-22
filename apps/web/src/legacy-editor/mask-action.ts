import type { ElementId } from "@airdesign/document"
import type { CanvasElement } from "@airdesign/render"
import type { ElementChange } from "@/element-edit"

const maskable = new Set(["shape", "picture", "text"])

export type MaskAction =
  | { readonly kind: "toggle"; readonly node: ElementId }
  | { readonly kind: "group"; readonly change: Extract<ElementChange, { readonly change: "mask" }> }

export function maskAction(ids: readonly ElementId[], elements: readonly CanvasElement[]): MaskAction | null {
  const order = new Map(elements.flatMap((each, at) => (each.id === null ? [] : [[each.id, at] as const])))
  if (ids.length === 0 || ids.some((id) => !order.has(id))) return null
  const back = ids.toSorted((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0))[0]
  const element = back === undefined ? undefined : elements[order.get(back) ?? -1]
  if (back === undefined || element === undefined || !maskable.has(element.kind)) return null
  if (ids.length === 1) return { kind: "toggle", node: back }
  return { kind: "group", change: { change: "mask", nodes: ids } }
}
