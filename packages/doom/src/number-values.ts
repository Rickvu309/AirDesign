export type NumberValue = {
  readonly value: number
  readonly unit: string
  readonly decimals: number
  readonly marked: boolean
  readonly summable: boolean
  readonly worded: boolean
}

const shape =
  /^(\()?([-−+])?([$€£¥])?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*(%|x|[kmb]n?|pts?|pp)?(?:\s+([a-z]{1,4})\.?)?(\))?$/i
const rates = /^(?:%|x|pts?|pp)$/i
const year = /^(?:19|20)\d{2}$/
const blank = /^(?:[-–—]|n\/?a)$/i
const figure = String.raw`[-−+]?[$€£¥]?\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:%|[kmb]n?\b|pts?\b|pp\b)|x\b)?`
const inProse = new RegExp(String.raw`(?<![\w.,])(\(${figure}\)|${figure})(?:\s+([a-z]+\.?))?`, "giu")
const duration =
  /^(?:secs?|seconds?|mins?|minutes?|hrs?|hours?|days?|wks?|weeks?|mos?|months?|yrs?|years?|qtrs?|quarters?)\.?$/iu

export function numberValue(text: string): NumberValue | undefined {
  const found = shape.exec(text.trim())
  if (found === null) return undefined
  const [, open, sign, currency = "", whole = "", fraction = "", suffix = "", word = "", close] = found
  if ((open === undefined) !== (close === undefined)) return undefined
  const size = Number(whole.replaceAll(",", "") + (fraction === "" ? "" : `.${fraction}`))
  const negative = open !== undefined || sign === "-" || sign === "−"
  return {
    value: negative ? -size : size,
    unit: `${currency}|${suffix.toLowerCase()}|${word.toLowerCase()}`,
    decimals: fraction.length,
    marked: currency !== "" || suffix !== "" || fraction !== "" || whole.includes(","),
    summable: !rates.test(suffix),
    worded: word !== "",
  }
}

export const isDataValue = (text: string): boolean => numberValue(text)?.worded === false && !year.test(text.trim())

export const isBlankValue = (text: string): boolean => text.trim() === "" || blank.test(text.trim())

export function dataValuesIn(text: string): number {
  if (isDataValue(text)) return 1
  return [...text.matchAll(inProse)].filter(
    ([, value = "", word = ""]) => !duration.test(word) && numberValue(value)?.marked === true,
  ).length
}
