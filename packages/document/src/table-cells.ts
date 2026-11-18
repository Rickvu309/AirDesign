import { record } from "./plain-object.js"
import { border } from "./trait-border.js"
import { readValue, type ValueOf } from "./value-kind.js"

export const tableSides = ["top", "right", "bottom", "left"] as const
export const borderSides = ["all", "outside", "inside", "top", "bottom", "left", "right"] as const

export type TableSide = (typeof tableSides)[number]
export type BorderSides = (typeof borderSides)[number]
export type CellFill = ValueOf<typeof border.fields.fill>
export type Border = {
  readonly fill?: CellFill
  readonly width?: number
  readonly dash?: ValueOf<typeof border.fields.dash>
}
export type Borders = { readonly [S in TableSide]?: Border }
export type CellRange = { readonly rows: readonly [number, number]; readonly columns: readonly [number, number] }

export const cellFill = border.fields.fill
export const borderKinds = { fill: border.fields.fill, width: border.fields.width, dash: border.fields.dash } as const

function known(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(value)
  return own.length > 0 && own.every((key) => keys.includes(key))
}

export function readCellFill(raw: unknown): CellFill | null {
  return readValue(cellFill, raw)
}

function readBorder(raw: unknown): Border | null {
  const sides = record(raw)
  if (sides === null || !known(sides, Object.keys(borderKinds))) return null
  const read: Record<string, unknown> = {}
  for (const [name, kind] of Object.entries(borderKinds)) {
    if (!Object.hasOwn(sides, name)) continue
    const value = readValue<unknown>(kind, sides[name])
    if (value === null) return null
    read[name] = value
  }
  return read as Border
}

export function readBorders(raw: unknown): Borders | null {
  const borders = record(raw)
  if (borders === null || !known(borders, tableSides)) return null
  const read: Partial<Record<TableSide, Border>> = {}
  for (const side of tableSides) {
    if (!Object.hasOwn(borders, side)) continue
    const border = readBorder(borders[side])
    if (border === null) return null
    read[side] = border
  }
  return read
}

export function readCellList<T>(raw: unknown, count: number, read: (raw: unknown) => T | null): (T | null)[] | null {
  if (!Array.isArray(raw) || raw.length !== count) return null
  const items: (T | null)[] = []
  for (const each of raw) {
    if (each === null) {
      items.push(null)
      continue
    }
    const item = read(each)
    if (item === null) return null
    items.push(item)
  }
  return items
}

export function heldCells<T>(items: readonly (T | null)[] | undefined): readonly (T | null)[] | undefined {
  return items?.some((item) => item !== null) === true ? items : undefined
}

export function inRange(range: CellRange, rows: number, columns: number): boolean {
  const [top, bottom] = range.rows
  const [left, right] = range.columns
  const whole = [top, bottom, left, right].every(Number.isInteger)
  return whole && top >= 0 && top <= bottom && bottom < rows && left >= 0 && left <= right && right < columns
}

function edges(from: number, to: number, sides: BorderSides, first: BorderSides, last: BorderSides): number[] {
  const all = Array.from({ length: to - from + 2 }, (_, at) => from + at)
  if (sides === "all") return all
  if (sides === "outside") return [from, to + 1]
  if (sides === "inside") return all.slice(1, -1)
  if (sides === first) return [from]
  return sides === last ? [to + 1] : []
}

export type BorderSpot = { readonly row: number; readonly column: number; readonly side: TableSide }

export function borderSpots(range: CellRange, sides: BorderSides, rows: number, columns: number): BorderSpot[] {
  const [top, bottom] = range.rows
  const [left, right] = range.columns
  const spots: BorderSpot[] = []
  const across = Array.from({ length: right - left + 1 }, (_, at) => left + at)
  const down = Array.from({ length: bottom - top + 1 }, (_, at) => top + at)
  for (const edge of edges(top, bottom, sides, "top", "bottom"))
    for (const column of across) {
      if (edge > 0) spots.push({ row: edge - 1, column, side: "bottom" })
      if (edge < rows) spots.push({ row: edge, column, side: "top" })
    }
  for (const edge of edges(left, right, sides, "left", "right"))
    for (const row of down) {
      if (edge > 0) spots.push({ row, column: edge - 1, side: "right" })
      if (edge < columns) spots.push({ row, column: edge, side: "left" })
    }
  return spots
}
