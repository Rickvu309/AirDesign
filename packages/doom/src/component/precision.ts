import { reject } from "../read-kit.js"
import { type Charge, type Values, numeric, valueList } from "./values.js"

export function positiveScale(value: unknown): number {
  const scale = numeric(value)
  return scale > 0 ? scale : reject("shape", "The scale must be positive.")
}

export function decimals([source, scaleArg]: Values, charge: Charge): number {
  const values = valueList(source)
  const scale = positiveScale(scaleArg)
  charge(values.length)
  let max = 0
  for (const value of values) {
    if (value !== null) max = Math.max(max, Math.abs(numeric(value)))
  }
  return max === 0 ? 0 : Math.max(0, Math.min(2, 2 - Math.floor(Math.log10(max / scale))))
}
