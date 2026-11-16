import type { MarkupElement } from "./element-span.js"
import { paintAttribute, paintColor, type PaintColor } from "./paint-color.js"
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

const schemeColor = (scope: PaintTextScope, name: string, fallback: string): PaintColor | null => {
  const slot = scope.palette.slots.get(scope.palette.mapping.get(name) ?? fallback)
  const color = slot === undefined ? undefined : scope.palette.children[slot.index]?.[0]
  return color === undefined ? null : paintColor(color, scope.palette.children, scope.palette)
}

export const defaultColor = (scope: PaintTextScope): PaintColor | null => schemeColor(scope, "tx1", "dk1")

const textColorMark = "{A12FA001-AC4F-418D-AE19-62706E023703}"

const usesTextColor = (link: PaintTextHolder): boolean => {
  const marks = held(link, "a:extLst")
  return (
    marks !== undefined &&
    inside(marks).some(
      (mark) =>
        paintAttribute(mark, "uri") === textColorMark &&
        (marks.children[mark.index] ?? []).some((choice) => paintAttribute(choice, "val") === "tx"),
    )
  )
}

export const linkColor = (
  format: PaintTextHolder | undefined,
  scope: PaintTextScope,
): PaintColor | null | undefined => {
  const link = format === undefined ? undefined : held(format, "a:hlinkClick")
  return link === undefined || usesTextColor(link) ? undefined : schemeColor(scope, "hlink", "hlink")
}
