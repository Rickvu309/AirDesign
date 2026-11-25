import type { Measure } from "../measure.js"
import { literal } from "../read-kit.js"
import { textStyleNames } from "../text.js"
import type { Theme } from "../theme.js"
import { textSize } from "./fit-text.js"
import { naturalText } from "./text-operators.js"
import { type Charge, type ValueRecord, string } from "./values.js"

const readStyle = literal(textStyleNames)

export function textExtent(
  raw: unknown,
  style: unknown,
  size: unknown,
  theme: Theme,
  measure: Measure,
  charge: Charge,
): ValueRecord {
  const chars = string(raw)
  charge(96 + 3 * chars.length + 24 * chars.split("\n").length)
  const name = readStyle(style)
  const text = naturalText(chars, name, size === undefined ? theme.textStyles[name].size : textSize(size))
  const { w, h } = measure(text, theme, null)
  return { w, h }
}
