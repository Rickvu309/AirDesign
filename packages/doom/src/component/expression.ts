import { boolean, reject } from "../read-kit.js"
import { readOperator } from "./operators.js"
import {
  type Scalar,
  type Value,
  type Values,
  type ValueRecord,
  checkDepth,
  entries,
  isList,
  name,
  numeric,
  path,
  scalar,
} from "./values.js"

export type Expr =
  | { readonly kind: "literal"; readonly value: Scalar }
  | { readonly kind: "record"; readonly fields: Bindings }
  | { readonly kind: "get"; readonly path: readonly string[] }
  | { readonly kind: "if"; readonly condition: Expr; readonly yes: Expr; readonly no: Expr }
  | { readonly kind: "map" | "filter"; readonly source: Expr; readonly as: string; readonly body: Expr }
  | {
      readonly kind: "scan"
      readonly source: Expr
      readonly as: string
      readonly seed: Expr
      readonly step: Expr
      readonly output: Expr
    }
  | { readonly kind: "call"; readonly run: ReturnType<typeof readOperator>["run"]; readonly args: readonly Expr[] }

export type Bindings = readonly (readonly [string, Expr])[]

const reserved = new Set(["data", "token", "frame", "variant", "i", "acc", "next"])
export const binding = (raw: unknown): string => {
  const bind = name(raw)
  return reserved.has(bind) ? reject() : bind
}

export function readExpr(raw: unknown, depth: number, charge: () => void): Expr {
  checkDepth(depth)
  charge()
  const read = (arg: unknown) => readExpr(arg, depth + 1, charge)
  if (!isList(raw)) {
    if (raw === null || typeof raw !== "object") return { kind: "literal", value: scalar(raw) }
    return { kind: "record", fields: entries(raw, 32).map(([key, value]) => [name(key), read(value)]) }
  }
  if (raw.length > 65) return reject("limit")
  const op = name(raw[0])
  switch (op) {
    case "get":
      if (raw.length !== 2) return reject()
      return { kind: op, path: path(raw[1]).split(".") }
    case "if":
      if (raw.length !== 4) return reject()
      return { kind: op, condition: read(raw[1]), yes: read(raw[2]), no: read(raw[3]) }
    case "map":
    case "filter":
      if (raw.length !== 4) return reject()
      return { kind: op, source: read(raw[1]), as: binding(raw[2]), body: read(raw[3]) }
    case "scan":
      if (raw.length !== 6) return reject()
      return {
        kind: op,
        source: read(raw[1]),
        as: binding(raw[2]),
        seed: read(raw[3]),
        step: read(raw[4]),
        output: read(raw[5]),
      }
    default: {
      const operator = readOperator(op, raw.length - 1)
      return { kind: "call", run: operator.run, args: Array.from(raw.slice(1), read) }
    }
  }
}

export function valuesOf(value: Value): Values {
  if (!isList(value)) return reject()
  return value
}

function get(scope: ValueRecord, path: readonly string[]): Value {
  let value: Value = scope
  for (const field of path) {
    if (value === null || typeof value !== "object" || isList(value) || !Object.hasOwn(value, field)) return reject()
    const found: Value | undefined = value[field]
    if (found === undefined) return reject()
    value = found
  }
  return value
}

export function evaluator(charge: (cost?: number) => void): (expr: Expr, scope: ValueRecord) => Value {
  function evaluate(expr: Expr, scope: ValueRecord): Value {
    charge()
    const read = (child: Expr) => evaluate(child, scope)
    switch (expr.kind) {
      case "literal":
        return expr.value
      case "record":
        return Object.fromEntries(expr.fields.map(([key, child]) => [key, read(child)]))
      case "get":
        charge(expr.path.length)
        return get(scope, expr.path)
      case "if":
        return read(boolean(read(expr.condition)) ? expr.yes : expr.no)
      case "map":
      case "filter": {
        const source = valuesOf(read(expr.source))
        const each = (row: Value, i: number) => evaluate(expr.body, { ...scope, [expr.as]: row, i })
        return expr.kind === "map" ? source.map(each) : source.filter((row, i) => boolean(each(row, i)))
      }
      case "scan": {
        let acc = read(expr.seed)
        return valuesOf(read(expr.source)).map((row, i) => {
          const scoped = { ...scope, [expr.as]: row, i, acc }
          const next = evaluate(expr.step, scoped)
          const output = evaluate(expr.output, { ...scoped, next })
          acc = next
          return output
        })
      }
      case "call": {
        const result = expr.run(expr.args.map(read), charge)
        return typeof result === "number" ? numeric(result) : result
      }
    }
  }
  return evaluate
}
