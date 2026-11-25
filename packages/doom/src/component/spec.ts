import { readColor } from "../color.js"
import type { Refusal } from "../refusal.js"
import { boolean, finite, integer, naming, object, reject, variant } from "../read-kit.js"
import { readCollections } from "./collections.js"
import { type Bindings, type Expr, binding, readExpr } from "./expression.js"
import { defaultNumberTokens, readLocale } from "./operators.js"
import {
  budget,
  checkDepth,
  componentRefusal,
  entries,
  isList,
  name,
  numeric,
  path,
  scalar,
  token,
  wordsWithin,
} from "./values.js"

export const tokenRecord = (raw: unknown): Readonly<Record<string, ReturnType<typeof token>>> =>
  Object.fromEntries(
    entries(raw, 64).map(([key, value]) => {
      switch (key) {
        case "number.locale":
          return [key, naming(key, () => readLocale(value))]
        case "number.group":
          return [key, naming(key, () => boolean(value))]
        default:
          return [name(key), naming(key, () => token(value))]
      }
    }),
  )

function variantValue(raw: unknown): string | boolean {
  const value = scalar(raw)
  return typeof value === "string" || typeof value === "boolean"
    ? value
    : reject("shape", "A string or boolean variant.")
}

export const variantRecord = (raw: unknown): Readonly<Record<string, string | boolean>> =>
  Object.fromEntries(entries(raw, 16).map(([key, value]) => [name(key), naming(key, () => variantValue(value))]))

const variants = (raw: unknown) =>
  Object.fromEntries(
    entries(raw, 16).map(([key, rawChoices]) => [
      name(key),
      naming(key, () => {
        if (!isList(rawChoices) || rawChoices.length === 0)
          return reject("shape", "A non-empty list of variant choices.")
        if (rawChoices.length > 16) return reject("limit", "At most 16 variant choices.")
        const choices = Array.from(rawChoices, (choice, i) => naming(`[${i}]`, () => variantValue(choice)))
        if (new Set(choices).size !== choices.length) return reject("shape", "Variant choices must be unique.")
        return choices
      }),
    ]),
  )

const quantity = object({
  baseUnit: (raw) => {
    const unit = wordsWithin(32)(raw)
    return unit.trim() === "" ? reject("shape", "A non-empty unit.") : unit
  },
  storedScale: (raw) => {
    const scale = numeric(raw)
    return scale > 0 ? scale : reject("shape", "The stored scale must be positive.")
  },
})

const quantities = (raw: unknown) =>
  Object.fromEntries(entries(raw, 32).map(([field, value]) => [path(field), naming(field, () => quantity(value))]))

function emission(read: (raw: unknown) => Expr) {
  const position = { key: read, x: read, y: read, w: read, h: read }
  const readFit = object({ smaller: read }, { group: name, thin: finite(0, 1_000) })
  const fitText = (raw: unknown) => {
    const fit = readFit(raw)
    if (fit.thin !== undefined && fit.group === undefined)
      naming("thin", () => reject("shape", "Thinning requires a fit group."))
    return fit
  }
  const stroke = object({ color: read, width: read })
  const surface = { stroke, radius: read }
  return variant("kind", {
    rect: object({ ...position, fill: read }, surface),
    path: object({ ...position, d: read }, { fill: read, fillStroke: boolean, stroke }),
    text: object(
      { ...position, chars: read, style: read, color: read, align: read, alignV: read },
      { ...surface, fill: read, padding: read, fit: (raw: unknown) => (raw === "omit" ? raw : fitText(raw)) },
    ),
    line: object(
      { key: read, start: read, end: read, color: read, width: read, route: read, arrow: read },
      { dash: read, channels: read },
    ),
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
  const charge = budget(12_000, "A spec may contain at most 12,000 parts and expression terms.")
  const expression = (raw: unknown) => readExpr(raw, 0, charge)
  const readBindings = (raw: unknown): Bindings => {
    if (!isList(raw)) return reject("shape", "A list of let bindings.")
    if (raw.length > 32) return reject("limit", "At most 32 bindings in a let.")
    const names = new Set<string>()
    return Array.from(raw, (pair, i) =>
      naming(`[${i}]`, (): [string, Expr] => {
        if (!isList(pair) || pair.length !== 2) return reject("shape", "A binding with a name and an expression.")
        const bind = naming("[0]", () => binding(pair[0]))
        if (names.has(bind)) return reject("shape", `Duplicate binding "${bind}".`)
        names.add(bind)
        return [bind, naming("[1]", () => expression(pair[1]))]
      }),
    )
  }
  const scope = {
    repeat: object({ over: expression, as: binding }),
    let: readBindings,
    when: expression,
  }
  const readLeaf = object({ emit: emission(expression) }, scope)
  const readParts = (raw: unknown, depth: number): readonly Part[] => {
    checkDepth(depth)
    if (!isList(raw)) return reject("shape", "A list of parts.")
    if (raw.length > 64) return reject("limit", "At most 64 parts at one level.")
    const readGroup = object({ children: (children) => readParts(children, depth + 1) }, scope)
    return Array.from(raw, (part, i) =>
      naming(`[${i}]`, () => {
        charge()
        return typeof part === "object" && part !== null && Object.hasOwn(part, "children")
          ? readGroup(part)
          : readLeaf(part)
      }),
    )
  }
  return object(
    {
      version: integer(1, 1),
      name: (raw) => {
        const title = wordsWithin(200)(raw)
        return title.trim() === "" ? reject("shape", "A non-empty component name.") : title
      },
      collections: readCollections,
      parts: (raw) => readParts(raw, 0),
    },
    {
      let: readBindings,
      layout: expression,
      defaults: tokenRecord,
      variants,
      defaultVariant: variantRecord,
      quantities,
    },
  )
}

export type ComponentSpec = ReturnType<ReturnType<typeof specReader>>

export function readComponentSpec(raw: unknown): ComponentSpec | Refusal {
  try {
    const spec = specReader()(raw)
    if (Object.keys(spec.variants ?? {}).length !== Object.keys(spec.defaultVariant ?? {}).length)
      return naming("defaultVariant", () => reject("shape", "One default choice per variant."))
    naming("defaultVariant", () => readChoices(spec, {}))
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
        type.kind === "string" ||
        type.kind === "string?"
      )
        return naming(`quantities.${key}`, () => reject("shape", "The quantity must name a numeric collection field."))
    }
    return spec
  } catch (thrown) {
    return componentRefusal(thrown)
  }
}

export function readChoices(spec: ComponentSpec, raw: unknown): Readonly<Record<string, string | boolean>> {
  const choices = { ...spec.defaultVariant, ...variantRecord(raw) }
  for (const [name, value] of Object.entries(choices)) {
    const variants = spec.variants
    if (variants === undefined || !Object.hasOwn(variants, name) || variants[name]?.includes(value) !== true)
      return naming(name, () => reject("shape", `"${value}" is not a declared choice for variant "${name}".`))
  }
  return choices
}

export function readTokens(
  spec: ComponentSpec,
  theme: unknown,
  raw: unknown,
): Readonly<Record<string, ReturnType<typeof token>>> {
  const themeTokens = naming("themeTokens", () => tokenRecord(theme))
  const defaults: ReturnType<typeof tokenRecord> = {
    ...themeTokens,
    ...spec.defaults,
    "number.locale":
      themeTokens["number.locale"] ?? spec.defaults?.["number.locale"] ?? defaultNumberTokens["number.locale"],
    "number.group":
      themeTokens["number.group"] ?? spec.defaults?.["number.group"] ?? defaultNumberTokens["number.group"],
  }
  const tokens = naming("tokens", () => tokenRecord(raw))
  for (const [name, value] of Object.entries(tokens)) {
    const initial = Object.hasOwn(defaults, name) ? defaults[name] : undefined
    if (initial === undefined) return naming(`tokens.${name}`, () => reject("shape", `Unknown token "${name}".`))
    if (readColor(initial) !== undefined ? readColor(value) === undefined : typeof initial !== typeof value)
      return naming(`tokens.${name}`, () => reject("shape", "The token must match its default value's type."))
  }
  return { ...defaults, ...tokens }
}
