export const blurSpan = 476_250

export function blurPercent(radius: number): number {
  return Math.round((radius / blurSpan) * 100_000)
}

export function blurRadius(percent: number): number {
  return Math.round((percent / 100_000) * blurSpan)
}
