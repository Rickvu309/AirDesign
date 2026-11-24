import { boolean, naming, reject } from "../read-kit.js"
import { type NumberFormat, readOperator } from "./operators.js"
import {
  type Charge,
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
  return reserved.has(bind) ? reject("shape", `The name "${bind}" is reserved.`) : bind
}

export function readExpr(raw: unknown, depth: number, charge: () => void): Expr {
  checkDepth(depth)
  charge()
  const read = (arg: unknown, at: string) => naming(at, () => readExpr(arg, depth + 1, charge))
  if (!isList(raw)) {
    if (raw === null || typeof raw !== "object") return { kind: "literal", value: scalar(raw) }
    return { kind: "record", fields: entries(raw, 32).map(([key, value]) => [name(key), read(value, key)]) }
  }
  if (raw.length > 65) return reject("limit", "At most 64 expression arguments.")
  const op = naming("[0]", () => name(raw[0]))
  const arity = (args: number) => {
    if (raw.length !== args + 1) reject("shape", `"${op}" takes ${args} arguments.`)
  }
  const arg = (index: number) => read(raw[index], `[${index}]`)
  switch (op) {
    case "get":
      arity(1)
      return { kind: op, path: naming("[1]", () => path(raw[1]).split(".")) }
    case "if":
      arity(3)
      return { kind: op, condition: arg(1), yes: arg(2), no: arg(3) }
    case "map":
    case "filter":
      arity(3)
      return { kind: op, source: arg(1), as: naming("[2]", () => binding(raw[2])), body: arg(3) }
    case "scan":
      arity(5)
      return {
        kind: op,
        source: arg(1),
        as: naming("[2]", () => binding(raw[2])),
        seed: arg(3),
        step: arg(4),
        output: arg(5),
      }
    default: {
      const operator = readOperator(op, raw.length - 1)
      return { kind: "call", run: operator.run, args: Array.from(raw.slice(1), (_, i) => arg(i + 1)) }
    }
  }
}

export function valuesOf(value: Value): Values {
  if (!isList(value)) return reject("shape", "A list.")
  return value
}

export type Scope = { readonly parent?: Scope; readonly values: ValueRecord }

export function childScope(parent: Scope, values: ValueRecord, charge: Charge): Scope {
  charge(1 + Object.keys(values).length)
  return { parent, values }
}

function get(scope: Scope, path: readonly string[], charge: Charge): Value {
  const head = path[0]!
  let value: Value | undefined
  for (let at: Scope | undefined = scope; at !== undefined; at = at.parent) {
    charge()
    if (!Object.hasOwn(at.values, head)) continue
    value = at.values[head]
    break
  }
  for (let i = 1; value !== undefined && i < path.length; i += 1) {
    charge()
    const field = path[i]!
    value =
      value !== null && typeof value === "object" && !isList(value) && Object.hasOwn(value, field)
        ? value[field]
        : undefined
  }
  return value === undefined ? reject("shape", `Unknown value "${path.join(".")}".`) : value
}

export function evaluator(charge: Charge, format: NumberFormat): (expr: Expr, scope: Scope) => Value {
  function evaluate(expr: Expr, scope: Scope): Value {
    charge()
    const read = (child: Expr, at: string) => naming(at, () => evaluate(child, scope))
    switch (expr.kind) {
      case "literal":
        return expr.value
      case "record":
        return Object.fromEntries(expr.fields.map(([key, child]) => [key, read(child, key)]))
      case "get":
        return get(scope, expr.path, charge)
      case "if":
        return naming("[1]", () => boolean(evaluate(expr.condition, scope)))
          ? read(expr.yes, "[2]")
          : read(expr.no, "[3]")
      case "map":
      case "filter": {
        const source = naming("[1]", () => valuesOf(evaluate(expr.source, scope)))
        if (expr.kind === "map")
          return naming("[3]", () =>
            source.map((row, i) => evaluate(expr.body, childScope(scope, { [expr.as]: row, i }, charge))),
          )
        return naming("[3]", () =>
          source.filter((row, i) => boolean(evaluate(expr.body, childScope(scope, { [expr.as]: row, i }, charge)))),
        )
      }
      case "scan": {
        let acc = read(expr.seed, "[3]")
        const source = naming("[1]", () => valuesOf(evaluate(expr.source, scope)))
        return source.map((row, i) => {
          const scoped = naming("[4]", () => childScope(scope, { [expr.as]: row, i, acc }, charge))
          const next = naming("[4]", () => evaluate(expr.step, scoped))
          const output = naming("[5]", () => evaluate(expr.output, childScope(scoped, { next }, charge)))
          acc = next
          return output
        })
      }
      case "call": {
        const result = expr.run(
          expr.args.map((arg, i) => read(arg, `[${i + 1}]`)),
          charge,
          format,
        )
        return typeof result === "number" ? numeric(result) : result
      }
    }
  }
  return evaluate
}
