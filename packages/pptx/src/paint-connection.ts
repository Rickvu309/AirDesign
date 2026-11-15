import type { MarkupElement } from "./element-span.js"
import { attr } from "./paint-sheet.js"
import type { MarkupChildren } from "./text-value-route.js"

export type PaintTie = { readonly shape: string; readonly site: number }

export type PaintConnection = { readonly start: PaintTie | null; readonly end: PaintTie | null }

function childOf(children: MarkupChildren, element: MarkupElement | undefined, kind: string) {
  return element === undefined ? undefined : children[element.index]?.find((each) => each.kind === kind)
}

function tieOf(element: MarkupElement | undefined): PaintTie | null {
  const shape = element === undefined ? null : attr(element, "id")
  const site = Number(element === undefined ? NaN : attr(element, "idx"))
  if (shape === null || !/^[0-9]{1,10}$/.test(shape) || !Number.isSafeInteger(site) || site < 0) return null
  return { shape, site }
}

export function paintConnection(
  element: MarkupElement,
  children: MarkupChildren,
): { readonly connection?: PaintConnection } {
  if (element.kind !== "p:cxnSp") return {}
  const holder = childOf(children, childOf(children, element, "p:nvCxnSpPr"), "p:cNvCxnSpPr")
  const start = tieOf(childOf(children, holder, "a:stCxn"))
  const end = tieOf(childOf(children, holder, "a:endCxn"))
  return start === null && end === null ? {} : { connection: { start, end } }
}
