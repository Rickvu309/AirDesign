export type ChartScale = { readonly min: number; readonly max: number; readonly unit: number }
export type ChartBounds = { readonly min: number | null; readonly max: number | null; readonly unit: number | null }

const mostSteps = 10
const closeShare = 1 / 6
const roundSteps = [0.1, 0.2, 0.5, 1, 2, 5, 10]
const precision = 12

const tidy = (value: number): number => Number(value.toPrecision(precision))

function roundUnit(range: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(range))
  const unit = roundSteps.map((step) => step * magnitude).find((step) => range / step <= mostSteps)
  return tidy(unit ?? magnitude * 10)
}

export function chartScale(low: number, high: number, fixed: ChartBounds): ChartScale {
  const close = low > 0 && (high - low) / high < closeShare
  const start = fixed.min ?? (low >= 0 && !close ? 0 : low)
  const end = fixed.max ?? (high <= 0 && low < 0 ? 0 : high)
  const range = end - start
  const unit = fixed.unit ?? (range > 0 ? roundUnit(range) : roundUnit(1))
  const min = fixed.min ?? tidy(Math.floor(start / unit) * unit)
  const lifted = fixed.max ?? tidy(Math.ceil(end / unit) * unit)
  return { min, max: lifted > min ? lifted : tidy(min + unit * mostSteps), unit }
}

export function chartSteps(scale: ChartScale): readonly number[] {
  const count = Math.floor(tidy((scale.max - scale.min) / scale.unit))
  return Array.from({ length: count + 1 }, (_, at) => tidy(scale.min + at * scale.unit))
}
