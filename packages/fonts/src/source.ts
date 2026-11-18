import { portableFace } from "./portable-face.js"
import catalog from "./catalog.json" with { type: "json" }
import twins from "./twins.json" with { type: "json" }

export type FontFamily = {
  readonly family: string
  readonly category: string
  readonly folder: string
  readonly license: string
  readonly notice: string
}

export const fontRevision = catalog.revision
export const fontCatalog: readonly FontFamily[] = [
  ...catalog.families,
  {
    family: "Liberation Sans Narrow",
    category: "Sans Serif",
    folder: "local",
    license: "GPL-2.0-with-font-exception",
    notice: "LiberationSansNarrow-LICENSE.txt",
  },
]

export function resolveFont(name: string): FontFamily | undefined {
  const family =
    twins.find((font) => font.family.toLowerCase() === name.toLowerCase())?.prefer ?? portableFace(name)?.family ?? name
  return fontCatalog.find((font) => font.family.toLowerCase() === family.toLowerCase())
}

export const fontNames = fontCatalog.map((font) => font.family)
