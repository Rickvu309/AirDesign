import type { Measure } from "./measure.js"
import type { Area } from "./preset-geometry.js"
import type { ResolvedLine } from "./resolved.js"
import type { Text } from "./text.js"
import type { Theme } from "./theme.js"

export function resolveText(
  text: Text,
  theme: Theme,
  area: Area,
  measure: Measure,
): { readonly lines: readonly ResolvedLine[] } {
  const measured = measure(text, theme, area.w)
  const free = Math.max(0, area.h - measured.h)
  const down = area.y + (text.alignV === "center" ? free / 2 : text.alignV === "bottom" ? free : 0)
  return {
    lines: measured.lines.map((line) => ({
      ...line,
      x: line.x + area.x,
      y: line.y + down,
      ...(line.label === undefined ? {} : { label: { ...line.label, x: line.label.x + area.x } }),
    })),
  }
}
