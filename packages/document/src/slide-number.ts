import { record } from "./plain-object.js"

export const numberCounts = ["all", "row"] as const
export const numberFormats = ["slash", "of"] as const

export type SlideNumber = {
  readonly count: (typeof numberCounts)[number]
  readonly format: (typeof numberFormats)[number] | null
}

export type SlideNumbers = { readonly number: number; readonly total: number; readonly rowNumber: number }

export const plainSlideNumber: SlideNumber = { count: "all", format: null }

export function readSlideNumber(raw: unknown): SlideNumber | null {
  const value = record(raw)
  if (value === null || Object.keys(value).length !== 2) return null
  const count = numberCounts.find((count) => value.count === count)
  const format = numberFormats.find((format) => value.format === format) ?? null
  if (count === undefined || (format === null && value.format !== null)) return null
  return { count, format }
}

export function shownSlideNumber(settings: SlideNumber, numbers: SlideNumbers) {
  const number = String(settings.count === "row" ? numbers.rowNumber : numbers.number)
  const suffix = settings.format === null ? "" : `${settings.format === "slash" ? " / " : " of "}${numbers.total}`
  return { number, suffix }
}
