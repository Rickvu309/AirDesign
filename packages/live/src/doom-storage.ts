import * as doom from "@airdesign/doom"
import type { Queued } from "./doom-queue.js"
import { dropDeck } from "./device-sweep.js"
import { changeSlots, readRange, readSlot } from "./store.js"

export type Saved = { readonly fold?: doom.Doom; readonly queue: readonly Queued[] }

export type DoomStorage = {
  read(): Promise<Saved | undefined>
  write(changed: { readonly fold?: doom.Doom; readonly queue?: readonly Queued[] }): Promise<void>
  drop(): Promise<void>
}

export const doomFoldKey = (deck: string): string => `${deck}\u0004fold`
export const doomQueuePrefix = (deck: string): string => `${deck}\u0004queue\u0004`

const stampLength = 11

function readQueued(raw: unknown): Queued | undefined {
  if (typeof raw !== "object" || raw === null) return undefined
  const { edit, after, follows } = raw as { edit?: doom.Edit; after?: unknown; follows?: unknown }
  if (edit === undefined || typeof edit.once !== "string" || !Array.isArray(edit.writes)) return undefined
  if (!Array.isArray(after) || after.length !== edit.writes.length) return undefined
  return { edit, after: after as (string | null)[], ...(typeof follows === "string" ? { follows } : {}) }
}

export function deviceStorage(deck: string): DoomStorage {
  const prefix = doomQueuePrefix(deck)
  const rows = new Map<string, { readonly key: string; readonly queued: Queued }>()
  let latest = 0

  const keyFor = (once: string): string => {
    latest = Math.max(Date.now(), latest + 1)
    return `${prefix}${latest.toString(36).padStart(stampLength, "0")}\u0004${once}`
  }

  return {
    async read() {
      const [stored, kept] = await Promise.all([readSlot(doomFoldKey(deck)), readRange(prefix)])
      const fold = stored === null ? undefined : doom.readFold(stored)
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
      const puts = fold === undefined ? [] : [{ key: doomFoldKey(deck), value: doom.foldToJson(fold) }]
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
      if (puts.length === 0 && drops.length === 0) return
      await changeSlots(puts, drops)
      rows.clear()
      for (const [once, row] of next) rows.set(once, row)
    },
    async drop() {
      rows.clear()
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
