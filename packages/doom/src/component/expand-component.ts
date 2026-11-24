import type { Measure, Refusal, Theme } from "../index.js"
import { boolean, detailOf, reject } from "../read-kit.js"
import { readData } from "./collections.js"
import { type Bindings, evaluator, valuesOf } from "./expression.js"
import { type ComponentTree, type PreparedPart, preparePart, readFrame, treeOf } from "./nodes.js"
import { type ComponentSpec, type Part, readChoices, readTokens } from "./spec.js"
import { type Value, type ValueRecord, budget } from "./values.js"

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
    const charge = budget(80_000)
    const evaluate = evaluator(charge)
    const { theme, measure } = input
    const frame = readFrame(input.frame)
    const scope = {
      frame,
      data: readData(spec.collections, input.data),
      token: readTokens(spec, input.themeTokens ?? {}, input.tokens ?? {}),
      variant: readChoices(spec, input.variant ?? {}),
    }

    const bind = (bindings: Bindings | undefined, parent: ValueRecord): ValueRecord => {
      if (bindings === undefined) return parent
      const scope: Record<string, Value> = { ...parent }
      for (const [name, expr] of bindings) scope[name] = evaluate(expr, scope)
      return scope
    }

    const parts: PreparedPart[] = []
    const visit = (part: Part, parent: ValueRecord): void => {
      charge()
      const emit = (scope: ValueRecord) => {
        charge()
        const local = bind(part.let, scope)
        if (part.when !== undefined && !boolean(evaluate(part.when, local))) return
        if ("children" in part) {
          for (const child of part.children) visit(child, local)
          return
        }
        const prepared = preparePart(part.emit, (expr) => evaluate(expr, local), measure, theme)
        if (prepared === undefined) return
        if (parts.length >= 499) return reject("limit")
        parts.push(prepared)
      }
      if (part.repeat === undefined) {
        emit(parent)
        return
      }
      const { over, as } = part.repeat
      for (const [i, row] of valuesOf(evaluate(over, parent)).entries()) emit({ ...parent, [as]: row, i })
    }

    const root = bind(spec.let, scope)
    for (const part of spec.parts) visit(part, root)
    return treeOf(spec.name, frame, parts)
  } catch (thrown) {
    return detailOf(thrown)
  }
}
