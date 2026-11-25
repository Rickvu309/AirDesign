import { niceAxis } from "../chart-axis.js"
import { integer } from "../read-kit.js"
import { type Charge, numeric } from "./values.js"

export function axis(low: unknown, high: unknown, count: unknown, charge: Charge) {
  const lo = numeric(low)
  const hi = numeric(high)
  const target = integer(1, 10)(count)
  charge(6 * (target + 2))
  const minimumSpan = 1e-8
  const result = niceAxis(lo, Math.max(lo + minimumSpan, hi), target)
  return {
    lo: result.lo,
    hi: result.hi,
    step: (result.ticks[1] ?? result.lo) - result.lo,
    ticks: result.ticks.map((value, i) => ({ id: String(i), value })),
  }
}
