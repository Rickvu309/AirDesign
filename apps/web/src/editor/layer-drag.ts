import type { LayerZone } from "@/editor/layer-tree"

export const layerIndent = 16
const scrollEdge = 24
const scrollStep = 12

type Pointer = { readonly clientX: number; readonly clientY: number }

export function zoneAt(pointer: Pointer, row: HTMLElement, holds: boolean): LayerZone {
  const box = row.getBoundingClientRect()
  const share = box.height === 0 ? 0 : (pointer.clientY - box.top) / box.height
  if (!holds) return share < 0.5 ? "above" : "below"
  return share < 0.25 ? "above" : share > 0.75 ? "below" : "inside"
}

export function depthAt(pointer: Pointer, row: HTMLElement, depth: number): number {
  const start = row.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(row).paddingLeft)
  return depth + Math.floor((pointer.clientX - start) / layerIndent)
}

export function scrollNearEdge(pointer: Pointer, list: HTMLElement) {
  const box = list.getBoundingClientRect()
  const fromTop = pointer.clientY - box.top
  const fromBottom = box.bottom - pointer.clientY
  if (fromTop < scrollEdge) list.scrollTop -= Math.ceil(scrollStep * (1 - Math.max(0, fromTop) / scrollEdge))
  else if (fromBottom < scrollEdge) list.scrollTop += Math.ceil(scrollStep * (1 - Math.max(0, fromBottom) / scrollEdge))
}
