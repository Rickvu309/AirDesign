import {
  changedTable,
  currentValue,
  history,
  limits,
  bytesOf,
  readTableValue,
  writeTableValue,
  type Register,
  type TableChange,
} from "@airdesign/document"
import { readTable, writeTable, type ReadShape } from "@airdesign/pptx"

type Parts = ReadonlyMap<string, Uint8Array>

function fileTable(parts: Parts, shape: ReadShape) {
  try {
    return readTable(parts, shape.part, shape.shape)
  } catch {
    return null
  }
}

export function fileTableValue(parts: Parts, shape: ReadShape): string | null {
  const table = fileTable(parts, shape)
  return table === null ? null : writeTableValue(table)
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

export function tableEdited(register: Register): boolean {
  return register.nodes.some((node) => {
    const body = register.elements[node]
    return body !== undefined && history(body).length > 0 && readTableValue(currentValue(body)) !== null
  })
}
