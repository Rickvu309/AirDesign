import { outlineOf, type Outline } from "./connector.js"
import type { IndexElement } from "./deck-index.js"
import type { FieldEdit } from "./row.js"

type Shaped = { readonly preset: string; readonly adjust: Readonly<Record<string, number>> }

type GeometryRows = Readonly<Record<string, FieldEdit<unknown>>> | undefined

function shapedEdit(rows: GeometryRows): Shaped | null {
  const edit = rows?.shape
  return typeof edit === "object" && edit !== null && "set" in edit ? (edit.set as Shaped) : null
}

export function drawnShape(rows: GeometryRows, opening: IndexElement | undefined, added: string | null): Shaped | null {
  const shaped = shapedEdit(rows)
  if (shaped !== null) return shaped
  const named = opening?.design?.geometry?.[0]
  const preset = typeof named === "string" ? named : added
  return preset === null ? null : { preset, adjust: {} }
}

export function outlineNow(
  rows: GeometryRows,
  opening: IndexElement | undefined,
  added: string | null,
): Outline | null {
  if (shapedEdit(rows) === null && opening?.kept?.includes("geometry") === true) return null
  const shaped = drawnShape(rows, opening, added)
  return outlineOf(shaped?.preset ?? null, shaped?.adjust ?? {})
}
