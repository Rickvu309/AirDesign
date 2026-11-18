import type { Design, Palette, TemplateFont } from "@airdesign/document"

export const fontReferences: { readonly [Font in TemplateFont]: string } = { major: "+mj-lt", minor: "+mn-lt" }

export function templateFontDesign(design: Design, fonts: NonNullable<Palette["fonts"]>): Design {
  const [value, source] = design["text.font"] ?? []
  const font = (Object.keys(fontReferences) as TemplateFont[]).find((each) => fontReferences[each] === value)
  if (font === undefined) return design
  const { "text.font": _font, ...rest } = design
  const name = fonts[font]
  if (name === undefined) return rest
  return { ...rest, "text.font": source === undefined ? [name] : [name, source] }
}
