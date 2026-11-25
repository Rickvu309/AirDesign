import * as doom from "@airdesign/doom"
import { finished, scoped, storeName, transaction } from "./device.js"

const rowKey = (deck: string, row: string): string => `${deck}\u0004${row}`
const nodeRow = (node: string): string => `node\u0004${node}`
const onceRow = (once: string): string => `once\u0004${once}`
export const doomHeadKey = (deck: string): string => rowKey(deck, "head")
export const doomNodeKey = (deck: string, node: string): string => rowKey(deck, nodeRow(node))
export const retiredFoldKey = (deck: string): string => rowKey(deck, "fold")

type Row = { readonly row: string; readonly value: unknown; readonly sum: number }
type Head = { readonly rev?: unknown; readonly runs?: unknown; readonly rows?: unknown; readonly sum?: unknown }
type Change = { readonly puts: readonly Row[]; readonly drops: readonly string[]; readonly sum: number; rows: number }

export type Written = { readonly fold: doom.Doom; readonly sums: Map<string, number>; readonly sum: number }

function rowsOf(account: string, deck: string, kind: "node" | "once"): IDBKeyRange {
  const from = scoped(account, rowKey(deck, kind))
  return IDBKeyRange.bound(`${from}\u0004`, `${from}\u0005`, false, true)
}

function sumOf(row: string, value: unknown): number {
  const text = `${row}\u0004${JSON.stringify(value)}`
  let sum = 0x811c9dc5
  for (let at = 0; at < text.length; at += 1) sum = Math.imul(sum ^ text.charCodeAt(at), 0x01000193)
  return sum >>> 0
}

function changedRows(before: Written | undefined, after: doom.Doom): Change {
  const puts: Row[] = []
  const drops: string[] = []
  let sum = before?.sum ?? 0
  let rows = before?.sums.size ?? 0
  const put = (row: string, value: unknown) => {
    const next = sumOf(row, value)
    const kept = before?.sums.get(row)
    if (kept === undefined) rows += 1
    sum = (sum ^ (kept ?? 0) ^ next) >>> 0
    puts.push({ row, value, sum: next })
  }
  const drop = (row: string) => {
    const kept = before?.sums.get(row)
    if (kept === undefined) return
    rows -= 1
    sum = (sum ^ kept) >>> 0
    drops.push(row)
  }
  for (const [id, node] of after.nodes) {
    const revs = after.revs.get(id)
    if (before?.fold.nodes.get(id) === node && before.fold.revs.get(id) === revs) continue
    put(nodeRow(id), revs === undefined ? { node } : { node, revs: doom.revsToJson(revs) })
  }
  for (const [once, at] of after.onces) if (before?.fold.onces.get(once) !== at) put(onceRow(once), at)
  if (before === undefined) return { puts, drops, sum, rows }
  for (const id of before.fold.nodes.keys()) if (!after.nodes.has(id)) drop(nodeRow(id))
  for (const once of before.fold.onces.keys()) if (!after.onces.has(once)) drop(onceRow(once))
  return { puts, drops, sum, rows }
}

function describes(head: Head | undefined, rev: number, sum: number, rows: number): boolean {
  return head?.rev === rev && head.sum === sum && head.rows === rows
}

function rewrite(store: IDBObjectStore, account: string, deck: string, fold: doom.Doom): Written {
  const { puts, sum, rows } = changedRows(undefined, fold)
  store.delete(rowsOf(account, deck, "node"))
  store.delete(rowsOf(account, deck, "once"))
  store.delete(scoped(account, retiredFoldKey(deck)))
  for (const { row, value } of puts) store.put(value, scoped(account, rowKey(deck, row)))
  store.put({ rev: fold.rev, runs: doom.runsToJson(fold.runs), rows, sum }, scoped(account, doomHeadKey(deck)))
  return { fold, sums: new Map(puts.map((put) => [put.row, put.sum])), sum }
}

async function readRows(account: string, deck: string) {
  const reading = await transaction("readonly")
  const store = reading.objectStore(storeName)
  const head = store.get(scoped(account, doomHeadKey(deck)))
  const fold = scoped(account, retiredFoldKey(deck))
  const retired = store.getAllKeys(IDBKeyRange.bound(fold, fold))
  const keys = [store.getAllKeys(rowsOf(account, deck, "node")), store.getAllKeys(rowsOf(account, deck, "once"))]
  const values = [store.getAll(rowsOf(account, deck, "node")), store.getAll(rowsOf(account, deck, "once"))]
  return finished(reading, () => {
    const from = scoped(account, rowKey(deck, "")).length
    const found = keys.flatMap((kind, at) =>
      (kind.result as string[]).map((key, row) => [key.slice(from), (values[at]!.result as unknown[])[row]] as const),
    )
    return { head: head.result as Head | undefined, retired: retired.result.length > 0, found }
  })
}

function foldOf(head: Head | undefined, found: readonly (readonly [string, unknown])[]): Written | undefined {
  if (head === undefined) return undefined
  const sums = new Map<string, number>()
  const nodes: Record<string, unknown> = {}
  const revs: Record<string, unknown> = {}
  const onces: Record<string, unknown> = {}
  let sum = 0
  for (const [row, value] of found) {
    const each = sumOf(row, value)
    sums.set(row, each)
    sum = (sum ^ each) >>> 0
    const name = row.slice(5)
    if (row.startsWith("once")) onces[name] = value
    else {
      const kept = value as { readonly node?: unknown; readonly revs?: unknown } | undefined
      nodes[name] = kept?.node
      if (kept?.revs !== undefined) revs[name] = kept.revs
    }
  }
  if (head.sum !== sum || head.rows !== sums.size) return undefined
  const fold = doom.readFold({ rev: head.rev, runs: head.runs, nodes, revs, onces })
  return fold === undefined ? undefined : { fold, sums, sum }
}

async function adoptRetired(account: string, deck: string): Promise<Written | undefined> {
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  const head = store.get(scoped(account, doomHeadKey(deck)))
  const retired = store.get(scoped(account, retiredFoldKey(deck)))
  let adopted: Written | undefined
  retired.onsuccess = () => {
    const fold = doom.readFold(retired.result)
    const rows = (head.result as Head | undefined)?.rev
    if (fold === undefined || (typeof rows === "number" && rows > fold.rev))
      store.delete(scoped(account, retiredFoldKey(deck)))
    else adopted = rewrite(store, account, deck, fold)
  }
  return finished(writing, () => adopted)
}

export async function readFoldRows(account: string, deck: string): Promise<Written | undefined> {
  const first = await readRows(account, deck)
  if (!first.retired) return foldOf(first.head, first.found)
  const adopted = await adoptRetired(account, deck)
  if (adopted !== undefined) return adopted
  const { head, found } = await readRows(account, deck)
  return foldOf(head, found)
}

export function writeFoldRows(
  store: IDBObjectStore,
  account: string,
  deck: string,
  written: Written | undefined,
  fold: doom.Doom,
): () => Written {
  const head = store.get(scoped(account, doomHeadKey(deck)))
  let saved: (() => Written) | undefined
  head.onsuccess = () => {
    const stored = head.result as Head | undefined
    const whole = () => {
      const kept = rewrite(store, account, deck, fold)
      saved = () => kept
    }
    if (written === undefined) return whole()
    const { puts, drops, sum, rows } = changedRows(written, fold)
    const there = written.fold.rev !== fold.rev && describes(stored, fold.rev, sum, rows)
    if (!there && !describes(stored, written.fold.rev, written.sum, written.sums.size)) return whole()
    saved = () => {
      for (const row of drops) written.sums.delete(row)
      for (const put of puts) written.sums.set(put.row, put.sum)
      return { fold, sums: written.sums, sum }
    }
    if (there) return
    for (const row of drops) store.delete(scoped(account, rowKey(deck, row)))
    for (const { row, value } of puts) store.put(value, scoped(account, rowKey(deck, row)))
    store.put({ rev: fold.rev, runs: doom.runsToJson(fold.runs), rows, sum }, scoped(account, doomHeadKey(deck)))
  }
  return () => {
    if (saved === undefined) throw new Error("unwritten")
    return saved()
  }
}
