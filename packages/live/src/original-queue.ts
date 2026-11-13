import { flushRename, queuedName, queueRename } from "./deck-rename.js"
import { sendOriginal } from "./original.js"
import { getParts } from "./part.js"
import { readSlot, writeSlot } from "./store.js"

const key = (deck: string) => `${deck}\u0003original`

export async function queueOriginal(deck: string): Promise<void> {
  const stored = await getParts(deck)
  if (stored.ok && stored.name !== undefined) await queueRename(deck, stored.name)
  await writeSlot(key(deck), true)
}

export async function flushOriginal(deck: string): Promise<{ readonly ok: boolean }> {
  const renamed = await flushRename(deck)
  try {
    if ((await readSlot(key(deck))) !== true) return { ok: true }
    if (!renamed.ok) return { ok: false }
    const stored = await getParts(deck)
    if (!stored.ok) return { ok: false }
    const sent = await sendOriginal(deck, stored.file)
    if (sent.ok) await writeSlot(key(deck), false)
    return sent
  } catch {
    return { ok: false }
  }
}

export async function sendQueuedNames(decks: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const names = await Promise.all(decks.map(async (deck) => [deck, await queuedName(deck)] as const))
  const queued = new Map(names.filter((entry): entry is readonly [string, string] => entry[1] !== undefined))
  for (const deck of queued.keys()) void flushOriginal(deck)
  return queued
}
