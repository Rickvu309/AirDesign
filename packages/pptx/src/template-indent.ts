import type { ListIndent } from "@airdesign/document"
import type { MarkupChildren } from "./text-value-route.js"
import type { MarkupElement } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import { paintChild } from "./paint-fill.js"

type ListHolder = { readonly element: MarkupElement; readonly children: MarkupChildren }

const levels = 9

function whole(element: MarkupElement, name: string): number | undefined {
  const value = paintAttribute(element, name)
  return value === null || !/^[+-]?\d+$/.test(value) ? undefined : Number(value)
}

function levelIndent(lists: readonly ListHolder[], level: number): ListIndent | null {
  const layers = lists.flatMap((list) =>
    [`a:lvl${level + 1}pPr`, "a:defPPr"].flatMap((kind) => paintChild(list.children, list.element, kind) ?? []),
  )
  const marginLeft = layers.map((layer) => whole(layer, "marL")).find((value) => value !== undefined)
  if (marginLeft === undefined) return null
  return { marginLeft, indent: layers.map((layer) => whole(layer, "indent")).find((value) => value !== undefined) ?? 0 }
}

export function templateIndents(
  placeholder: string | null,
  lists: readonly ListHolder[],
): { readonly templateIndents?: readonly (ListIndent | null)[] } {
  if (placeholder === null) return {}
  const indents = Array.from({ length: levels }, (_, level) => levelIndent(lists, level))
  return indents.some((indent) => indent !== null) ? { templateIndents: indents } : {}
}
