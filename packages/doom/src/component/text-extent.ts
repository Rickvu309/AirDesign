import { isRefusal, props, type Measure, type Theme } from "../index.js"
import { reject } from "../read-kit.js"
import { type Charge, type ValueRecord, string } from "./values.js"

export function textExtent(raw: unknown, style: unknown, theme: Theme, measure: Measure, charge: Charge): ValueRecord {
  const chars = string(raw)
  const paras = chars.split("\n").map(() => ({}))
  charge(96 + 3 * chars.length + 24 * paras.length)
  const text = props.text.read({ chars, style, paras, spans: [], resize: "fixed", alignV: "center", wrap: "words" })
  if (isRefusal(text)) return reject("shape", text.form ?? "Text and a named text style.")
  const { w, h } = measure(text, theme, null)
  return { w, h }
}
