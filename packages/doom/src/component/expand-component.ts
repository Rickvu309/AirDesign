import type { Measure, Refusal, Theme } from "../index.js"
import { boolean, naming, reject } from "../read-kit.js"
import { readData } from "./collections.js"
import { type Bindings, type Scope, childScope, evaluator, valuesOf } from "./expression.js"
import {
  type ComponentFinding,
  type ComponentTree,
  type PreparedPart,
  preparePart,
  readFrame,
  treeOf,
} from "./nodes.js"
import { numberFormat } from "./operators.js"
import { type ComponentSpec, type Part, readChoices, readTokens } from "./spec.js"
import { type Value, budget, componentRefusal } from "./values.js"

export type ComponentInput = {
  readonly data: unknown
  readonly frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly theme: Theme
  readonly measure: Measure
  readonly themeTokens?: unknown
  readonly tokens?: unknown
  readonly variant?: unknown
}

export function expandComponent(spec: ComponentSpec, input: ComponentInput): ComponentTree | Refusal {
  try {
    const charge = budget(80_000, "An expansion may use at most 80,000 work units.")
    const { theme, measure } = input
    const frame = naming("frame", () => readFrame(input.frame))
    const token = readTokens(spec, input.themeTokens ?? {}, input.tokens ?? {})
    const evaluate = evaluator(charge, numberFormat(token, charge))
    const scope: Scope = {
      values: {
        frame,
        data: naming("data", () => readData(spec.collections, input.data, charge)),
        token,
        variant: naming("variant", () => readChoices(spec, input.variant ?? {})),
      },
    }

    const bind = (bindings: Bindings | undefined, parent: Scope, field: string): Scope => {
      if (bindings === undefined || bindings.length === 0) return parent
      const values: Record<string, Value> = {}
      const scope = naming(field, () => childScope(parent, values, charge))
      for (const [i, [name, expr]] of bindings.entries()) {
        values[name] = naming(`${field}[${i}][1]`, () => {
          charge()
          return evaluate(expr, scope)
        })
      }
      return scope
    }

    const parts: PreparedPart[] = []
    const findings: ComponentFinding[] = []
    const visit = (part: Part, parent: Scope, field: string): void => {
      naming(field, () => charge())
      const emit = (scope: Scope) => {
        naming(field, () => charge())
        const local = bind(part.let, scope, `${field}.let`)
        const when = part.when
        if (when !== undefined && !naming(`${field}.when`, () => boolean(evaluate(when, local)))) return
        if ("children" in part) {
          for (const [i, child] of part.children.entries()) visit(child, local, `${field}.children[${i}]`)
          return
        }
        const emitField = `${field}.emit`
        const prepared = preparePart(part.emit, emitField, {
          read: (expr) => evaluate(expr, local),
          measure,
          theme,
          charge,
        })
        if (prepared === undefined) return
        if (prepared.kind === "text-fit") {
          findings.push(prepared)
          return
        }
        if (parts.length >= 499)
          return naming(emitField, () => reject("limit", "An expansion may emit at most 499 parts."))
        parts.push(prepared)
      }
      if (part.repeat === undefined) {
        emit(parent)
        return
      }
      const { over, as } = part.repeat
      const repeatField = `${field}.repeat.over`
      const rows = naming(repeatField, () => valuesOf(evaluate(over, parent)))
      for (const [i, row] of rows.entries())
        emit(naming(repeatField, () => childScope(parent, { [as]: row, i }, charge)))
    }
    const root = bind(spec.let, scope, "let")
    for (const [i, part] of spec.parts.entries()) visit(part, root, `parts[${i}]`)
    return treeOf(spec.name, frame, parts, findings, charge)
  } catch (thrown) {
    return componentRefusal(thrown)
  }
}
