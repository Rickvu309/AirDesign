export const warmupKeys = 3

export const spikeKeys = 2

export type TypedLetters = {
  readonly mean: number
  readonly trimmedMean: number
  readonly typical: number
  readonly beyondTypical: number
  readonly slowest: number
}

const median = (sorted: readonly number[]) => {
  const at = (sorted.length - 1) / 2
  const low = sorted[Math.floor(at)] ?? 0
  const high = sorted[Math.ceil(at)] ?? low
  return low + (high - low) * (at - Math.floor(at))
}

const meanOf = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((total, each) => total + each, 0) / values.length

export function typedLetters(perKey: readonly number[]): TypedLetters {
  const sorted = perKey.slice(warmupKeys).sort((left, right) => left - right)
  const mean = meanOf(sorted)
  const typical = median(sorted)
  return {
    mean,
    trimmedMean: meanOf(sorted.slice(0, Math.max(0, sorted.length - spikeKeys))),
    typical,
    beyondTypical: mean - typical,
    slowest: sorted.at(-1) ?? 0,
  }
}
