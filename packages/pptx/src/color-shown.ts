import { colorPaint, type Color } from "@airdesign/document"
import { markupDocument } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"

type ThemeColor = { readonly scheme: string; readonly css: string }

const slideFile = /^ppt\/slides\/slide\d+\.xml$/
const hexDigits = /^#?([0-9A-Fa-f]{6})$/

export function colorHex(color: Color, theme: readonly ThemeColor[]): string | null {
  const slot = (scheme: string) => {
    const css = theme.find((each) => each.scheme === scheme)?.css ?? ""
    return hexDigits.exec(css)?.[1] ?? null
  }
  return colorPaint(color, slot)?.hex ?? null
}

export function deckColors(parts: ReadonlyMap<string, Uint8Array>): readonly string[] {
  const counts = new Map<string, number>()
  for (const [name, bytes] of parts) {
    if (!slideFile.test(name)) continue
    for (const element of markupDocument(bytes).elements) {
      if (element.kind !== "a:srgbClr") continue
      const hex = hexDigits.exec(paintAttribute(element, "val") ?? "")?.[1]?.toUpperCase()
      if (hex !== undefined) counts.set(hex, (counts.get(hex) ?? 0) + 1)
    }
  }
  return [...counts].sort(([, left], [, right]) => right - left).map(([hex]) => hex)
}
