import { decodedXmlText, markupDocument } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import { slideTheme, themeSwatches, type ThemeSwatch } from "./theme-swatches.js"
import { shownTheme } from "./trait-xml-theme.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type TemplateStyle = {
  readonly name: string | null
  readonly major: string | null
  readonly minor: string | null
  readonly swatches: readonly ThemeSwatch[]
}

export function templateStyle(parts: Parts, slide: string): TemplateStyle {
  const theme = slideTheme(parts, slide)
  const bytes = theme === null ? undefined : parts.get(theme)
  const root = bytes === undefined ? undefined : markupDocument(bytes).elements[0]
  const fonts = shownTheme(parts, slide)
  return {
    name: root === undefined ? null : decodedXmlText(paintAttribute(root, "name") ?? "").trim() || null,
    major: fonts.major?.trim() || null,
    minor: fonts.minor?.trim() || null,
    swatches: theme === null ? [] : themeSwatches(parts, slide),
  }
}
