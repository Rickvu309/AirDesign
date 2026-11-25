import { naming, reject } from "../read-kit.js"
import { type Charge, type Value, color, entries, id, isList, name, numeric, wordsWithin } from "./values.js"

type Field =
  | { readonly kind: "string" | "string?" | "number" | "number?" | "positive" | "nonnegative" | "color" }
  | { readonly kind: "optional"; readonly field: Field }
  | { readonly kind: "list"; readonly item: Field }
  | { readonly kind: "enum"; readonly choices: readonly string[] }
  | { readonly kind: "ref"; readonly table: string }
type Fields = Readonly<Record<string, Field>>
type Collections = Readonly<Record<string, Fields>>

const readLabel = wordsWithin(200)

function readField(raw: unknown, position: "field" | "optional" | "item" = "field"): Field {
  if (raw !== null && typeof raw === "object" && !isList(raw) && position !== "item") {
    const [kind, value] = entries(raw, 1)[0] ?? []
    if (kind === "list") return { kind, item: readField(value, "item") }
    if (kind === "optional" && position === "field") return { kind, field: readField(value, "optional") }
    return reject("shape", "A list or optional field declaration.")
  }
  if (isList(raw)) {
    if (raw.length > 32) return reject("limit", "At most 32 enum choices.")
    const choices = Array.from(raw, (choice, i) => naming(`[${i}]`, () => readLabel(choice)))
    if (choices.length === 0 || new Set(choices).size !== choices.length)
      return reject("shape", "A non-empty list of distinct enum choices.")
    return { kind: "enum", choices }
  }
  switch (raw) {
    case "string":
    case "string?":
    case "number":
    case "number?":
    case "positive":
    case "nonnegative":
    case "color":
      return { kind: raw }
    case "number?[]":
      return { kind: "list", item: { kind: "number?" } }
    case "color?[]":
      return { kind: "list", item: { kind: "optional", field: { kind: "color" } } }
    case "color?":
      return { kind: "optional", field: { kind: "color" } }
  }
  if (position === "field" && typeof raw === "string" && raw.startsWith("ref:"))
    return { kind: "ref", table: name(raw.slice(4)) }
  return reject("shape", "A field type, a list of enum choices, or a ref:collection name.")
}

export function readCollections(raw: unknown): Collections {
  const tables = Object.fromEntries(
    entries(raw, 16).map(
      ([table, rawFields]) =>
        [
          name(table),
          naming(table, () =>
            Object.fromEntries(
              entries(rawFields, 16).map(([field, type]) =>
                naming(field, () => {
                  if (field === "id") return reject("shape", 'The name "id" is reserved for row IDs.')
                  return [name(field), readField(type)] as const
                }),
              ),
            ),
          ),
        ] as const,
    ),
  )
  for (const [table, fields] of Object.entries(tables))
    for (const [name, field] of Object.entries(fields))
      if (field.kind === "ref" && !Object.hasOwn(tables, field.table))
        return naming(`${table}.${name}`, () => reject("shape", `Unknown collection "${field.table}".`))
  return tables
}

function readScalarValue(field: Field, raw: unknown): string | number | null {
  switch (field.kind) {
    case "string":
      return readLabel(raw)
    case "string?":
      return raw === undefined || raw === null ? "" : readLabel(raw)
    case "ref":
      return id(raw)
    case "enum": {
      const value = readLabel(raw)
      return field.choices.includes(value) ? value : reject("shape", "A declared enum choice.")
    }
    case "number":
      return numeric(raw)
    case "number?":
      return raw === null ? null : numeric(raw)
    case "positive": {
      const value = numeric(raw)
      return value > 0 ? value : reject("shape", "A positive number.")
    }
    case "nonnegative": {
      const value = numeric(raw)
      return value >= 0 ? value : reject("shape", "A nonnegative number.")
    }
    case "color":
    case "optional":
    case "list":
      return reject("shape", "A scalar collection field.")
  }
}

function readValue(field: Field, raw: unknown, charge: Charge): Value {
  switch (field.kind) {
    case "optional":
      return raw === undefined || raw === null ? null : readValue(field.field, raw, charge)
    case "list":
      if (!isList(raw)) return reject("shape", "A list of field values.")
      if (raw.length > 100) return reject("limit", "At most 100 values in a field.")
      return Array.from(raw, (value, i) =>
        naming(`[${i}]`, () => {
          charge(typeof value === "string" ? 1 + value.length : 1)
          return readValue(field.item, value, charge)
        }),
      )
    case "color":
      return color(raw)
    default:
      return readScalarValue(field, raw)
  }
}

type Row<T> = Readonly<Record<string, T | string>> & { readonly id: string }
type Data<T> = Readonly<Record<string, readonly Row<T>[]>>

export function readData(schema: Collections, raw: unknown, charge: Charge) {
  return readTables(schema, raw, charge, readScalarValue, {})
}

export function readExpansionData(
  schema: Collections,
  raw: unknown,
  charge: Charge,
  limits: Readonly<Record<string, number>> = {},
) {
  return readTables(schema, raw, charge, readValue, limits)
}

function readTables<T extends Value>(
  schema: Collections,
  raw: unknown,
  charge: Charge,
  readCell: (field: Field, value: unknown, charge: Charge) => T,
  limits: Readonly<Record<string, number>>,
): Data<T> {
  const ids = new Map<string, Set<string>>()
  const references: { table: string; value: string; path: string }[] = []
  const tables = entries(raw, 16).map(([table, rawRows]) =>
    naming(table, () => {
      const fields = Object.hasOwn(schema, table) ? schema[table] : undefined
      if (fields === undefined) return reject("shape", `Unknown collection "${table}".`)
      if (!isList(rawRows)) return reject("shape", "A list of rows.")
      const limit = Object.hasOwn(limits, table) ? (limits[table] ?? 100) : 100
      if (rawRows.length > limit) return reject("limit", `At most ${limit} rows in a collection.`)
      const rowIds = new Set<string>()
      ids.set(table, rowIds)
      const fieldEntries = Object.entries(fields)
      const rows = Array.from(rawRows, (rawRow, i) =>
        naming(`[${i}]`, () => {
          charge()
          const row = Object.fromEntries(entries(rawRow, 17))
          const rowId = naming("id", () => {
            const value = id(Object.hasOwn(row, "id") ? row.id : undefined)
            return rowIds.has(value) ? reject("shape", `Duplicate row ID "${value}".`) : value
          })
          if (Object.keys(row).some((key) => key !== "id" && !Object.hasOwn(fields, key)))
            return reject("shape", "A row must contain exactly the declared collection fields and an ID.")
          rowIds.add(rowId)
          const values = fieldEntries.map(([name, field]) => {
            const value = naming(name, () => {
              const raw = Object.hasOwn(row, name) ? row[name] : undefined
              charge(typeof raw === "string" ? 1 + raw.length : 1)
              return readCell(field, raw, charge)
            })
            if (field.kind === "ref" && typeof value === "string")
              references.push({ table: field.table, value, path: `${table}[${i}].${name}` })
            return [name, value] as const
          })
          return { ...Object.fromEntries(values), id: rowId }
        }),
      )
      return [table, rows] as const
    }),
  )
  for (const table of Object.keys(schema))
    if (!ids.has(table)) return naming(table, () => reject("shape", `Collection "${table}" is required.`))
  for (const { table, value, path } of references)
    if (ids.get(table)?.has(value) !== true)
      return naming(path, () => reject("shape", `No row "${value}" in collection "${table}".`))
  return Object.fromEntries(tables)
}
