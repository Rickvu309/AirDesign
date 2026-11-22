import catalog from "./catalog.json" with { type: "json" }

export type FontFamily = {
  readonly family: string
  readonly category: string
  readonly folder: string
  readonly license: string
  readonly notice: string
}

export const fontRevision: string = catalog.revision
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

const byName = new Map(fontCatalog.map((font) => [font.family.toLowerCase(), font]))

export function catalogFamily(name: string): FontFamily | undefined {
  return byName.get(name.toLowerCase())
}
