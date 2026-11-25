import { integer } from "../read-kit.js"
import { type Charge, numeric } from "./values.js"

type Axis = { readonly lo: number; readonly hi: number; readonly ticks: readonly number[] }

const exact = (value: number) => Number(value.toFixed(10))

function niceAxis(lo: number, hi: number, target: number): Axis {
  const top = hi > lo ? hi : lo + 1
  const rough = (top - lo) / target
  const power = 10 ** Math.floor(Math.log10(rough))
  const share = rough / power
  const step = (share <= 1 ? 1 : share <= 2 ? 2 : share <= 5 ? 5 : 10) * power
  const first = Math.floor(lo / step + 1e-9)
  const last = Math.ceil(top / step - 1e-9)
  const ticks = Array.from({ length: last - first + 1 }, (_, index) => exact((first + index) * step))
  return { lo: ticks[0] ?? lo, hi: ticks[ticks.length - 1] ?? top, ticks }
}

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
