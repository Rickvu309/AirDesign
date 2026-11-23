import { readPalette, type Palette } from "./design.js"
import { bytesOf, limits } from "@airdesign/doom"
import { onlyKeys, record } from "./plain-object.js"

export type TemplateStyle = { readonly id: string; readonly name: string | null; readonly palette: Palette }

export function readTemplateStyles(raw: unknown): readonly TemplateStyle[] | null {
  if (!Array.isArray(raw) || raw.length > limits.slides) return null
  const styles: TemplateStyle[] = []
  for (const item of raw) {
    const row = record(item)
    if (row === null || !onlyKeys(row, ["id", "name", "palette"])) return null
    if (typeof row.id !== "string" || bytesOf(row.id) > 256 || row.id.length === 0) return null
    if (styles.some((style) => style.id === row.id)) return null
    if (row.name !== null && (typeof row.name !== "string" || bytesOf(row.name) > limits.valueBytes)) return null
    const palette = readPalette(row.palette)
    if (palette === null) return null
    styles.push({ id: row.id, name: row.name, palette })
  }
  return styles
}
