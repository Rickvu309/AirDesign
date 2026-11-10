import type { DeckId } from "@airdesign/catalog"
import type { NodeName } from "@airdesign/document"

export const databaseName = "airdesign"
export const storeName = "rows"
export const rowCap = 65536

export type ConfirmedRow = {
  readonly kind: "confirmed"
  readonly deck: DeckId
  readonly revision: number
  readonly value: string
  readonly node?: NodeName
}

export type PendingRow = {
  readonly kind: "pending"
  readonly deck: DeckId
  readonly order: number
  readonly base: number
  readonly value: string
  readonly node?: NodeName
}

export type StoredRow = ConfirmedRow | PendingRow

export function rowKey(deck: string, kind: "confirmed" | "pending", number: number): string {
  const tag = kind === "confirmed" ? "c" : "p"
  return `${deck}\u0000${tag}\u0000${String(number).padStart(12, "0")}`
}

export function rowBytes(row: StoredRow): number {
  return new TextEncoder().encode(JSON.stringify(row)).length
}

export function confirmedRow(deck: DeckId, revision: number, value: string, node?: NodeName): ConfirmedRow {
  if (node === undefined) return { kind: "confirmed", deck, revision, value }
  return { kind: "confirmed", deck, revision, value, node }
}

export function pendingRow(deck: DeckId, order: number, base: number, value: string, node?: NodeName): PendingRow {
  if (node === undefined) return { kind: "pending", deck, order, base, value }
  return { kind: "pending", deck, order, base, value, node }
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
  value: string,
  node: NodeName | undefined,
  into: ConfirmedRow[],
): number {
  let offset = 0
  let part = 0
  if (value.length === 0) {
    const row = confirmedRow(deck, revision, "", node)
    if (rowBytes(row) >= rowCap) return revision
    into.push(row)
    return revision + 1
  }
  while (offset < value.length) {
    let count = value.length - offset
    let row = confirmedRow(deck, revision, piece(part, value, offset, count), node)
    while (rowBytes(row) >= rowCap && count > 1) {
      count = Math.ceil(count / 2)
      row = confirmedRow(deck, revision, piece(part, value, offset, count), node)
    }
    if (rowBytes(row) >= rowCap) return revision
    into.push(row)
    offset += count
    revision += 1
    part += 1
  }
  return revision
}

export function logicalValues(rows: readonly ConfirmedRow[]): string[] {
  const values: string[] = []
  for (const row of rows) {
    if (row.value.startsWith("\u0001") && values.length > 0) {
      const last = values.at(-1)
      if (last !== undefined) values[values.length - 1] = `${last}${row.value.slice(1)}`
      continue
    }
    values.push(row.value)
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
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite")
        transaction.objectStore(storeName).put(value, key)
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
