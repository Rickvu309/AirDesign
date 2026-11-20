import { catalogFamily, fontCatalog, type FontFamily } from "./catalog.js"
import { namedFace } from "./named-face.js"
import twins from "./twins.json" with { type: "json" }

export { fontRevision, type FontFamily } from "./catalog.js"

export function resolveFont(name: string): FontFamily | undefined {
  const twin = twins.find((font) => font.family.toLowerCase() === name.toLowerCase())?.prefer
  const face = namedFace(name)
  return catalogFamily(twin ?? name) ?? (face === undefined ? undefined : catalogFamily(face.family))
}

export const fontNames = fontCatalog.map((font) => font.family)
