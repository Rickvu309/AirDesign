import * as doom from "@airdesign/doom"
import { finished, scoped, storeName, transaction } from "./device.js"

export const doomHeadKey = (deck: string): string => `${deck}\u0004head`
export const doomNodeKey = (deck: string, node: string): string => `${deck}\u0004node\u0004${node}`
const nodePrefix = (deck: string): string => doomNodeKey(deck, "")
const oncePrefix = (deck: string): string => `${deck}\u0004once\u0004`
const retiredFoldKey = (deck: string): string => `${deck}\u0004fold`

type Row = { readonly key: string; readonly value: unknown }
type Head = { readonly rev?: unknown; readonly runs?: unknown }

function within(account: string, prefix: string): IDBKeyRange {
  return IDBKeyRange.bound(scoped(account, prefix), scoped(account, `${prefix}\uffff`))
}

function changedRows(deck: string, before: doom.Doom | undefined, after: doom.Doom) {
  const puts: Row[] = []
  const drops: string[] = []
  if (before?.rev !== after.rev || before.runs !== after.runs)
    puts.push({ key: doomHeadKey(deck), value: { rev: after.rev, runs: doom.runsToJson(after.runs) } })
  for (const [id, node] of after.nodes) {
    const revs = after.revs.get(id)
    if (before?.nodes.get(id) === node && before.revs.get(id) === revs) continue
    puts.push({
      key: doomNodeKey(deck, id),
      value: revs === undefined ? { node } : { node, revs: doom.revsToJson(revs) },
    })
  }
  for (const [once, at] of after.onces)
    if (before?.onces.get(once) !== at) puts.push({ key: `${oncePrefix(deck)}${once}`, value: at })
  if (before === undefined) return { puts, drops }
  for (const id of before.nodes.keys()) if (!after.nodes.has(id)) drops.push(doomNodeKey(deck, id))
  for (const once of before.onces.keys()) if (!after.onces.has(once)) drops.push(`${oncePrefix(deck)}${once}`)
  return { puts, drops }
}

function entries(keys: IDBRequest, values: IDBRequest, from: number): [string, unknown][] {
  return (keys.result as string[]).map((key, at) => [key.slice(from), (values.result as unknown[])[at]])
}

export async function readFoldRows(account: string, deck: string): Promise<doom.Doom | undefined> {
  const reading = await transaction("readonly")
  const store = reading.objectStore(storeName)
  const head = store.get(scoped(account, doomHeadKey(deck)))
  const nodeKeys = store.getAllKeys(within(account, nodePrefix(deck)))
  const nodeRows = store.getAll(within(account, nodePrefix(deck)))
  const onceKeys = store.getAllKeys(within(account, oncePrefix(deck)))
  const onceRows = store.getAll(within(account, oncePrefix(deck)))
  return finished(reading, () => {
    const found = head.result as Head | undefined
    if (found === undefined) return undefined
    const nodes: Record<string, unknown> = {}
    const revs: Record<string, unknown> = {}
    for (const [id, row] of entries(nodeKeys, nodeRows, scoped(account, nodePrefix(deck)).length)) {
      const kept = row as { readonly node?: unknown; readonly revs?: unknown } | undefined
      nodes[id] = kept?.node
      if (kept?.revs !== undefined) revs[id] = kept.revs
    }
    const onces = Object.fromEntries(entries(onceKeys, onceRows, scoped(account, oncePrefix(deck)).length))
    return doom.readFold({ rev: found.rev, runs: found.runs, nodes, revs, onces })
  })
}

export function writeFoldRows(
  store: IDBObjectStore,
  account: string,
  deck: string,
  written: doom.Doom | undefined,
  fold: doom.Doom,
): void {
  const head = store.get(scoped(account, doomHeadKey(deck)))
  head.onsuccess = () => {
    const stored = (head.result as Head | undefined)?.rev
    if (written !== undefined && stored === fold.rev) return
    const base = written !== undefined && stored === written.rev ? written : undefined
    if (base === undefined) {
      store.delete(within(account, nodePrefix(deck)))
      store.delete(within(account, oncePrefix(deck)))
      store.delete(scoped(account, retiredFoldKey(deck)))
    }
    const { puts, drops } = changedRows(deck, base, fold)
    for (const key of drops) store.delete(scoped(account, key))
    for (const { key, value } of puts) store.put(value, scoped(account, key))
  }
}
