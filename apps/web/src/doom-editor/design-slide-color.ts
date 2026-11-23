import * as doom from "@airdesign/doom"
import type { Palette } from "@/design/color-choices"
import { shownName } from "@/design/color-choices"

export function resolveColorOf(
  color: doom.Color,
  theme: doom.Theme,
  palette: Palette,
): { readonly css: string; readonly name: string; readonly value: doom.Color } {
  return { css: doom.resolveColor(color, theme), name: shownName(color, palette.templateColors), value: color }
}
