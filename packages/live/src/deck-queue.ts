import { accountKey } from "./device.js"
import { readSlot, swapSlot, writeSlot } from "./store.js"
import { pageShelf, type Shelf } from "./shelf.js"

export type DeckQueue = {
  readonly slot: string
  readonly send: (deck: string, value: string) => Promise<boolean>
}

type Mark = { readonly shelf: Shelf; readonly at: string; readonly value: string }

const sending = new Map<string, Promise<{ readonly ok: boolean }>>()

const shelfPrefix = "airdesign:queued:"

const key = (queue: DeckQueue, deck: string) => `${deck}${queue.slot}`

const shelfKey = (account: string, queue: DeckQueue, deck: string) => `${shelfPrefix}${account}:${key(queue, deck)}`

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

function shelvedAt(shelf: Shelf, at: string): string | undefined {
  try {
    return shelf.getItem(at) ?? undefined
  } catch {
    return undefined
  }
}

function shelve(shelf: Shelf | undefined, at: string | undefined, value: string): Mark | undefined {
  if (shelf === undefined || at === undefined) return undefined
  try {
    shelf.setItem(at, value)
    return { shelf, at, value }
  } catch {
    return undefined
  }
}

function holds(mark: Mark): boolean {
  return shelvedAt(mark.shelf, mark.at) === mark.value
}

function release(mark: Mark | undefined): void {
  if (mark === undefined) return
  try {
    if (holds(mark)) mark.shelf.removeItem(mark.at)
  } catch {
    return
  }
}

async function keepValue(queue: DeckQueue, deck: string, mark: Mark | undefined, value: string) {
  await swapSlot(key(queue, deck), value, () => mark === undefined || holds(mark))
  release(mark)
  return { ok: true }
}

export function queueValue(queue: DeckQueue, deck: string, value: string): Promise<{ readonly ok: boolean }> {
  const account = accountKey()
  const mark = shelve(pageShelf(), account === undefined ? undefined : shelfKey(account, queue, deck), value)
  return keepValue(queue, deck, mark, value)
}

function ownKeys(shelf: Shelf, prefix: string): string[] {
  try {
    return Array.from({ length: shelf.length }, (_, at) => shelf.key(at)).filter(
      (each): each is string => each?.startsWith(prefix) === true,
    )
  } catch {
    return []
  }
}

export async function keepShelved(queues: readonly DeckQueue[], shelf: Shelf | undefined = pageShelf()): Promise<void> {
  const account = accountKey()
  if (shelf === undefined || account === undefined) return
  const prefix = `${shelfPrefix}${account}:`
  for (const at of ownKeys(shelf, prefix)) {
    const queue = queues.find((each) => at.endsWith(each.slot))
    const value = shelvedAt(shelf, at)
    if (queue === undefined || value === undefined) continue
    const deck = at.slice(prefix.length, at.length - queue.slot.length)
    await keepValue(queue, deck, { shelf, at, value }, value).catch(() => undefined)
  }
}

export function dropShelvedQueue(
  account: string | undefined,
  deck?: string,
  shelf: Shelf | undefined = pageShelf(),
): void {
  if (shelf === undefined || account === undefined) return
  const prefix = `${shelfPrefix}${account}:`
  for (const at of ownKeys(shelf, prefix)) {
    if (deck !== undefined && !at.slice(prefix.length).startsWith(`${deck}\u0003`)) continue
    try {
      shelf.removeItem(at)
    } catch {
      return
    }
  }
}
