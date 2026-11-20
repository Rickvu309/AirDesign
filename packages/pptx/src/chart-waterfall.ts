import {
  sameColor,
  waterfallBars,
  waterfallColor,
  type ChartValue,
  type Color,
  type WaterfallRole,
} from "@airdesign/document"

export type WaterfallSeries = {
  readonly name: string
  readonly role: WaterfallRole | "base"
  readonly values: readonly (number | null)[]
  readonly fill: Color | null
  readonly points: readonly (Color | null)[]
  readonly spans: readonly (number | null)[]
}

export const waterfallNames = { base: "Base", increase: "Increase", decrease: "Decrease" } as const

const roles = ["increase", "decrease", "total"] as const

function shared(colors: readonly Color[], fallback: Color): Color {
  const [first] = colors
  return first !== undefined && colors.every((color) => sameColor(color, first)) ? first : fallback
}

export function waterfallSeries(chart: ChartValue): readonly WaterfallSeries[] {
  const bars = waterfallBars(chart)
  const own = chart.series[0]
  const count = chart.categories.length
  const colors = bars.map((bar, at) => own?.colors?.[at] ?? waterfallColor(bar.role))
  const empty = () => Array.from({ length: count }, (): number | null => null)
  const base = empty()
  const crossed = Array.from({ length: count }, (): Color | null => null)
  const visible = { increase: empty(), decrease: empty(), total: empty() }
  const spans = empty()
  for (const [at, bar] of bars.entries()) {
    const value = own?.values[at] ?? 0
    const low = Math.min(bar.start, bar.end)
    const high = Math.max(bar.start, bar.end)
    spans[at] = value
    if (bar.role === "total") visible.total[at] = value
    else if (low >= 0) {
      base[at] = low === 0 ? null : low
      visible[bar.role][at] = Math.abs(value)
    } else if (high <= 0) {
      base[at] = high === 0 ? null : high
      visible[bar.role][at] = -Math.abs(value)
    } else {
      base[at] = low
      crossed[at] = colors[at] ?? null
      visible[bar.role][at] = high
    }
  }
  const series = roles.map((role): WaterfallSeries => {
    const own = bars.flatMap((bar, at) => (bar.role === role ? [colors[at] ?? waterfallColor(role)] : []))
    const fill = shared(own, waterfallColor(role))
    return {
      name: role === "total" ? (chart.series[0]?.name ?? "") : waterfallNames[role],
      role,
      values: visible[role],
      fill,
      points: bars.map((bar, at) => {
        const color = colors[at]
        return bar.role === role && color !== undefined && !sameColor(color, fill) ? color : null
      }),
      spans: bars.map((bar, at) => (bar.role === role ? (spans[at] ?? null) : null)),
    }
  })
  return [
    { name: waterfallNames.base, role: "base", values: base, fill: null, points: crossed, spans: empty() },
    ...series,
  ]
}
