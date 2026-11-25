import { shownName, type Swatch } from "@/design/color-choices"
import { namedByColor } from "@/design/color-names"
import type { ColorRow } from "./design-selection-colors"

export function namedColorRows(
  rows: readonly ColorRow[],
  templateColors: readonly Swatch[],
): readonly (ColorRow & { readonly name: string })[] {
  const shown = rows.map((row) => ({ ...row, name: shownName(row.color, templateColors) }))
  const loose = shown.filter(({ name, hex }) => name === hex).map(({ hex }) => ({ hex, css: `#${hex}` }))
  const themed = shown.filter(({ name, hex }) => name !== hex).map(({ name }) => name)
  const named = new Map(namedByColor(loose, themed).map(({ hex, name }) => [hex, name]))
  return shown.map((row) => ({ ...row, name: named.get(row.hex) ?? row.name }))
}
