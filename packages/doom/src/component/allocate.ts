import { finite, integer } from "../read-kit.js"
import type { Charge, Values } from "./values.js"

export function allocate(weights: Values, total: unknown, charge: Charge): Values {
  const units = integer(0, 1e14)(total)
  charge(weights.length)
  const values = weights.map(finite(0, 1e15))
  const sum = values.reduce((a, b) => a + b, 0)
  if (sum === 0) return values
  const shares = values.map((value, index) => {
    const exact = (value / sum) * units
    const whole = Math.floor(exact)
    return { index, whole, remainder: exact - whole }
  })
  const left = units - shares.reduce((a, b) => a + b.whole, 0)
  shares.sort((a, b) => {
    charge()
    return b.remainder - a.remainder || a.index - b.index
  })
  const result = values.slice()
  shares.forEach(({ index, whole }, rank) => {
    charge()
    result[index] = whole + Number(rank < left)
  })
  return result
}
