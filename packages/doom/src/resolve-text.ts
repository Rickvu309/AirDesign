import { ellipsized } from "./text-ellipsis.js"
import type { Measure, Measured } from "./measure.js"
import type { Area } from "./preset-geometry.js"
import type { ResolvedLine, ResolvedText } from "./resolved.js"
import type { Text } from "./text.js"
import type { Theme } from "./theme.js"

export function resolveText(text: Text, theme: Theme, area: Area, measure: Measure): ResolvedText {
  const natural = measure(text, theme, area.w)
  const place = (measured: Measured): readonly ResolvedLine[] => {
    const free = Math.max(0, area.h - measured.h)
    const down = area.y + (text.alignV === "center" ? free / 2 : text.alignV === "bottom" ? free : 0)
    return measured.lines.map((line) => ({
      ...line,
      x: line.x + area.x,
      y: line.y + down,
      ...(line.label === undefined ? {} : { label: { ...line.label, x: line.label.x + area.x } }),
    }))
  }
  if (text.overflow !== "ellipsis") return { lines: place(natural) }
  const fitted = ellipsized(natural, text, theme, area.h, measure)
  return {
    lines: place(fitted),
    overflow: "clip",
    ...(fitted === natural ? {} : { sourceLines: place(natural) }),
  }
}
