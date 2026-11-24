import { finite, integer, literal, object, reject } from "../read-kit.js"
import { type Value, type Values, isList, numeric, string } from "./values.js"

const list = (value: Value | undefined): Values => (isList(value) ? value : reject())
const number = numeric
const index = integer(-1e15, 1e15)
const readFormat = object({
  scale: (raw) => {
    const scale = number(raw)
    return scale > 0 ? scale : reject()
  },
  digits: integer(0, 12),
  prefix: string,
  suffix: string,
  sign: literal(["negative", "always"]),
})

type Operation = {
  readonly min: number
  readonly max: number
  readonly run: (args: Values, charge: (steps: number) => void) => Value
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
    return divisor === 0 ? 0 : numerator / divisor
  }),
  min: extreme(Math.min, Infinity),
  max: extreme(Math.max, -Infinity),
  sum: fixed(1, ([source], charge) => {
    const values = list(source)
    charge(values.length)
    return values.reduce<number>((total, value) => total + number(value), 0)
  }),
  count: fixed(1, ([source]) => list(source).length),
  eq: fixed(2, ([a, b]) => a === b),
  lt: fixed(2, ([a, b]) => number(a) < number(b)),
  concat: many(0, (args) => {
    const strings = args.map(string)
    if (strings.reduce((length, value) => length + value.length, 0) > 512) return reject("limit")
    return string(strings.join(""))
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
  band: fixed(5, ([i, count, left, width, share]) => {
    const lanes = integer(0, 100)(count)
    const span = number(width)
    const step = lanes === 0 ? 0 : span / lanes
    const w = number(step * finite(0, 1)(share))
    return { x: number(number(left) + step * index(i) + (step - w) / 2), w }
  }),
  format: fixed(2, ([value, options]) => {
    const { scale, digits, prefix, suffix, sign } = readFormat(options)
    const rounded = number(Number(number(number(value) / scale).toFixed(digits)))
    const lead = rounded < 0 ? "−" : rounded > 0 && sign === "always" ? "+" : ""
    return string(lead + prefix + Math.abs(rounded).toFixed(digits) + suffix)
  }),
  point: fixed(2, ([x, y]) => ({ x: number(x), y: number(y) })),
  site: fixed(2, ([key, site]) => ({ key: list(key), site: literal(["t", "r", "b", "l", "c"])(site) })),
}

export function readOperator(op: string, arity: number): Operation {
  const operator = Object.hasOwn(operators, op) ? operators[op] : undefined
  if (operator === undefined || arity < operator.min || arity > operator.max) return reject()
  return operator
}
