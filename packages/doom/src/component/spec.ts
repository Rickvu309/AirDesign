import { type Refusal, readColor } from "../index.js"
import { detailOf, integer, literal, object, reject, variant } from "../read-kit.js"
import { readCollections } from "./collections.js"
import { type Bindings, type Expr, binding, readExpr } from "./expression.js"
import { budget, checkDepth, entries, isList, name, numeric, path, scalar, token, wordsWithin } from "./values.js"

const tokenRecord = (raw: unknown): Readonly<Record<string, ReturnType<typeof token>>> =>
  Object.fromEntries(entries(raw, 64).map(([key, value]) => [name(key), token(value)]))

function variantValue(raw: unknown): string | boolean {
  const value = scalar(raw)
  return typeof value === "string" || typeof value === "boolean" ? value : reject()
}

const variantRecord = (raw: unknown): Readonly<Record<string, string | boolean>> =>
  Object.fromEntries(entries(raw, 16).map(([key, value]) => [name(key), variantValue(value)]))

const variants = (raw: unknown) =>
  Object.fromEntries(
    entries(raw, 16).map(([key, rawChoices]) => {
      if (!isList(rawChoices) || rawChoices.length === 0) return reject()
      if (rawChoices.length > 16) return reject("limit")
      const choices = Array.from(rawChoices, variantValue)
      if (new Set(choices).size !== choices.length) return reject()
      return [name(key), choices]
    }),
  )

const quantity = object({
  baseUnit: (raw) => {
    const unit = wordsWithin(32)(raw)
    return unit.trim() === "" ? reject() : unit
  },
  storedScale: (raw) => {
    const scale = numeric(raw)
    return scale > 0 ? scale : reject()
  },
})

const quantities = (raw: unknown) =>
  Object.fromEntries(entries(raw, 32).map(([field, value]) => [path(field), quantity(value)]))

function emission(read: (raw: unknown) => Expr) {
  const position = { key: read, x: read, y: read, w: read, h: read }
  return variant("kind", {
    rect: object({ ...position, fill: read }),
    text: object(
      { ...position, chars: read, style: read, color: read, align: read, alignV: read },
      { fit: literal(["omit"]) },
    ),
    line: object({ key: read, start: read, end: read, color: read, width: read, route: read, arrow: read }),
  })
}

export type Emission = ReturnType<ReturnType<typeof emission>>
type Scope = {
  readonly repeat?: { readonly over: Expr; readonly as: string }
  readonly let?: Bindings
  readonly when?: Expr
}
export type Part = Scope & ({ readonly emit: Emission } | { readonly children: readonly Part[] })

function specReader() {
  const charge = budget(12_000)
  const expression = (raw: unknown) => readExpr(raw, 0, charge)
  const readBindings = (raw: unknown): Bindings => {
    if (!isList(raw)) return reject()
    if (raw.length > 32) return reject("limit")
    const bindings: [string, Expr][] = Array.from(raw, (pair) => {
      if (!isList(pair) || pair.length !== 2) return reject()
      return [binding(pair[0]), expression(pair[1])]
    })
    if (new Set(bindings.map(([name]) => name)).size !== bindings.length) return reject()
    return bindings
  }
  const scope = {
    repeat: object({ over: expression, as: binding }),
    let: readBindings,
    when: expression,
  }
  const readLeaf = object({ emit: emission(expression) }, scope)
  const readParts = (raw: unknown, depth: number): readonly Part[] => {
    checkDepth(depth)
    if (!isList(raw)) return reject()
    if (raw.length > 64) return reject("limit")
    const readGroup = object({ children: (children) => readParts(children, depth + 1) }, scope)
    return Array.from(raw, (part) => {
      charge()
      return typeof part === "object" && part !== null && Object.hasOwn(part, "children")
        ? readGroup(part)
        : readLeaf(part)
    })
  }
  return object(
    {
      version: integer(1, 1),
      name: (raw) => {
        const title = wordsWithin(200)(raw)
        return title.trim() === "" ? reject() : title
      },
      collections: readCollections,
      parts: (raw) => readParts(raw, 0),
    },
    { let: readBindings, defaults: tokenRecord, variants, defaultVariant: variantRecord, quantities },
  )
}

export type ComponentSpec = ReturnType<ReturnType<typeof specReader>>

export function readComponentSpec(raw: unknown): ComponentSpec | Refusal {
  try {
    const spec = specReader()(raw)
    if (Object.keys(spec.variants ?? {}).length !== Object.keys(spec.defaultVariant ?? {}).length) return reject()
    readChoices(spec, {})
    for (const [key] of Object.entries(spec.quantities ?? {})) {
      const [table, field, extra] = key.split(".")
      const fields = table !== undefined && Object.hasOwn(spec.collections, table) ? spec.collections[table] : undefined
      const type =
        field !== undefined && fields !== undefined && Object.hasOwn(fields, field) ? fields[field] : undefined
      if (
        extra !== undefined ||
        type === undefined ||
        type.kind === "enum" ||
        type.kind === "ref" ||
        type.kind === "string"
      )
        return reject()
    }
    return spec
  } catch (thrown) {
    return detailOf(thrown)
  }
}

export function readChoices(spec: ComponentSpec, raw: unknown): Readonly<Record<string, string | boolean>> {
  const choices = { ...spec.defaultVariant, ...variantRecord(raw) }
  for (const [name, value] of Object.entries(choices)) {
    const variants = spec.variants
    if (variants === undefined || !Object.hasOwn(variants, name) || variants[name]?.includes(value) !== true)
      return reject()
  }
  return choices
}

export function readTokens(
  spec: ComponentSpec,
  theme: unknown,
  raw: unknown,
): Readonly<Record<string, ReturnType<typeof token>>> {
  const defaults = { ...tokenRecord(theme), ...spec.defaults }
  const tokens = tokenRecord(raw)
  for (const [name, value] of Object.entries(tokens)) {
    const initial = Object.hasOwn(defaults, name) ? defaults[name] : undefined
    if (initial === undefined) return reject()
    if (readColor(initial) !== undefined ? readColor(value) === undefined : typeof initial !== typeof value)
      return reject()
  }
  return { ...defaults, ...tokens }
}
