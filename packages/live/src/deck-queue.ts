import { readSlot, writeSlot } from "./store.js"

export type DeckQueue = {
  readonly slot: string
  readonly send: (deck: string, value: string) => Promise<boolean>
}

const sending = new Map<string, Promise<{ readonly ok: boolean }>>()

const key = (queue: DeckQueue, deck: string) => `${deck}${queue.slot}`

async function send(queue: DeckQueue, deck: string): Promise<{ readonly ok: boolean }> {
  try {
    const value = await readSlot(key(queue, deck))
    if (typeof value !== "string") return { ok: true }
    if (!(await queue.send(deck, value))) return { ok: false }
    if ((await readSlot(key(queue, deck))) === value) await writeSlot(key(queue, deck), false)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export function flushQueued(queue: DeckQueue, deck: string): Promise<{ readonly ok: boolean }> {
  const run = (sending.get(key(queue, deck)) ?? Promise.resolve({ ok: true })).then(() => send(queue, deck))
  sending.set(key(queue, deck), run)
  return run
}

export async function queuedValue(queue: DeckQueue, deck: string): Promise<string | undefined> {
  const value = await readSlot(key(queue, deck))
  return typeof value === "string" ? value : undefined
}

export async function queueValue(queue: DeckQueue, deck: string, value: string): Promise<void> {
  await writeSlot(key(queue, deck), value)
}
