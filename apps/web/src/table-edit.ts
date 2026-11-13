import {
  changedTable,
  currentBox,
  currentValue,
  history,
  limits,
  bytesOf,
  readTableValue,
  writeTableValue,
  type ElementId,
  type NodeRegister,
  type TableChange,
} from "@airdesign/document"
import { applyRoute, readTable, writeTable, type ReadShape } from "@airdesign/pptx"

type Parts = ReadonlyMap<string, Uint8Array>

export function tableShape(shapes: readonly ReadShape[], id: ElementId): ReadShape | undefined {
  const named = shapes.filter((shape) => `${shape.slide}.${shape.shape}` === id)
  const shape = named[0]
  return named.length === 1 && shape?.contentKind === "table" ? shape : undefined
}

function fileTable(parts: Parts, shape: ReadShape) {
  try {
    return readTable(parts, shape.part, shape.shape)
  } catch {
    return null
  }
}

export function tableEditable(parts: Parts, shape: ReadShape): boolean {
  const table = fileTable(parts, shape)
  return table !== null && bytesOf(writeTableValue(table)) <= limits.valueBytes
}

export function tableValue(parts: Parts, shape: ReadShape, shown: string | null, change: TableChange): string | null {
  const before = (shown === null ? null : readTableValue(shown)) ?? fileTable(parts, shape)
  const next = before === null ? null : changedTable(before, change)
  if (next === null || next === before) return null
  const value = writeTableValue(next)
  if (bytesOf(value) > limits.valueBytes) return null
  try {
    writeTable(parts, shape.part, shape.shape, next)
    return value
  } catch {
    return null
  }
}

export function tableWritten(parts: Parts, shape: ReadShape, body: NodeRegister | undefined): Parts {
  if (body === undefined) return parts
  let next = parts
  if (history(body).length > 0) {
    const value = currentValue(body)
    const table = readTableValue(value)
    if (table !== null) next = writeTable(next, shape.part, shape.shape, table)
  }
  const box = body.landed.some((row) => row.visible && row.property === "box") ? currentBox(body) : null
  return box === null
    ? next
    : applyRoute(next, { name: "move", part: shape.part, shape: shape.shape, x: box.x, y: box.y })
}
