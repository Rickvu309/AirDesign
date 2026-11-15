import type { Design, Palette, ThemeFont } from "@airdesign/document"

export const fontReferences: { readonly [Font in ThemeFont]: string } = { major: "+mj-lt", minor: "+mn-lt" }

export function themedDesign(design: Design, fonts: NonNullable<Palette["fonts"]>): Design {
  const [value, source] = design["text.font"] ?? []
  const theme = (Object.keys(fontReferences) as ThemeFont[]).find((font) => fontReferences[font] === value)
  if (theme === undefined) return design
  const { "text.font": _font, ...rest } = design
  const name = fonts[theme]
  if (name === undefined) return rest
  return { ...rest, "text.font": source === undefined ? [name] : [name, source] }
}
