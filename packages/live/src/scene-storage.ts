import { scene } from "@airdesign/document"
import type { Queued } from "./scene-queue.js"
import { readSlot, replaceSlots, writeSlot } from "./store.js"

export type Saved = { readonly fold?: scene.Scene; readonly queue: readonly Queued[] }

export type SceneStorage = {
  read(): Promise<Saved | undefined>
  write(changed: { readonly fold?: scene.Scene; readonly queue?: readonly Queued[] }): Promise<void>
}

export const sceneFoldKey = (deck: string): string => `${deck}\u0004fold`
export const sceneQueueKey = (deck: string): string => `${deck}\u0004queue`

function readQueue(raw: unknown): Queued[] {
  if (!Array.isArray(raw)) return []
  const queue: Queued[] = []
  for (const each of raw as unknown[]) {
    if (typeof each !== "object" || each === null) continue
    const { edit, after } = each as { edit?: scene.Edit; after?: unknown }
    if (edit === undefined || typeof edit.once !== "string" || !Array.isArray(edit.writes)) continue
    if (!Array.isArray(after) || after.length !== edit.writes.length) continue
    queue.push({ edit, after: after as (string | null)[] })
  }
  return queue
}

export function deviceStorage(deck: string): SceneStorage {
  return {
    async read() {
      const [stored, queued] = await Promise.all([readSlot(sceneFoldKey(deck)), readSlot(sceneQueueKey(deck))])
      const fold = stored === null ? undefined : scene.readFold(stored)
      if (fold === undefined && queued === null) return undefined
      return { ...(fold === undefined ? {} : { fold }), queue: readQueue(queued) }
    },
    async write({ fold, queue }) {
      const puts = [
        ...(fold === undefined ? [] : [{ key: sceneFoldKey(deck), value: scene.foldToJson(fold) }]),
        ...(queue === undefined ? [] : [{ key: sceneQueueKey(deck), value: queue }]),
      ]
      if (puts.length === 1 && puts[0] !== undefined) await writeSlot(puts[0].key, puts[0].value)
      else if (puts.length > 1) await replaceSlots(puts)
    },
  }
}

export function memoryStorage(): SceneStorage & { readonly saved: () => Saved | undefined } {
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
