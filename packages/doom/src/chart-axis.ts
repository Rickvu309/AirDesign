export type Axis = { readonly lo: number; readonly hi: number; readonly ticks: readonly number[] }

const exact = (value: number) => Number(value.toFixed(10))

export function niceAxis(lo: number, hi: number, target = 5): Axis {
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

const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })

export const formatValue = (value: number): string => grouped.format(value)

export const slug = (name: string): string => name.trim().replace(/\s+/g, "-")
