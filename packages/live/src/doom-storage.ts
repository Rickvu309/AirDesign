import * as doom from "@airdesign/doom"
import type { Queued } from "./doom-queue.js"
import { readSlot, replaceSlots, writeSlot } from "./store.js"

export type Saved = { readonly fold?: doom.Doom; readonly queue: readonly Queued[] }

export type DoomStorage = {
  read(): Promise<Saved | undefined>
  write(changed: { readonly fold?: doom.Doom; readonly queue?: readonly Queued[] }): Promise<void>
}

export const doomFoldKey = (deck: string): string => `${deck}\u0004fold`
export const doomQueueKey = (deck: string): string => `${deck}\u0004queue`

function readQueue(raw: unknown): Queued[] {
  if (!Array.isArray(raw)) return []
  const queue: Queued[] = []
  for (const each of raw as unknown[]) {
    if (typeof each !== "object" || each === null) continue
    const { edit, after } = each as { edit?: doom.Edit; after?: unknown }
    if (edit === undefined || typeof edit.once !== "string" || !Array.isArray(edit.writes)) continue
    if (!Array.isArray(after) || after.length !== edit.writes.length) continue
    queue.push({ edit, after: after as (string | null)[] })
  }
  return queue
}

export function deviceStorage(deck: string): DoomStorage {
  return {
    async read() {
      const [stored, queued] = await Promise.all([readSlot(doomFoldKey(deck)), readSlot(doomQueueKey(deck))])
      const fold = stored === null ? undefined : doom.readFold(stored)
      if (fold === undefined && queued === null) return undefined
      return { ...(fold === undefined ? {} : { fold }), queue: readQueue(queued) }
    },
    async write({ fold, queue }) {
      const puts = [
        ...(fold === undefined ? [] : [{ key: doomFoldKey(deck), value: doom.foldToJson(fold) }]),
        ...(queue === undefined ? [] : [{ key: doomQueueKey(deck), value: queue }]),
      ]
      if (puts.length === 1 && puts[0] !== undefined) await writeSlot(puts[0].key, puts[0].value)
      else if (puts.length > 1) await replaceSlots(puts)
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
  }
}
