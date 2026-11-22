import type { Measure } from "./measure.js"
import type { Box, ResolvedLine } from "./resolved.js"
import type { Text } from "./text.js"
import type { Theme } from "./theme.js"

export function resolveText(
  text: Text,
  theme: Theme,
  box: Pick<Box, "w" | "h">,
  measure: Measure,
): { readonly lines: readonly ResolvedLine[] } {
  const measured = measure(text, theme, box.w)
  const free = Math.max(0, box.h - measured.h)
  const down = text.alignV === "center" ? free / 2 : text.alignV === "bottom" ? free : 0
  return { lines: measured.lines.map((line) => ({ ...line, y: line.y + down })) }
}
