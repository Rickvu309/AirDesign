import * as doom from "@airdesign/doom"
import type { Palette, Swatch } from "@/design/color-choices"
import { namedByColor } from "@/design/color-names"
import { propOf } from "@/editing/node-props"
import { slotOfVar } from "./design-values"

export function swatchesOf(theme: doom.Theme): readonly Swatch[] {
  return namedByColor(
    (Object.keys(slotOfVar) as doom.ColorVar[]).map((name) => ({
      scheme: slotOfVar[name] as Swatch["scheme"],
      css: theme.colors[name].toUpperCase(),
    })),
  )
}

export const colorNameOf = (theme: doom.Theme, name: doom.ColorVar): string =>
  swatchesOf(theme)[Object.keys(slotOfVar).indexOf(name)]?.name ?? name

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
  return { templateColors: swatchesOf(theme), deck: [...found] }
}
