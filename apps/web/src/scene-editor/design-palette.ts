import type { scene } from "@airdesign/document"
import type { Palette, Swatch } from "@/design/color-choices"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import { propOf } from "./node-props"
import { slotOfVar } from "./design-values"

export function swatchesOf(theme: scene.Theme): readonly Swatch[] {
  return (Object.keys(slotOfVar) as scene.ColorVar[]).map((name) => ({
    scheme: slotOfVar[name] as Swatch["scheme"],
    css: theme.colors[name].toUpperCase(),
    name: sceneEditorCopy.colorNames[name],
  }))
}

function literalHexes(paints: readonly scene.Paint[] | undefined): readonly string[] {
  return (paints ?? []).flatMap((paint) => {
    const colors =
      paint.kind === "solid" ? [paint.color] : paint.kind === "gradient" ? paint.stops.map((stop) => stop.color) : []
    return colors.flatMap((color) => (typeof color === "string" ? [color.slice(1).toUpperCase()] : []))
  })
}

export function paletteOf(view: scene.Scene, theme: scene.Theme): Palette {
  const found = new Set<string>()
  for (const node of view.nodes.values()) {
    for (const hex of literalHexes(propOf(node, "fills"))) found.add(hex)
    for (const hex of literalHexes(propOf(node, "strokes"))) found.add(hex)
    for (const span of propOf(node, "text")?.spans ?? [])
      if (typeof span.color === "string") found.add(span.color.slice(1).toUpperCase())
  }
  return { templateColors: swatchesOf(theme), deck: [...found] }
}
