import type { MarkupElement } from "./element-span.js"
import { paintColor, type PaintColor } from "./paint-color.js"
import { paintChild } from "./paint-fill.js"
import type { PaintTextHolder, PaintTextScope } from "./paint-text.js"

const inside = (holder: PaintTextHolder): readonly MarkupElement[] => holder.children[holder.element.index] ?? []

const held = (holder: PaintTextHolder, kind: string): PaintTextHolder | undefined => {
  const element = paintChild(holder.children, holder.element, kind)
  return element === undefined ? undefined : { element, children: holder.children }
}

export const highlightOf = (layer: PaintTextHolder, scope: PaintTextScope): PaintColor | null | undefined => {
  const highlight = held(layer, "a:highlight")
  if (highlight === undefined) return undefined
  const color = inside(highlight)[0]
  return color === undefined ? null : paintColor(color, highlight.children, scope.palette)
}

export const defaultColor = (scope: PaintTextScope): PaintColor | null => {
  const slot = scope.palette.slots.get(scope.palette.mapping.get("tx1") ?? "dk1")
  const color = slot === undefined ? undefined : scope.palette.children[slot.index]?.[0]
  return color === undefined ? null : paintColor(color, scope.palette.children, scope.palette)
}
