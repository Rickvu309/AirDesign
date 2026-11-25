import * as doom from "@airdesign/doom"
import { type Palette, type Swatch } from "@/design/color-choices"
import { namedByColor } from "@/design/color-names"
import { propOf } from "@airdesign/doom"
import { colorNameCopy } from "@/copy/color-name-copy"

function templateColors(theme: doom.Theme): readonly Swatch[] {
  const swatch = (role: doom.ColorVar) => ({ var: role, css: theme.colors[role].toUpperCase() })
  const palette = namedByColor(doom.paletteColorVars.map(swatch))
  const names = new Set(palette.map(({ name }) => name))
  const byColor = new Map(palette.map(({ css, name }) => [css, name]))
  const accent = palette.find(({ var: role }) => role === "accent1")
  if (accent !== undefined) byColor.set(accent.css, accent.name)
  const signs = namedByColor((["positive", "negative", "total"] as const).map(swatch)).map((entry) => {
    const shared = byColor.get(entry.css)
    if (shared !== undefined) return { ...entry, name: shared }
    let name = entry.name
    let number = 2
    while (names.has(name)) name = colorNameCopy.numbered(entry.name, number++)
    names.add(name)
    byColor.set(entry.css, name)
    return { ...entry, name }
  })
  return [...palette, ...signs]
}

function literalHexes(paints: readonly doom.Paint[] | undefined): readonly string[] {
  return (paints ?? []).flatMap((paint) => {
    const colors =
      paint.kind === "solid" ? [paint.color] : paint.kind === "gradient" ? paint.stops.map((stop) => stop.color) : []
    return colors.flatMap((color) => (typeof color === "string" ? [color.slice(1).toUpperCase()] : []))
  })
}

export function paletteOf(view: doom.Doom, theme: doom.Theme): Palette {
  const found = new Set<string>()
  for (const node of view.nodes.values()) {
    for (const hex of literalHexes(propOf(node, "fills"))) found.add(hex)
    for (const hex of literalHexes(propOf(node, "strokes"))) found.add(hex)
    for (const span of propOf(node, "text")?.spans ?? [])
      if (typeof span.color === "string") found.add(span.color.slice(1).toUpperCase())
  }
  return { templateColors: templateColors(theme), deck: [...found] }
}
