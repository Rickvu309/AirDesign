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

const fractionCap = 2

export function seriesPrecision(series: readonly { readonly values: readonly number[] }[]): number {
  let digits = 0
  for (const one of series) {
    for (const value of one.values) {
      if (!Number.isFinite(value)) continue
      const fixed = Math.abs(value).toFixed(fractionCap)
      const dot = fixed.indexOf(".")
      const fraction = dot < 0 ? "" : fixed.slice(dot + 1).replace(/0+$/, "")
      if (fraction.length > digits) digits = fraction.length
    }
  }
  return digits
}

const fixed = [0, 1, 2].map(
  (digits) => new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }),
)

export function formatValue(value: number, digits: number): string {
  const places = digits <= 0 ? 0 : digits >= fractionCap ? fractionCap : 1
  return fixed[places]!.format(value)
}

export function formatTick(value: number, digits: number, unit?: string): string {
  const shown = formatValue(value, digits)
  return unit === undefined ? shown : `${shown} ${unit}`
}

export const slug = (name: string): string => name.trim().replace(/\s+/g, "-")
