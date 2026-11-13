import type { DeckId } from "@airdesign/catalog"
import type { Register } from "@airdesign/document"
import { finished, heldDecks, scoped, storeName, transaction } from "./device.js"
import { deckView, joinable, played, readable, split, storedKey, type DeckView } from "./deck-view.js"
import {
  asideKey,
  headKey,
  rowKey,
  rowRange,
  signedIn,
  type ConfirmedRow,
  type PendingRow,
  type StoredRow,
} from "./store.js"

export type Held = {
  readonly head: number
  readonly confirmed: readonly ConfirmedRow[]
  readonly pending: readonly PendingRow[]
  readonly register: Register
  readonly before: Register | undefined
}

export type Put = { readonly key: string; readonly row: StoredRow }

export type Change<Result> = {
  readonly next?: Omit<Held, "head">
  readonly puts: readonly Put[]
  readonly result: Result
}

function headOf(raw: unknown): number {
  return typeof raw === "number" ? raw : 0
}

function load(deck: DeckId, head: number, rows: readonly StoredRow[]): Held {
  const { confirmed, pending } = split(rows)
  const last = pending.at(-1)
  return {
    head,
    confirmed,
    pending,
    register: played(deck, confirmed, pending),
    before: joinable(last) ? played(deck, confirmed, pending.slice(0, -1)) : undefined,
  }
}

function heldRow(held: Held, deck: string, key: string): StoredRow | undefined {
  return (
    held.pending.findLast((row) => storedKey(deck, row) === key) ??
    held.confirmed.findLast((row) => storedKey(deck, row) === key)
  )
}

function nextKey(deck: string, held: Held): string {
  return rowKey(deck, "pending", (held.pending.at(-1)?.order ?? -1) + 1)
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function memory(account: string, deck: string): Held | undefined {
  return heldDecks().get(scoped(account, deck)) as Held | undefined
}

function remember(account: string, deck: string, held: Held | undefined): void {
  if (held === undefined) heldDecks().delete(scoped(account, deck))
  else heldDecks().set(scoped(account, deck), held)
}

export async function changeHeld<Result>(deck: DeckId, change: (held: Held) => Change<Result>): Promise<Result> {
  const account = signedIn()
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  const head = scoped(account, headKey(deck))
  let result: Result | undefined
  let done = false
  const apply = (held: Held, planned: Change<Result>, deletes: readonly string[]) => {
    result = planned.result
    done = true
    if (planned.next === undefined && deletes.length === 0) {
      remember(account, deck, held)
      return
    }
    for (const key of deletes) store.delete(scoped(account, key))
    for (const put of planned.puts) store.put(put.row, scoped(account, put.key))
    store.put(held.head + 1, head)
    remember(account, deck, { ...(planned.next ?? held), head: held.head + 1 })
  }
  const reload = () => {
    const rows = store.getAll(rowRange(scoped(account, deck)))
    const stored = store.get(head)
    stored.onsuccess = () => {
      const all = rows.result as StoredRow[]
      const loaded = load(deck, headOf(stored.result), all.filter(readable))
      const dropped = all.filter((row) => !readable(row)).map((row) => storedKey(deck, row))
      apply(loaded, change(loaded), dropped)
    }
  }
  const known = memory(account, deck)
  if (known === undefined) reload()
  else {
    const planned = change(known)
    const stored = store.get(head)
    const keys = new Set([nextKey(deck, known), ...planned.puts.map((put) => put.key)])
    const checks = [...keys].map((key) => ({ key, request: store.get(scoped(account, key)) }))
    const last = checks.at(-1)?.request ?? stored
    last.onsuccess = () => {
      const fresh =
        headOf(stored.result) === known.head &&
        checks.every(({ key, request }) => same(request.result, heldRow(known, deck, key)))
      if (fresh) apply(known, planned, [])
      else reload()
    }
  }
  try {
    await finished(writing, () => undefined)
  } catch (error) {
    remember(account, deck, undefined)
    throw error
  }
  if (!done) throw new Error("rows were not read")
  return result as Result
}

function moved(held: Held, deck: string, puts: readonly Put[], deletes: readonly string[]): Omit<Held, "head"> {
  const gone = new Set([...deletes, ...puts.map((put) => put.key)])
  const kept = [...held.confirmed, ...held.pending].filter((row) => !gone.has(storedKey(deck, row)))
  const { confirmed, pending } = split([...kept, ...puts.map((put) => put.row)])
  const last = pending.at(-1)
  return {
    confirmed,
    pending,
    register: held.register,
    before: last !== undefined && last === held.pending.at(-1) && joinable(last) ? held.before : undefined,
  }
}

export async function writeDeckRows(
  deck: DeckId,
  puts: readonly Put[],
  deletes: readonly string[],
  register: "same" | "stale",
): Promise<void> {
  if (puts.length === 0 && deletes.length === 0) return
  const account = signedIn()
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  const head = scoped(account, headKey(deck))
  const known = memory(account, deck)
  remember(account, deck, undefined)
  for (const key of deletes) store.delete(scoped(account, key))
  for (const put of puts) store.put(put.row, scoped(account, put.key))
  const stored = store.get(head)
  stored.onsuccess = () => {
    const now = headOf(stored.result)
    store.put(now + 1, head)
    if (register === "same" && known !== undefined && known.head === now)
      remember(account, deck, { ...moved(known, deck, puts, deletes), head: now + 1 })
  }
  try {
    await finished(writing, () => undefined)
  } catch (error) {
    remember(account, deck, undefined)
    throw error
  }
}

function asideOf(raw: unknown): PendingRow[] {
  return Array.isArray(raw) ? (raw as PendingRow[]) : []
}

export async function setAside(deck: DeckId, rows: readonly PendingRow[]): Promise<void> {
  if (rows.length === 0) return
  const account = signedIn()
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  const head = scoped(account, headKey(deck))
  const slot = scoped(account, asideKey(deck))
  remember(account, deck, undefined)
  const kept = store.get(slot)
  const stored = store.get(head)
  stored.onsuccess = () => {
    store.put([...asideOf(kept.result), ...rows], slot)
    for (const row of rows) store.delete(scoped(account, rowKey(deck, "pending", row.order)))
    store.put(headOf(stored.result) + 1, head)
  }
  try {
    await finished(writing, () => undefined)
  } catch (error) {
    remember(account, deck, undefined)
    throw error
  }
}

export async function takeAside(deck: DeckId): Promise<number> {
  const account = signedIn()
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  const slot = scoped(account, asideKey(deck))
  const kept = store.get(slot)
  kept.onsuccess = () => {
    if (kept.result !== undefined) store.delete(slot)
  }
  return finished(writing, () => asideOf(kept.result).length)
}

export async function sealRows(deck: DeckId, keys: readonly string[], once: string): Promise<PendingRow[]> {
  const sealed: PendingRow[] = []
  await changeHeld(deck, (held) => {
    sealed.length = 0
    const puts: Put[] = []
    for (const key of keys) {
      const row = heldRow(held, deck, key)
      if (row === undefined || row.kind !== "pending") break
      if (row.once !== undefined && row.once !== once) break
      const next = { ...row, once }
      sealed.push(next)
      if (row.once === undefined) puts.push({ key, row: next })
    }
    if (puts.length === 0) return { puts, result: undefined }
    return { next: moved(held, deck, puts, []), puts, result: undefined }
  })
  return sealed
}

export async function heldView(deck: DeckId): Promise<DeckView | null> {
  const account = signedIn()
  const reading = await transaction("readonly")
  const store = reading.objectStore(storeName)
  const head = scoped(account, headKey(deck))
  const known = memory(account, deck)
  let held: Held | undefined
  let dropped: string[] = []
  const stored = store.get(head)
  const next = known === undefined ? undefined : store.get(scoped(account, nextKey(deck, known)))
  const reload = () => {
    const rows = store.getAll(rowRange(scoped(account, deck)))
    rows.onsuccess = () => {
      const all = rows.result as StoredRow[]
      held = load(deck, headOf(stored.result), all.filter(readable))
      dropped = all.filter((row) => !readable(row)).map((row) => storedKey(deck, row))
      remember(account, deck, held)
    }
  }
  if (known === undefined) reload()
  else if (next !== undefined)
    next.onsuccess = () => {
      if (headOf(stored.result) === known.head && next.result === undefined) held = known
      else reload()
    }
  await finished(reading, () => undefined)
  if (held === undefined) return null
  if (dropped.length > 0) await writeDeckRows(deck, [], dropped, "same")
  return deckView(held.register, [...held.confirmed], [...held.pending])
}
