import type { DeckId } from "@airdesign/catalog"
import {
  bytesOf,
  limits,
  storedValue,
  type ElementId,
  type FormatOneValue,
  type SlideCommand,
  type SlideId,
  type Value,
} from "@airdesign/document"
import { accountKey, finished, scoped, storeName, transaction } from "./device.js"
export type ConfirmedRow = Value & {
  readonly kind: "confirmed"
  readonly deck: DeckId
  readonly revision: number
  readonly node?: ElementId
  readonly slideFile?: readonly SlideId[]
  readonly slideEdit?: SlideCommand
}

export type PendingRow = FormatOneValue & {
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
  edit: FormatOneValue,
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
  if (edit.v !== undefined || edit.property === "box") {
    const row = confirmedRow(deck, revision, edit, node)
    if (rowBytes(row) >= limits.row) return revision
    into.push(row)
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
    if (
      row.v === undefined &&
      row.property !== "box" &&
      row.value.startsWith("\u0001") &&
      last !== undefined &&
      last.v === undefined &&
      last.property !== "box"
    ) {
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

export function rowRange(deck: string): IDBKeyRange {
  return IDBKeyRange.bound(`${deck}\u0000`, `${deck}\u0000\uffff`)
}

export function headKey(deck: string): string {
  return `${deck}\u0002head`
}

export function asideKey(deck: string): string {
  return `${deck}\u0003aside`
}

export function signedIn(): string {
  const account = accountKey()
  if (account === undefined) throw new Error("session")
  return account
}

export async function readRows(deck: string): Promise<StoredRow[]> {
  const account = accountKey()
  if (account === undefined) return []
  const reading = await transaction("readonly")
  const request = reading.objectStore(storeName).getAll(rowRange(scoped(account, deck)))
  return finished(reading, () => request.result as StoredRow[])
}

export async function readSlot(key: string): Promise<unknown> {
  const account = accountKey()
  if (account === undefined) return null
  const reading = await transaction("readonly")
  const request = reading.objectStore(storeName).getAll(IDBKeyRange.bound(scoped(account, key), scoped(account, key)))
  return finished(reading, () => (request.result as unknown[])[0] ?? null)
}

export function writeSlot(key: string, value: unknown): Promise<void> {
  return putSlots([{ key, value }]).then(() => undefined)
}

export function installSlots(
  absent: string,
  puts: readonly { readonly key: string; readonly value: unknown }[],
): Promise<void> {
  return putSlots(puts, { key: absent, keep: (value) => value === undefined }).then(() => undefined)
}

export function replaceSlots(puts: readonly { readonly key: string; readonly value: unknown }[]): Promise<void> {
  return putSlots(puts).then(() => undefined)
}

export async function changeSlot(key: string, change: (current: unknown) => unknown): Promise<void> {
  const account = signedIn()
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  const request = store.get(scoped(account, key))
  request.onsuccess = () => {
    store.put(change(request.result), scoped(account, key))
  }
  await finished(writing, () => undefined)
}

export function swapSlot(key: string, value: unknown, keep: (current: unknown) => boolean): Promise<boolean> {
  return putSlots([{ key, value }], { key, keep })
}

async function putSlots(
  puts: readonly { readonly key: string; readonly value: unknown }[],
  guard?: { readonly key: string; readonly keep: (current: unknown) => boolean },
): Promise<boolean> {
  const account = signedIn()
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  let written = false
  const put = () => {
    for (const { key, value } of puts) store.put(value, scoped(account, key))
    written = true
  }
  if (guard === undefined) put()
  else {
    const request = store.getAll(IDBKeyRange.bound(scoped(account, guard.key), scoped(account, guard.key)))
    request.onsuccess = () => {
      if (guard.keep((request.result as unknown[])[0])) put()
    }
  }
  return finished(writing, () => written)
}
