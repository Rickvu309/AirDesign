import { namedFace } from "./named-face.js"
import { resolveFont } from "./source.js"

export const fontRoutes = {
  family: { path: "/fonts/family" },
  file: { path: "/fonts/file" },
} as const

export const fallbackFont = "Geist"

export const servedFontAlias = (family: string): string => `airdesign-font-${encodeURIComponent(family.toLowerCase())}`

export function servedFontName(font: string): string | undefined {
  const served = resolveFont(font)
  return served === undefined ? undefined : (namedFace(font)?.typeface ?? served.family)
}

export function fontFamily(font: string | null): string {
  const primary = font === null ? undefined : servedFontName(font)
  const stack = new Set([primary ?? fallbackFont, fallbackFont])
  return [...stack]
    .map((name) => `"${servedFontAlias(name)}"`)
    .concat("sans-serif")
    .join(", ")
}
