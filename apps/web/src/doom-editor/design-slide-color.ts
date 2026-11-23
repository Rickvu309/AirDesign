import * as doom from "@airdesign/doom"
import type { Palette } from "@/design/color-choices"
import { shownName } from "@/design/color-choices"
import { oldColorOf } from "./design-values"

export function resolveColorOf(
  color: doom.Color,
  theme: doom.Theme,
  palette: Palette,
): { readonly css: string; readonly name: string; readonly value: ReturnType<typeof oldColorOf> } {
  const old = oldColorOf(color)
  return { css: doom.resolveColor(color, theme), name: shownName(old, palette.templateColors), value: old }
}
