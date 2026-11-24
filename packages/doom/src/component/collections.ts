import { reject } from "../read-kit.js"
import { type ValueRecord, entries, id, isList, name, numeric, wordsWithin } from "./values.js"

type Field =
  | { readonly kind: "string" | "number" | "number?" | "positive" | "nonnegative" }
  | { readonly kind: "enum"; readonly choices: readonly string[] }
  | { readonly kind: "ref"; readonly table: string }

type Fields = Readonly<Record<string, Field>>
type Collections = Readonly<Record<string, Fields>>

const readLabel = wordsWithin(200)

function readField(raw: unknown): Field {
  if (isList(raw)) {
    if (raw.length > 32) return reject("limit")
    const choices = Array.from(raw, readLabel)
    if (choices.length === 0 || new Set(choices).size !== choices.length) return reject()
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
  return reject()
}

export function readCollections(raw: unknown): Collections {
  const tables = Object.fromEntries(
    entries(raw, 16).map(([table, rawFields]) => [
      name(table),
      Object.fromEntries(
        entries(rawFields, 16).map(([field, type]) => {
          if (field === "id") return reject()
          return [name(field), readField(type)]
        }),
      ),
    ]),
  )
  for (const fields of Object.values(tables))
    for (const field of Object.values(fields))
      if (field.kind === "ref" && !Object.hasOwn(tables, field.table)) return reject()
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
      return field.choices.includes(value) ? value : reject()
    }
    case "number":
      return numeric(raw)
    case "number?":
      return raw === null ? null : numeric(raw)
    case "positive": {
      const value = numeric(raw)
      return value > 0 ? value : reject()
    }
    case "nonnegative": {
      const value = numeric(raw)
      return value >= 0 ? value : reject()
    }
  }
}

export function readData(schema: Collections, raw: unknown): ValueRecord {
  const ids = new Map<string, Set<string>>()
  const references: { table: string; value: string }[] = []
  const tables = entries(raw, 16).map(([table, rawRows]) => {
    const fields = Object.hasOwn(schema, table) ? schema[table] : undefined
    if (fields === undefined || !isList(rawRows)) return reject()
    if (rawRows.length > 100) return reject("limit")
    const rowIds = new Set<string>()
    ids.set(table, rowIds)
    const rows = Array.from(rawRows, (rawRow) => {
      const row = Object.fromEntries(entries(rawRow, 17))
      const rowId = id(Object.hasOwn(row, "id") ? row.id : undefined)
      if (rowIds.has(rowId) || Object.keys(row).length !== Object.keys(fields).length + 1) return reject()
      rowIds.add(rowId)
      const values = Object.entries(fields).map(([name, field]) => {
        const value = readValue(field, Object.hasOwn(row, name) ? row[name] : undefined)
        if (field.kind === "ref" && typeof value === "string") references.push({ table: field.table, value })
        return [name, value] as const
      })
      return Object.fromEntries([["id", rowId], ...values])
    })
    return [table, rows] as const
  })
  if (tables.length !== Object.keys(schema).length) return reject()
  for (const { table, value } of references) if (ids.get(table)?.has(value) !== true) return reject()
  return Object.fromEntries(tables)
}
