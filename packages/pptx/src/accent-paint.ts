import { markupDocument, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"

function attribute(element: MarkupElement, name: string): string | null {
  for (const item of element.attributes) {
    if (item.name === name) return item.value
  }
  return null
}

function hex6(value: string): boolean {
  if (value.length !== 6) return false
  for (const char of value) {
    const code = char.codePointAt(0)
    if (code === undefined) return false
    const digit = (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102)
    if (!digit) return false
  }
  return true
}

function inside(elements: readonly MarkupElement[], index: number, ancestor: number): boolean {
  let parent = elements[index]?.parent ?? -1
  while (parent >= 0) {
    if (parent === ancestor) return true
    const next = elements[parent]
    if (next === undefined) return false
    parent = next.parent
  }
  return false
}

function accentValue(themeXml: string): string {
  const document = markupDocument(encodeUtf8(themeXml))
  const accent = document.elements.find((element) => element.kind === "a:accent1")
  if (accent === undefined) throw new Error("accent1")
  for (const element of document.elements) {
    if (element.kind !== "a:srgbClr" || !inside(document.elements, element.index, accent.index)) continue
    const value = attribute(element, "val")
    if (value !== null && hex6(value)) return value.toUpperCase()
  }
  throw new Error("accent1")
}

function usesAccent(shapeXml: string): boolean {
  const document = markupDocument(encodeUtf8(shapeXml))
  return document.elements.some((element) => element.kind === "a:schemeClr" && attribute(element, "val") === "accent1")
}

export function renderedAccent(themeXml: string, shapeXml: string): string | null {
  if (!usesAccent(shapeXml)) return null
  return accentValue(themeXml)
}
