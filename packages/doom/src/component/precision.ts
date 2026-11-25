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
  let hasFraction = false
  for (const value of values) {
    if (value === null) continue
    const displayed = Math.abs(numeric(value) / scale)
    max = Math.max(max, displayed)
    if (hasFraction || Number.isInteger(displayed)) continue
    const tolerance = Math.min(1e-12, displayed * Number.EPSILON)
    hasFraction = Math.abs(displayed - Math.round(displayed)) > tolerance
  }
  return hasFraction && max < 10 ? 1 : 0
}
