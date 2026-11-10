function accentValue(themeXml: string): string {
  const match = /<a:accent1>\s*<a:srgbClr\b[^>]*\bval="([0-9A-Fa-f]{6})"/.exec(themeXml)
  const value = match?.[1]
  if (value === undefined) throw new Error("accent1")
  return value.toUpperCase()
}

function usesAccent(shapeXml: string): boolean {
  return /<a:schemeClr\b[^>]*\bval="accent1"/.test(shapeXml)
}

export function renderedAccent(themeXml: string, shapeXml: string): string | null {
  if (!usesAccent(shapeXml)) return null
  return accentValue(themeXml)
}
