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

const fractionDigits = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  const fixed = Math.abs(value).toFixed(fractionCap)
  const dot = fixed.indexOf(".")
  const fraction = dot < 0 ? "" : fixed.slice(dot + 1).replace(/0+$/, "")
  return fraction.length
}

export function seriesPrecision(series: readonly { readonly values: readonly number[] }[]): number {
  let digits = 0
  for (const one of series) {
    for (const value of one.values) digits = Math.max(digits, fractionDigits(value))
  }
  return digits
}

export const stepPrecision = (axis: Axis): number =>
  fractionDigits(axis.ticks.length < 2 ? 0 : Math.abs(axis.ticks[1]! - axis.ticks[0]!))

const fixed = [0, 1, 2].map(
  (digits) => new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }),
)

const currency = /^(\p{Sc}|[A-Z]{1,3}\p{Sc}|CHF)([A-Za-z]?)$/u
const attached = /^(%|[A-Za-z])$/
const letters = /[A-Za-z]/

type Attached = { readonly before: string; readonly after: string }

function attachedOf(unit: string | undefined): Attached | undefined {
  if (unit === undefined) return undefined
  const money = currency.exec(unit)
  if (money !== null) {
    const sign = money[1]!
    return { before: letters.test(sign.slice(-1)) ? `${sign} ` : sign, after: money[2]! }
  }
  return attached.test(unit) ? { before: "", after: unit } : undefined
}

export const axisUnit = (unit: string | undefined): string | undefined =>
  unit !== undefined && attachedOf(unit) === undefined ? unit : undefined

const withUnit = (shown: string, unit: Attached | undefined): string => {
  if (unit === undefined) return shown
  const minus = shown.startsWith("-") ? "-" : ""
  return `${minus}${unit.before}${minus === "" ? shown : shown.slice(1)}${unit.after}`
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

export function formatValue(value: number, digits: number, unit?: string): string {
  const places = digits <= 0 ? 0 : digits >= fractionCap ? fractionCap : 1
  return withUnit(fixed[places]!.format(value), attachedOf(unit))
}

const scalable = (unit: string | undefined): Attached | undefined | null => {
  const attach = attachedOf(unit)
  return attach !== undefined && letters.test(attach.after) ? null : attach
}

export function formatCompact(value: number, unit?: string): string | undefined {
  const attach = scalable(unit)
  return attach === null ? undefined : withUnit(compact.format(value), attach)
}

const scales = [
  { size: 1e12, letter: "T" },
  { size: 1e9, letter: "B" },
  { size: 1e6, letter: "M" },
  { size: 1e3, letter: "K" },
] as const

const whole = (value: number) => Math.abs(value - Number(value.toFixed(fractionCap))) < 1e-9

export function scaledTicks(axis: Axis, unit?: string): ((value: number) => string) | undefined {
  const attach = scalable(unit)
  if (attach === null) return undefined
  const largest = Math.max(0, ...axis.ticks.map(Math.abs))
  const step = axis.ticks.length < 2 ? 0 : Math.abs(axis.ticks[1]! - axis.ticks[0]!)
  const scale = scales.find(({ size }) => largest >= size && whole(step / size))
  if (scale === undefined) return undefined
  const digits = fractionDigits(step / scale.size)
  return (value) => withUnit(value === 0 ? "0" : `${fixed[digits]!.format(value / scale.size)}${scale.letter}`, attach)
}

export const compactFirst = (axis: Axis): boolean => Math.max(0, ...axis.ticks.map(Math.abs)) >= 1e9
