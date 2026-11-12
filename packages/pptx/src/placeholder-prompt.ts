import type { MarkupElement } from "./element-span.js"
import { layoutMatch, type Drawn, type Sheet } from "./paint-sheet.js"
import { sourceBody, type MarkupChildren } from "./text-value-route.js"

export type FallbackPrompt = (type: string | null | undefined) => string | null

function shapeText(element: MarkupElement, children: MarkupChildren, bytes: Uint8Array): string {
  const body = sourceBody(children, bytes, element)
  if (body === null) return ""
  return body
    .flatMap((paragraph) => paragraph.inlines.map((inline) => (inline.text === "\n" ? "" : inline.text)))
    .join("")
    .trim()
}

function hasOwnText(element: MarkupElement, children: MarkupChildren, bytes: Uint8Array): boolean {
  return shapeText(element, children, bytes).length > 0
}

export function placeholderPrompt(
  item: Drawn,
  sheet: Sheet,
  layout: Sheet | null,
  fallback?: FallbackPrompt,
): string | null {
  if (item.placeholder === null) return null
  if (hasOwnText(item.element, sheet.children, sheet.bytes)) return null
  const above = layout === null ? undefined : layoutMatch(layout, item.placeholder)
  if (above !== undefined && layout !== null) {
    const layoutText = shapeText(above.element, layout.children, layout.bytes)
    if (layoutText.length > 0) return layoutText
  }
  const placeholderType = above?.placeholder?.type ?? item.placeholder.type
  return fallback?.(placeholderType) ?? null
}
