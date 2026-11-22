import { readDeckId } from "@airdesign/catalog"
import {
  accountKey,
  accountRange,
  deckRange,
  deleteDatabase,
  finished,
  firstOnPage,
  heldDecks,
  legacyRange,
  scoped,
  storeName,
  transaction,
} from "./device.js"
import { dropShelvedChats } from "./chat-slot.js"
import { dropShelvedQueue } from "./deck-queue.js"
import { adoptJournal, dropJournal, hasLegacyJournal, pageShelf, type Shelf } from "./unsaved.js"
import { sceneQueueKey } from "./scene-storage.js"
import { asideKey } from "./store.js"

export const idleDays = 30

const dayMilliseconds = 86_400_000
const seenKey = "\u0007seen"
const trustTail = "\u0002trust"

type Seen = Record<string, number>

function seenOf(raw: unknown): Seen {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  )
}

async function changeSeen(account: string, change: (seen: Seen) => Seen): Promise<void> {
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  const request = store.get(scoped(account, seenKey))
  request.onsuccess = () => {
    store.put(change(seenOf(request.result)), scoped(account, seenKey))
  }
  await finished(writing, () => undefined)
}

export async function markSeen(deck: string, time: number): Promise<void> {
  const account = accountKey()
  if (account === undefined || !firstOnPage(scoped(account, `${deck}${seenKey}`))) return
  await changeSeen(account, (seen) => ({ ...seen, [deck]: time }))
}

function unsentIn(store: IDBObjectStore, account: string, deck: string): () => boolean {
  const pending = store.getAllKeys(
    IDBKeyRange.bound(scoped(account, `${deck}\u0000p\u0000`), scoped(account, `${deck}\u0000p\u0000￿`)),
  )
  const queue = store.get(scoped(account, `${deck}\u0002layouts\u0002queue`))
  const original = store.get(scoped(account, `${deck}\u0003original`))
  const name = store.get(scoped(account, `${deck}\u0003name`))
  const star = store.get(scoped(account, `${deck}\u0003star`))
  const media = store.get(scoped(account, `${deck}\u0003media`))
  const aside = store.get(scoped(account, asideKey(deck)))
  const scenes = store.get(scoped(account, sceneQueueKey(deck)))
  return () => {
    const index = queue.result as { count?: unknown; sent?: unknown } | undefined
    const indexing = typeof index === "object" && index !== null && index.sent !== index.count
    const pictures = Array.isArray(media.result) && media.result.length > 0
    const untold = Array.isArray(aside.result) && aside.result.length > 0
    const scened = Array.isArray(scenes.result) && scenes.result.length > 0
    return (
      pending.result.length > 0 ||
      indexing ||
      original.result === true ||
      typeof name.result === "string" ||
      typeof star.result === "string" ||
      pictures ||
      untold ||
      scened
    )
  }
}

export async function sweepIdle(now: number, idle: number, journaled: (deck: string) => boolean): Promise<string[]> {
  const account = accountKey()
  if (account === undefined) return []
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  const removed: string[] = []
  const request = store.get(scoped(account, seenKey))
  request.onsuccess = () => {
    const seen = seenOf(request.result)
    const idleDecks = Object.keys(seen).filter((deck) => (seen[deck] ?? now) < now - idle * dayMilliseconds)
    const checks = idleDecks.map((deck) => ({ deck, unsent: unsentIn(store, account, deck) }))
    const last = store.get(scoped(account, seenKey))
    last.onsuccess = () => {
      const kept: Seen = { ...seenOf(last.result) }
      for (const { deck, unsent } of checks) {
        if (unsent() || journaled(deck)) continue
        store.delete(deckRange(account, deck))
        delete kept[deck]
        removed.push(deck)
        heldDecks().delete(scoped(account, deck))
      }
      if (removed.length > 0) store.put(kept, scoped(account, seenKey))
    }
  }
  await finished(writing, () => undefined)
  return removed
}

export async function dropDeck(deck: string, shelf: Shelf | undefined = pageShelf()): Promise<void> {
  const account = accountKey()
  const parsed = readDeckId(deck)
  if (account === undefined || !parsed.ok) return
  heldDecks().delete(scoped(account, parsed.deck))
  dropJournal(shelf, account, parsed.deck)
  dropShelvedChats(account, parsed.deck, shelf)
  dropShelvedQueue(account, parsed.deck, shelf)
  await changeSeen(account, (seen) => Object.fromEntries(Object.entries(seen).filter(([each]) => each !== deck)))
  const writing = await transaction("readwrite")
  writing.objectStore(storeName).delete(deckRange(account, parsed.deck))
  await finished(writing, () => undefined)
}

export async function dropAccount(account: string | undefined, shelf: Shelf | undefined = pageShelf()): Promise<void> {
  if (account === undefined) return
  dropJournal(shelf, account)
  dropShelvedChats(account, undefined, shelf)
  dropShelvedQueue(account, undefined, shelf)
  heldDecks().clear()
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  store.delete(accountRange(account))
  const left = store.getAllKeys(null, 1)
  const empty = await finished(writing, () => left.result.length === 0)
  if (empty) await deleteDatabase()
}

export async function adoptDeck(
  deck: string,
  confirm: () => Promise<boolean>,
  shelf: Shelf | undefined = pageShelf(),
): Promise<boolean> {
  const account = accountKey()
  const parsed = readDeckId(deck)
  if (account === undefined || !parsed.ok) return false
  const reading = await transaction("readonly")
  const legacy = reading.objectStore(storeName).getAllKeys(legacyRange(parsed.deck), 1)
  const own = reading.objectStore(storeName).getAllKeys(deckRange(account, parsed.deck), 1)
  const found = await finished(reading, () => ({ legacy: legacy.result.length, own: own.result.length }))
  if (found.own > 0 || (found.legacy === 0 && !hasLegacyJournal(shelf, parsed.deck))) return false
  if (!(await confirm())) return false
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  const keys = store.getAllKeys(legacyRange(parsed.deck))
  const values = store.getAll(legacyRange(parsed.deck))
  const mine = store.getAllKeys(deckRange(account, parsed.deck), 1)
  mine.onsuccess = () => {
    if (mine.result.length > 0) return
    keys.result.forEach((key, at) => {
      if (typeof key !== "string" || key.endsWith(trustTail)) return
      store.put(values.result[at], scoped(account, key))
    })
    store.delete(legacyRange(parsed.deck))
  }
  await finished(writing, () => undefined)
  adoptJournal(shelf, account, parsed.deck)
  heldDecks().delete(scoped(account, parsed.deck))
  return true
}
