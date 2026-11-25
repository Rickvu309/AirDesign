import * as doom from "@airdesign/doom"
import { componentFields, type Queued, type Regeneration, type Suppression } from "./doom-queue.js"
import { dropDeck } from "./device-sweep.js"
import { accountKey, finished, scoped, storeName, transaction } from "./device.js"
import { readFoldRows, writeFoldRows, type Written } from "./fold-rows.js"
import { readRange, signedIn } from "./store.js"

export type Saved = { readonly fold?: doom.Doom; readonly queue: readonly Queued[] }

export type DoomStorage = {
  read(): Promise<Saved | undefined>
  write(changed: { readonly fold?: doom.Doom; readonly queue?: readonly Queued[] }): Promise<void>
  drop(): Promise<void>
}

export function keepDoom(storage: DoomStorage, keep: (kept: boolean) => void) {
  let saving: Promise<void> = Promise.resolve()
  let gone = false
  return {
    save(changed: Parameters<DoomStorage["write"]>[0]) {
      saving = saving
        .then(() => (gone ? undefined : storage.write(changed)))
        .then(
          () => keep(true),
          () => keep(false),
        )
      return saving
    },
    async leave() {
      gone = true
      saving = saving.then(() => storage.drop()).catch(() => undefined)
      await saving
      return "gone" as const
    },
  }
}

export const doomQueuePrefix = (deck: string): string => `${deck}\u0004queue\u0004`

const stampLength = 11

function readRegeneration(raw: unknown): Regeneration | undefined {
  if (typeof raw !== "object" || raw === null || !("frame" in raw) || !("fields" in raw)) return undefined
  const frame = doom.readNodeId(raw.frame)
  const fields = raw.fields
  if (
    frame === undefined ||
    !Array.isArray(fields) ||
    fields.length > componentFields.length ||
    !fields.every((field) => componentFields.some((name) => name === field))
  )
    return undefined
  return { frame, fields: componentFields.filter((field) => fields.includes(field)) }
}

function readSuppressions(raw: unknown): readonly Suppression[] | undefined {
  if (!Array.isArray(raw) || raw.length > 499) return undefined
  const found: Suppression[] = []
  for (const each of raw) {
    if (typeof each !== "object" || each === null) return undefined
    const frame = doom.readNodeId(each.frame)
    const node = doom.readNodeId(each.node)
    const key = doom.readPartKey(each.key)
    if (frame === undefined || node === undefined || key === undefined) return undefined
    found.push({ frame, node, key })
  }
  return found
}

function readQueued(raw: unknown): Queued | undefined {
  if (typeof raw !== "object" || raw === null) return undefined
  const { edit, after, follows, afterRead, regeneration, suppressions, turnFrom, turnSource } = raw as {
    edit?: doom.Edit
    after?: unknown
    follows?: unknown
    afterRead?: unknown
    regeneration?: unknown
    suppressions?: unknown
    turnFrom?: unknown
    turnSource?: doom.RunEdit
  }
  if (edit === undefined || typeof edit.once !== "string" || !Array.isArray(edit.writes)) return undefined
  if (
    !Array.isArray(after) ||
    after.length !== edit.writes.length ||
    !after.every((once): once is string | null => once === null || typeof once === "string")
  )
    return undefined
  const queued = { edit, after, ...(typeof follows === "string" ? { follows } : {}) }
  if (edit.readBase === undefined) return queued
  if (
    !Number.isSafeInteger(edit.readBase) ||
    !Array.isArray(afterRead) ||
    edit.readBase < afterRead.length ||
    !afterRead.every((once): once is string => typeof once === "string")
  )
    return undefined
  const intent = readRegeneration(regeneration)
  const deletes = readSuppressions(suppressions)
  const sources =
    Array.isArray(turnFrom) && turnFrom.every((once): once is string => typeof once === "string") ? turnFrom : undefined
  return {
    ...queued,
    afterRead,
    ...(intent === undefined ? {} : { regeneration: intent }),
    ...(deletes === undefined ? {} : { suppressions: deletes }),
    ...(sources === undefined ? {} : { turnFrom: sources }),
    ...(sources !== undefined && Array.isArray(turnSource?.writes) && Array.isArray(turnSource.replaced)
      ? { turnSource }
      : {}),
  }
}

export function deviceStorage(deck: string): DoomStorage {
  const prefix = doomQueuePrefix(deck)
  const rows = new Map<string, { readonly key: string; readonly queued: Queued }>()
  let latest = 0
  let written: Written | undefined

  const keyFor = (once: string): string => {
    latest = Math.max(Date.now(), latest + 1)
    return `${prefix}${latest.toString(36).padStart(stampLength, "0")}\u0004${once}`
  }

  return {
    async read() {
      const account = accountKey()
      if (account === undefined) return undefined
      const [copy, kept] = await Promise.all([readFoldRows(account, deck), readRange(prefix)])
      written = copy
      const fold = copy?.fold
      const queue: Queued[] = []
      for (const { key, value } of kept) {
        latest = Math.max(latest, Number.parseInt(key.slice(prefix.length, prefix.length + stampLength), 36) || 0)
        const queued = readQueued(value)
        if (queued === undefined || rows.has(queued.edit.once)) continue
        rows.set(queued.edit.once, { key, queued })
        queue.push(queued)
      }
      if (fold === undefined && queue.length === 0) return undefined
      return { ...(fold === undefined ? {} : { fold }), queue }
    },
    async write({ fold, queue }) {
      const puts: { readonly key: string; readonly value: unknown }[] = []
      const drops: string[] = []
      const next = new Map(rows)
      if (queue !== undefined) {
        const kept = new Set(queue.map((each) => each.edit.once))
        for (const [once, { key }] of rows)
          if (!kept.has(once)) {
            drops.push(key)
            next.delete(once)
          }
        for (const queued of queue) {
          const row = rows.get(queued.edit.once)
          if (row?.queued === queued) continue
          const key = row?.key ?? keyFor(queued.edit.once)
          next.set(queued.edit.once, { key, queued })
          puts.push({ key, value: queued })
        }
      }
      if (fold === undefined && puts.length === 0 && drops.length === 0) return
      const account = signedIn()
      const writing = await transaction("readwrite")
      const store = writing.objectStore(storeName)
      for (const key of drops) store.delete(scoped(account, key))
      for (const { key, value } of puts) store.put(value, scoped(account, key))
      const kept = fold === undefined ? undefined : writeFoldRows(store, account, deck, written, fold)
      await finished(writing, () => undefined)
      if (kept !== undefined) written = kept()
      rows.clear()
      for (const [once, row] of next) rows.set(once, row)
    },
    async drop() {
      rows.clear()
      written = undefined
      await dropDeck(deck)
    },
  }
}

export function memoryStorage(): DoomStorage & { readonly saved: () => Saved | undefined } {
  let saved: Saved | undefined
  return {
    saved: () => saved,
    async read() {
      return saved
    },
    async write({ fold, queue }) {
      const next = fold ?? saved?.fold
      saved = { ...(next === undefined ? {} : { fold: next }), queue: queue ?? saved?.queue ?? [] }
    },
    async drop() {
      saved = undefined
    },
  }
}
