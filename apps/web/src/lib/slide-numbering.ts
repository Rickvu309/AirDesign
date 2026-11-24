export const skippedNumber = "–"

export const slideNumber = (index: number): number => index + 1

export function slideIndexOf(number: number, count: number): number | null {
  return Number.isInteger(number) && number >= 1 && number <= count ? number - 1 : null
}

export function slideNumberLabel(index: number, skipped: boolean): string {
  return skipped ? skippedNumber : String(slideNumber(index))
}
