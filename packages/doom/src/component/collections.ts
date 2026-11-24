import { naming, reject } from "../read-kit.js"
import { type Charge, type ValueRecord, entries, id, isList, name, numeric, wordsWithin } from "./values.js"

type Field =
  | { readonly kind: "string" | "number" | "number?" | "positive" | "nonnegative" }
  | { readonly kind: "enum"; readonly choices: readonly string[] }
  | { readonly kind: "ref"; readonly table: string }
type Fields = Readonly<Record<string, Field>>
type Collections = Readonly<Record<string, Fields>>

const readLabel = wordsWithin(200)

function readField(raw: unknown): Field {
  if (isList(raw)) {
    if (raw.length > 32) return reject("limit", "At most 32 enum choices.")
    const choices = Array.from(raw, (choice, i) => naming(`[${i}]`, () => readLabel(choice)))
    if (choices.length === 0 || new Set(choices).size !== choices.length)
      return reject("shape", "A non-empty list of distinct enum choices.")
    return { kind: "enum", choices }
  }
  switch (raw) {
    case "string":
    case "number":
    case "number?":
    case "positive":
    case "nonnegative":
      return { kind: raw }
  }
  if (typeof raw === "string" && raw.startsWith("ref:")) return { kind: "ref", table: name(raw.slice(4)) }
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

function readValue(field: Field, raw: unknown): string | number | null {
  switch (field.kind) {
    case "string":
      return readLabel(raw)
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
  }
}

export function readData(schema: Collections, raw: unknown, charge: Charge): ValueRecord {
  const ids = new Map<string, Set<string>>()
  const references: { table: string; value: string; path: string }[] = []
  const tables = entries(raw, 16).map(([table, rawRows]) =>
    naming(table, () => {
      const fields = Object.hasOwn(schema, table) ? schema[table] : undefined
      if (fields === undefined) return reject("shape", `Unknown collection "${table}".`)
      if (!isList(rawRows)) return reject("shape", "A list of rows.")
      if (rawRows.length > 100) return reject("limit", "At most 100 rows in a collection.")
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
          if (Object.keys(row).length !== fieldEntries.length + 1)
            return reject("shape", "A row must contain exactly the declared collection fields and an ID.")
          rowIds.add(rowId)
          const values = fieldEntries.map(([name, field]) => {
            const value = naming(name, () => {
              const raw = Object.hasOwn(row, name) ? row[name] : undefined
              charge(typeof raw === "string" ? 1 + raw.length : 1)
              return readValue(field, raw)
            })
            if (field.kind === "ref" && typeof value === "string")
              references.push({ table: field.table, value, path: `${table}[${i}].${name}` })
            return [name, value] as const
          })
          return Object.fromEntries([["id", rowId], ...values])
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
