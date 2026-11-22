type Schema = Readonly<Record<string, unknown>>
type Defs = Readonly<Record<string, Schema>>

export type Places = { readonly slide: string; readonly node: string }

const textValues = [
  "Words",
  "Line one\nLine two",
  "a\r\nb",
  "",
  JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Kept run" }] }]),
  JSON.stringify([{ from: 0, runs: [{ from: -1, text: "New run", bold: true }] }]),
  JSON.stringify([
    { from: 0, runs: [{ from: 0, text: "One" }] },
    { from: 0, runs: [{ from: 0, text: "Again" }] },
  ]),
  JSON.stringify([
    { from: 0, runs: [{ from: 0, text: "Zero" }] },
    { from: 1, runs: [{ from: 1, text: "One" }] },
  ]),
  JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Break\ninside" }] }]),
  JSON.stringify([{ from: 0, list: "bullets", level: 2, runs: [{ from: 5, text: "Far run" }] }]),
]

const colors = ["accent1", "dk2 shade 50", "tx1 lumMod 75"]

function resolved(schema: Schema, defs: Defs): Schema {
  const reference = schema.$ref
  if (typeof reference !== "string") return schema
  const { $ref: _reference, ...rest } = schema
  return resolved({ ...defs[reference.replace("#/$defs/", "")], ...rest }, defs)
}

function numbers(schema: Schema, integer: boolean): readonly number[] {
  const low =
    typeof schema.minimum === "number"
      ? schema.minimum
      : typeof schema.exclusiveMinimum === "number"
        ? schema.exclusiveMinimum + 1
        : 0
  const high =
    typeof schema.maximum === "number"
      ? schema.maximum
      : typeof schema.exclusiveMaximum === "number"
        ? schema.exclusiveMaximum - 1
        : low + 100
  const middle = integer ? Math.round((low + high) / 2) : (low + high) / 2
  return [...new Set([low, middle, high])]
}

function strings(schema: Schema, field: string, places: Places): readonly string[] {
  if (field === "value") return textValues
  if (field === "slide" || field === "after" || field === "layout") return [places.slide]
  if (field === "node" || field === "target") return [places.node]
  if (field === "stack") return ["front", "back", `above ${places.node}`, `below ${places.node}`]
  if (field === "url") return ["https://example.com/q3"]
  const pattern = typeof schema.pattern === "string" ? schema.pattern : ""
  if (pattern.includes("accent")) return colors
  if (pattern.startsWith("^https")) return []
  if (pattern !== "") return ["rocket"]
  return ["Words", "Line one\nLine two"]
}

export function samples(raw: Schema, defs: Defs, places: Places, field = "", depth = 0): readonly unknown[] {
  const schema = resolved(raw, defs)
  if (depth > 6) return []
  if (Object.hasOwn(schema, "const")) return [schema.const]
  if (Array.isArray(schema.enum)) return schema.enum
  const branches = (schema.anyOf ?? schema.oneOf) as readonly Schema[] | undefined
  if (branches !== undefined) return branches.flatMap((branch) => samples(branch, defs, places, field, depth + 1))
  const types = Array.isArray(schema.type) ? (schema.type as readonly string[]) : [schema.type]
  return types.flatMap((type): readonly unknown[] => {
    if (type === "boolean") return [true, false]
    if (type === "null") return [null]
    if (type === "integer" || type === "number") return numbers(schema, type === "integer")
    if (type === "string") return strings(schema, field, places)
    if (type === "array") {
      const item = samples((schema.items ?? {}) as Schema, defs, places, field, depth + 1)[0]
      const count = typeof schema.minItems === "number" ? Math.max(1, schema.minItems) : 1
      return item === undefined ? [] : [Array.from({ length: count }, () => item)]
    }
    if (type === "object") return objects(schema, defs, places, depth)
    return []
  })
}

function objects(schema: Schema, defs: Defs, places: Places, depth: number): readonly unknown[] {
  const properties = (schema.properties ?? {}) as Readonly<Record<string, Schema>>
  const required = Array.isArray(schema.required) ? (schema.required as readonly string[]) : []
  const base: Record<string, unknown> = {}
  for (const name of required) {
    const first = samples(properties[name] ?? {}, defs, places, name, depth + 1)[0]
    if (first === undefined) return []
    base[name] = first
  }
  const made = Object.entries(properties)
    .filter(([name]) => !required.includes(name))
    .flatMap(([name, property]) =>
      samples(property, defs, places, name, depth + 1).map((value) => ({ ...base, [name]: value })),
    )
  return made.length === 0 ? [base] : made
}

function branchFor(schema: Schema, defs: Defs, value: Readonly<Record<string, unknown>>): Schema | undefined {
  const own = resolved(schema, defs)
  const branches = (own.anyOf ?? own.oneOf) as readonly Schema[] | undefined
  const options = branches === undefined ? [own] : branches.map((branch) => resolved(branch, defs))
  return options.find((option) => {
    const properties = (option.properties ?? {}) as Readonly<Record<string, Schema>>
    return Object.keys(value).every((key) => Object.hasOwn(properties, key))
  })
}

export function variations(
  value: unknown,
  raw: Schema,
  defs: Defs,
  places: Places,
  field = "",
  depth = 0,
): readonly unknown[] {
  if (depth > 6) return []
  const whole = samples(raw, defs, places, field, depth)
  if (typeof value !== "object" || value === null) return whole
  if (Array.isArray(value)) {
    const item = resolved(raw, defs).items as Schema | undefined
    if (item === undefined || value.length === 0) return whole
    return [
      ...whole,
      ...variations(value[0], item, defs, places, field, depth + 1).map((first) => [first, ...value.slice(1)]),
    ]
  }
  const fields = value as Readonly<Record<string, unknown>>
  const branch = branchFor(raw, defs, fields)
  const properties = (branch?.properties ?? {}) as Readonly<Record<string, Schema>>
  const nested = Object.entries(fields).flatMap(([key, inner]) =>
    properties[key] === undefined
      ? []
      : variations(inner, properties[key], defs, places, key, depth + 1).map((changed) => ({
          ...fields,
          [key]: changed,
        })),
  )
  return [...whole, ...nested]
}
