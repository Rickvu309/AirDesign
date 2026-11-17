import {
  alphaOf,
  fadedColor,
  readColor,
  readTextValue,
  type Color,
  type ElementId,
  type SetChange,
} from "@airdesign/document"
import { shownHex, type Palette } from "./color-choices"
import type { PanelReads } from "./panel"

export type ColorSource = {
  readonly node: ElementId
  readonly fields: PanelReads["fields"]
  readonly textColors?: (paragraph: number, run: number) => Color | undefined
  readonly textColor?: Color
}

function mapColors(
  value: unknown,
  visit: (color: Color) => Color,
  fallback?: Color,
  textColors?: ColorSource["textColors"],
): unknown {
  const color = readColor(value)
  if (color != null) return visit(color)
  if (Array.isArray(value)) {
    const text = readTextValue(JSON.stringify(value))
    if (text !== null && fallback !== undefined)
      return text.map((paragraph, p) => ({
        ...paragraph,
        runs: paragraph.runs.map((run, r) => {
          const held = run.color ?? textColors?.(p, r) ?? fallback
          const next = run.text === "" ? held : visit(held)
          return next === held ? run : { ...run, color: next }
        }),
      }))
    return value.map((item: unknown) => mapColors(item, visit, fallback, textColors))
  }
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapColors(item, visit, fallback, textColors)]),
    )
  return value
}

export function selectionColors(sources: readonly ColorSource[], palette: Palette) {
  const colors = new Map<string, Color>()
  for (const source of sources)
    for (const field of Object.values(source.fields ?? {}))
      mapColors(
        field?.value,
        (color) => {
          const hex = shownHex(color, palette.theme)
          if (!colors.has(hex)) colors.set(hex, color)
          return color
        },
        source.textColor,
        source.textColors,
      )
  const brightness = (hex: string) =>
    0.2126 * Number.parseInt(hex.slice(0, 2), 16) +
    0.7152 * Number.parseInt(hex.slice(2, 4), 16) +
    0.0722 * Number.parseInt(hex.slice(4, 6), 16)
  return [...colors]
    .map(([hex, color]) => ({ hex, color }))
    .sort((a, b) => brightness(a.hex) - brightness(b.hex) || a.hex.localeCompare(b.hex))
}

export function replaceSelectionColor(
  sources: readonly ColorSource[],
  hex: string,
  color: Color,
  palette: Palette,
): readonly SetChange[] {
  return sources.flatMap((source) => {
    const traits: Record<string, Record<string, unknown>> = {}
    for (const [key, field] of Object.entries(source.fields ?? {})) {
      let changed = false
      const value = mapColors(
        field?.value,
        (held) => {
          if (shownHex(held, palette.theme) !== hex) return held
          changed = true
          return fadedColor(color, alphaOf(held))
        },
        source.textColor,
        source.textColors,
      )
      const [trait, name] = key.split(".")
      if (changed && trait !== undefined && name !== undefined)
        traits[trait] = {
          ...traits[trait],
          [name]: key === "text.value" || key === "table.value" ? JSON.stringify(value) : value,
        }
    }
    return Object.keys(traits).length === 0 ? [] : [{ target: { node: source.node }, ...traits }]
  })
}
