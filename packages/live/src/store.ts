import type { DeckId } from "@airdesign/catalog"
import {
  bytesOf,
  limits,
  storedValue,
  type ElementId,
  type SlideCommand,
  type SlideId,
  type Value,
} from "@airdesign/document"

export const databaseName = "airdesign"
export const storeName = "rows"

export type ConfirmedRow = Value & {
  readonly kind: "confirmed"
  readonly deck: DeckId
  readonly revision: number
  readonly node?: ElementId
  readonly slideFile?: readonly SlideId[]
  readonly slideEdit?: SlideCommand
}

export type PendingRow = Value & {
  readonly kind: "pending"
  readonly once?: string
  readonly deck: DeckId
  readonly order: number
  readonly base: number
  readonly node?: ElementId
  readonly floor?: string
  readonly slideFile?: readonly SlideId[]
  readonly slideEdit?: SlideCommand
}

export type StoredRow = ConfirmedRow | PendingRow

export function rowKey(deck: string, kind: "confirmed" | "pending", number: number): string {
  const tag = kind === "confirmed" ? "c" : "p"
  return `${deck}\u0000${tag}\u0000${String(number).padStart(12, "0")}`
}

export function rowBytes(row: StoredRow): number {
  return bytesOf(JSON.stringify(row))
}

export function confirmedRow(deck: DeckId, revision: number, edit: Value, node?: ElementId): ConfirmedRow {
  if (node === undefined) return { kind: "confirmed", deck, revision, ...storedValue(edit) }
  return { kind: "confirmed", deck, revision, ...storedValue(edit), node }
}

export function pendingRow(
  deck: DeckId,
  order: number,
  base: number,
  edit: Value,
  node: ElementId,
  floor: string | undefined,
): PendingRow {
  if (floor === undefined) return { kind: "pending", deck, order, base, ...storedValue(edit), node }
  return { kind: "pending", deck, order, base, ...storedValue(edit), node, floor }
}

export function isConfirmed(row: StoredRow): row is ConfirmedRow {
  return row.kind === "confirmed"
}

export function isPending(row: StoredRow): row is PendingRow {
  return row.kind === "pending"
}

export function fitConfirmed(
  deck: DeckId,
  revision: number,
  edit: Value,
  node: ElementId | undefined,
  into: ConfirmedRow[],
): number {
  if (edit.property === "box") {
    into.push(confirmedRow(deck, revision, edit, node))
    return revision + 1
  }
  const value = edit.value
  let offset = 0
  let part = 0
  if (value.length === 0) {
    const row = confirmedRow(deck, revision, { value: "" }, node)
    if (rowBytes(row) >= limits.row) return revision
    into.push(row)
    return revision + 1
  }
  while (offset < value.length) {
    let count = value.length - offset
    let row = confirmedRow(deck, revision, { value: piece(part, value, offset, count) }, node)
    while (rowBytes(row) >= limits.row && count > 1) {
      count = Math.ceil(count / 2)
      row = confirmedRow(deck, revision, { value: piece(part, value, offset, count) }, node)
    }
    if (rowBytes(row) >= limits.row) return revision
    into.push(row)
    offset += count
    revision += 1
    part += 1
  }
  return revision
}

export type LogicalValue = Value & { readonly node?: ElementId }

export function logicalValues(rows: readonly ConfirmedRow[]): LogicalValue[] {
  const values: LogicalValue[] = []
  for (const row of rows) {
    if (row.slideEdit !== undefined) continue
    const last = values.at(-1)
    if (row.property !== "box" && row.value.startsWith("\u0001") && last !== undefined && last.property !== "box") {
      values[values.length - 1] = { ...last, value: `${last.value}${row.value.slice(1)}` }
      continue
    }
    values.push(row.node === undefined ? storedValue(row) : { ...storedValue(row), node: row.node })
  }
  return values
}

function piece(part: number, value: string, offset: number, count: number): string {
  const text = value.slice(offset, offset + count)
  if (part === 0) return text
  return `\u0001${text}`
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function readRows(deck: string): Promise<StoredRow[]> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly")
        const request = transaction
          .objectStore(storeName)
          .getAll(IDBKeyRange.bound(`${deck}\u0000`, `${deck}\u0000\uffff`))
        let rows: StoredRow[] = []
        request.onsuccess = () => {
          rows = request.result as StoredRow[]
        }
        request.onerror = () => {
          database.close()
          reject(request.error)
        }
        transaction.oncomplete = () => {
          database.close()
          resolve(rows)
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
      }),
  )
}

export function writeRows(
  puts: readonly { readonly key: string; readonly row: StoredRow }[],
  deletes: readonly string[],
): Promise<void> {
  if (puts.length === 0 && deletes.length === 0) return Promise.resolve()
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite")
        const store = transaction.objectStore(storeName)
        for (const key of deletes) store.delete(key)
        for (const put of puts) store.put(put.row, put.key)
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
        transaction.onabort = () => {
          database.close()
          reject(transaction.error)
        }
      }),
  )
}

export type RowChange<Result> = {
  readonly puts: readonly { readonly key: string; readonly row: StoredRow }[]
  readonly result: Result
}

export function changeRows<Result>(deck: string, change: (rows: StoredRow[]) => RowChange<Result>): Promise<Result> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite")
        const store = transaction.objectStore(storeName)
        const request = store.getAll(IDBKeyRange.bound(`${deck}\u0000`, `${deck}\u0000\uffff`))
        let changed: RowChange<Result> | undefined
        request.onsuccess = () => {
          changed = change(request.result as StoredRow[])
          for (const put of changed.puts) store.put(put.row, put.key)
        }
        request.onerror = () => {
          database.close()
          reject(request.error)
        }
        transaction.oncomplete = () => {
          database.close()
          if (changed === undefined) reject(new Error("rows were not read"))
          else resolve(changed.result)
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
        transaction.onabort = () => {
          database.close()
          reject(transaction.error)
        }
      }),
  )
}

export function readSlot(key: string): Promise<unknown> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly")
        const request = transaction.objectStore(storeName).getAll(IDBKeyRange.bound(key, key))
        let value: unknown = null
        request.onsuccess = () => {
          const rows = request.result as unknown[]
          value = rows[0] ?? null
        }
        request.onerror = () => {
          database.close()
          reject(request.error)
        }
        transaction.oncomplete = () => {
          database.close()
          resolve(value)
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
      }),
  )
}

export function writeSlot(key: string, value: unknown): Promise<void> {
  return putSlots([{ key, value }])
}

export function installSlots(
  absent: string,
  puts: readonly { readonly key: string; readonly value: unknown }[],
): Promise<void> {
  return putSlots(puts, absent)
}

function putSlots(puts: readonly { readonly key: string; readonly value: unknown }[], absent?: string): Promise<void> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite")
        const store = transaction.objectStore(storeName)
        const put = () => {
          for (const { key, value } of puts) store.put(value, key)
        }
        if (absent === undefined) put()
        else {
          const request = store.getAll(IDBKeyRange.bound(absent, absent))
          request.onsuccess = () => {
            if (request.result.length === 0) put()
          }
        }
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
        transaction.onabort = () => {
          database.close()
          reject(transaction.error)
        }
      }),
  )
}

export function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
