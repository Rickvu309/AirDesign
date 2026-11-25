import { grayscale, resolveColor } from "../color.js"
import { finite, integer, literal, object, reject } from "../read-kit.js"
import type { ReportFinding } from "./findings.js"
import { axis } from "./numeric-axis.js"
import { sortBy, startsWithWordIgnoreCase } from "./order-values.js"
import { linkChannels } from "./link-channels.js"
import { textExtent } from "./text-extent.js"
import { contrastInk, type FittingContext } from "./fit-text.js"
import { allocate } from "./allocate.js"
import { readableInk } from "./color-operators.js"
import {
  cycle, flatten, groupBy, groupIndex, indexBy, lookup, partition, positiveInteger, runs, sample, splitRanked,
} from "./list-operators.js"
import { palette, uniqueColors } from "./palette.js"
import { decimals, positiveScale } from "./precision.js"
import { flowText, textMetrics, textWidth } from "./text-operators.js"
import { polar } from "./polar.js"
import { nonoverlap, placeBoxes, sectorSpace } from "./placement-operators.js"
import { discs, polyline, wedge } from "./path-operators.js"
import {
  type Charge,
  type Value,
  type ValueRecord,
  type Values,
  color,
  isList,
  numeric,
  string,
  valueList,
  wordsWithin,
} from "./values.js"

const list = valueList
const number = numeric
const index = integer(-1e15, 1e15)
const readFormat = object({
  scale: positiveScale,
  digits: integer(0, 12),
  prefix: string,
  suffix: string,
  sign: literal(["negative", "always"]),
})

export const defaultNumberTokens = { "number.locale": "en-US", "number.group": true } as const
const localeText = wordsWithin(64)

export function readLocale(raw: unknown): string {
  const locale = localeText(raw)
  try {
    const supported = Intl.NumberFormat.supportedLocalesOf(locale)
    if (supported[0] !== undefined) return supported[0]
  } catch (thrown) {
    if (!(thrown instanceof RangeError)) throw thrown
  }
  return reject("shape", "A supported BCP 47 number locale.")
}

export type NumberFormat = (value: number, digits: number) => string

export function numberFormat(tokens: ValueRecord, charge: Charge): NumberFormat {
  const locale = tokens["number.locale"]
  const useGrouping = tokens["number.group"]
  const formats = new Map<number, Intl.NumberFormat>()
  return (value, digits) => {
    charge(32)
    let format = formats.get(digits)
    if (format === undefined) {
      charge(256)
      format = new Intl.NumberFormat(typeof locale === "string" ? locale : defaultNumberTokens["number.locale"], {
        useGrouping: typeof useGrouping === "boolean" ? useGrouping : defaultNumberTokens["number.group"],
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
      formats.set(digits, format)
    }
    return format.format(value)
  }
}

type Operation = {
  readonly min: number
  readonly max: number
  readonly run: (
    args: Values,
    charge: Charge,
    format: NumberFormat,
    context: FittingContext,
    report: ReportFinding,
  ) => Value
}

const fixed = (arity: number, run: Operation["run"]): Operation => ({ min: arity, max: arity, run })
const many = (min: number, run: Operation["run"]): Operation => ({ min, max: 64, run })

const extreme = (fold: (a: number, b: number) => number, start: number): Operation =>
  many(1, (args, charge) => {
    let result = start
    for (const arg of args) {
      const values = isList(arg) ? arg : [arg]
      charge(values.length)
      for (const value of values) result = fold(result, number(value))
    }
    return number(result)
  })

const operators: Readonly<Record<string, Operation>> = {
  list: many(0, (args) => args),
  add: many(0, (args) => args.reduce<number>((sum, value) => sum + number(value), 0)),
  sub: fixed(2, ([a, b]) => number(a) - number(b)),
  mul: fixed(2, ([a, b]) => number(a) * number(b)),
  div: fixed(2, ([a, b]) => {
    const numerator = number(a)
    const divisor = number(b)
    return divisor === 0 ? reject("shape", "The divisor must be nonzero.") : numerator / divisor
  }),
  min: extreme(Math.min, Infinity),
  max: extreme(Math.max, -Infinity),
  sum: fixed(1, ([source], charge) => {
    const values = list(source)
    charge(values.length)
    return values.reduce<number>((total, value) => total + number(value), 0)
  }),
  count: fixed(1, ([source]) => list(source).length),
  coalesce: fixed(2, ([value, fallback]) => value ?? fallback ?? null),
  groupBy: fixed(2, groupIndex),
  cycle: fixed(2, cycle),
  readableInk: fixed(1, (args, _charge, _format, { theme }) => readableInk(args, theme)),
  eq: fixed(2, ([a, b], charge) => {
    if (typeof a === "string" && typeof b === "string" && a.length === b.length) charge(a.length)
    return a === b
  }),
  lt: fixed(2, ([a, b]) => number(a) < number(b)),
  concat: many(0, (args, charge) => {
    let length = 0
    const strings = args.map((value) => {
      if (typeof value === "string") {
        charge(value.length)
        length += value.length
        if (length > 512) reject("limit", "Concatenated text must fit in 512 UTF-8 bytes.")
      }
      return string(value)
    })
    return string(strings.join(""))
  }),
  field: fixed(2, ([value, key]) => {
    if (value === null || typeof value !== "object" || isList(value)) return reject("shape", "An object.")
    const fields = value
    const name = string(key)
    if (!Object.hasOwn(fields, name)) return reject("shape", `No field "${name}".`)
    return fields[name] ?? null
  }),
  at: fixed(2, ([source, i]) => list(source)[index(i)] ?? null),
  linear: fixed(5, ([value, lo, hi, a, b]) => {
    const x = number(value)
    const low = number(lo)
    const high = number(hi)
    const from = number(a)
    const to = number(b)
    return low === high ? from : from + ((to - from) * (x - low)) / (high - low)
  }),
  band: fixed(5, ([i, count, start, span, share]) => {
    const lanes = integer(0, 100)(count)
    const width = number(span)
    const step = lanes === 0 ? 0 : width / lanes
    const size = number(step * finite(0, 1)(share))
    return { start: number(number(start) + step * index(i) + (step - size) / 2), size }
  }),
  sortBy: { min: 2, max: 5, run: sortBy },
  startsWithWordIgnoreCase: fixed(2, startsWithWordIgnoreCase),
  axis: fixed(3, ([lo, hi, target], charge) => axis(lo, hi, target, charge)),
  textExtent: {
    min: 2,
    max: 3,
    run: ([chars, style, size], charge, _format, { theme, measure }) =>
      textExtent(chars, style, size, theme, measure, charge),
  },
  decimals: fixed(2, decimals),
  resolutionDigits: fixed(1, ([value]) => {
    const resolution = Math.abs(number(value))
    return resolution === 0 ? 0 : Math.min(12, Math.max(0, -Math.floor(Math.log10(resolution))))
  }),
  timeCategory: fixed(1, ([value], charge) => {
    const label = string(value)
    charge(label.length)
    return /^(?:[12]\d{3}(?:[-/.]\d{1,2}(?:[-/.]\d{1,2})?|[EeAa])?|(?:FY\s*)?['’]?\d{2,4}\s+Q[1-4]|Q[1-4](?:\s+(?:FY\s*)?['’]?\d{2,4})?|FY\s*['’]?\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.]?(?:\s+['’]?\d{2,4})?)$/i.test(
      label.trim(),
    )
  }),
  fitSize: fixed(1, ([value], _charge, _format, { theme }) =>
    value === "auto" ? Math.min(...Object.values(theme.textStyles).map(({ size }) => size)) : number(value),
  ),
  isInteger: fixed(1, ([value]) => Number.isInteger(number(value))),
  textWidth: { min: 2, max: 3, run: (args, _charge, _format, context) => textWidth(args, context) },
  textMetrics: fixed(2, (args, _charge, _format, context) => textMetrics(args, context)),
  "contrast-ink": fixed(3, ([fill, first, second], _charge, _format, context) =>
    contrastInk(fill, first, second, context.theme),
  ),
  flowText: fixed(2, (args, _charge, _format, context, report) => flowText(args, context, report)),
  format: {
    min: 2,
    max: 3,
    run: ([value, options, mode], charge, format, _context, report) => {
      if (options !== null && typeof options === "object" && !isList(options)) {
        if (typeof options.prefix === "string") charge(options.prefix.length)
        if (typeof options.suffix === "string") charge(options.suffix.length)
      }
      if (mode !== undefined) literal(["measure"])(mode)
      const { scale, digits, prefix, suffix, sign } = readFormat(options)
      const original = number(value)
      const rounded = number(Number(number(original / scale).toFixed(digits)))
      if (mode !== "measure" && original !== 0 && rounded === 0)
        report({ kind: "rounded-to-zero", value: original, scale, digits })
      const lead = rounded < 0 ? "−" : rounded > 0 && sign === "always" ? "+" : ""
      return string(lead + prefix + format(Math.abs(rounded), digits) + suffix)
    },
  },
  floor: fixed(1, ([value]) => Math.floor(number(value))),
  hypot: fixed(2, ([x, y]) => Math.hypot(number(x), number(y))),
  pow10: fixed(1, ([digits]) => 10 ** integer(-12, 12)(digits)),
  "index-key": fixed(1, ([i]) => String(index(i))),
  flatten: fixed(1, ([values], charge) => flatten(list(values), charge)),
  partition: fixed(2, ([values, size], charge) => partition(list(values), positiveInteger(size), charge)),
  runs: fixed(1, ([values], charge) => runs(list(values), charge)),
  "group-by": fixed(2, ([values, key], charge) => groupBy(list(values), string(key), charge)),
  allocate: fixed(2, ([values, total], charge) => allocate(list(values), total, charge)),
  "split-ranked": fixed(3, ([values, field, count], charge) =>
    splitRanked(list(values), string(field), integer(0, 100)(count), charge),
  ),
  grayscale: fixed(1, ([paint], _charge, _format, context) => grayscale(resolveColor(color(paint), context.theme))),
  "unique-colors": fixed(1, ([values], charge, _format, context) => uniqueColors(list(values), context.theme, charge)),
  palette: fixed(2, ([values, requested], charge, _format, context) =>
    palette(list(values), list(requested), context.theme, charge),
  ),
  "index-by": fixed(2, ([values, field], charge) => indexBy(list(values), string(field), charge)),
  lookup: fixed(2, lookup),
  sample: fixed(2, ([values, size], charge) => sample(list(values), positiveInteger(size), charge)),
  "place-boxes": fixed(3, ([rows, obstacles, bounds], charge) =>
    placeBoxes(list(rows), list(obstacles), bounds, charge),
  ),
  nonoverlap: fixed(1, ([values], charge) => nonoverlap(list(values), charge)),
  "sector-space": fixed(4, ([r, inner, outer, span]) => sectorSpace(r, inner, outer, span)),
  discs: fixed(3, ([points, rx, ry], charge) => discs(list(points), number(rx), number(ry), charge)),
  polyline: fixed(1, ([points], charge) => polyline(list(points), charge)),
  wedge: fixed(5, wedge),
  polar: fixed(3, polar),
  "link-channels": fixed(3, ([cards, links, bounds], charge) => linkChannels(cards, links, bounds, charge)),
  point: fixed(2, ([x, y]) => ({ x: number(x), y: number(y) })),
  site: fixed(2, ([key, site]) => ({ key: list(key), site: literal(["t", "r", "b", "l", "c"])(site) })),
}

export function readOperator(op: string, arity: number): Operation {
  const operator = Object.hasOwn(operators, op) ? operators[op] : undefined
  if (operator === undefined) return reject("shape", `Unknown operator "${op}".`)
  if (arity < operator.min || arity > operator.max) {
    const expected = operator.min === operator.max ? operator.min : `${operator.min} to ${operator.max}`
    return reject("shape", `"${op}" takes ${expected} arguments.`)
  }
  return operator
}
