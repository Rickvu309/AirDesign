import { colorPaint, type Color } from "@airdesign/document"

type ThemeColor = { readonly scheme: string; readonly css: string }
const hexDigits = /^#?([0-9A-Fa-f]{6})$/

export function colorHex(color: Color, theme: readonly ThemeColor[]): string | null {
  const slot = (scheme: string) => {
    const css = theme.find((each) => each.scheme === scheme)?.css ?? ""
    return hexDigits.exec(css)?.[1] ?? null
  }
  return colorPaint(color, slot)?.hex ?? null
}
