import { readDeckId } from "@airdesign/catalog"
import { accountKey, accountRange, deckRange, deleteDatabase, finished, storeName, transaction } from "./device.js"
import { dropShelvedChats } from "./chat-slot.js"
import { dropShelvedQueue } from "./deck-queue.js"
import { pageShelf, type Shelf } from "./shelf.js"

export async function dropDeck(deck: string, shelf: Shelf | undefined = pageShelf()): Promise<void> {
  const account = accountKey()
  const parsed = readDeckId(deck)
  if (account === undefined || !parsed.ok) return
  dropShelvedChats(account, parsed.deck, shelf)
  dropShelvedQueue(account, parsed.deck, shelf)
  const writing = await transaction("readwrite")
  writing.objectStore(storeName).delete(deckRange(account, parsed.deck))
  await finished(writing, () => undefined)
}

export async function dropAccount(account: string | undefined, shelf: Shelf | undefined = pageShelf()): Promise<void> {
  if (account === undefined) return
  dropShelvedChats(account, undefined, shelf)
  dropShelvedQueue(account, undefined, shelf)
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  store.delete(accountRange(account))
  const left = store.getAllKeys(null, 1)
  const empty = await finished(writing, () => left.result.length === 0)
  if (empty) await deleteDatabase()
}
