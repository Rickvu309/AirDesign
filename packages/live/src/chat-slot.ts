import { readDeckId } from "@airdesign/catalog"
import { accountKey, finished, scoped, storeName, transaction } from "./device.js"
import { pageShelf, type Shelf } from "./unsaved.js"

export type ChatSlot = { readonly id: string }

function chatPrefix(deck: string): string {
  const parsed = readDeckId(deck)
  if (!parsed.ok) throw new Error("deck")
  const account = accountKey()
  if (account === undefined) throw new Error("session")
  return scoped(account, `${parsed.deck}\u0004`)
}

const shelfPrefix = "airdesign:chats:"

function shelfKey(account: string, deck: string): string {
  return `${shelfPrefix}${account}:${deck}`
}

function chatRange(deck: string): IDBKeyRange {
  const prefix = chatPrefix(deck)
  return IDBKeyRange.bound(prefix, `${prefix}￿`)
}

function slotId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("id" in value)) return undefined
  return typeof value.id === "string" && value.id !== "" ? value.id : undefined
}

async function inStore<Result>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, done: (result: Result) => void) => void,
): Promise<Result> {
  const running = await transaction(mode)
  let result: Result | undefined
  work(running.objectStore(storeName), (value) => {
    result = value
  })
  return finished(running, () => result as Result)
}

export async function readChats(deck: string): Promise<unknown[]> {
  if (accountKey() === undefined) return []
  const range = chatRange(deck)
  return inStore<unknown[]>("readonly", (store, done) => {
    const request = store.getAll(range)
    done([])
    request.onsuccess = () => done(request.result as unknown[])
  })
}

export async function writeChat<Chat extends ChatSlot>(deck: string, chat: Chat): Promise<void> {
  const prefix = chatPrefix(deck)
  const id = slotId(chat)
  if (id === undefined) throw new Error("chat")
  await inStore<undefined>("readwrite", (store) => {
    store.put(chat, `${prefix}${id}`)
  })
}

export async function dropChats(deck: string, ids?: readonly string[]): Promise<void> {
  const prefix = chatPrefix(deck)
  const range = chatRange(deck)
  if (ids === undefined) dropShelvedChats(accountKey(), deck)
  await inStore<undefined>("readwrite", (store) => {
    if (ids !== undefined) {
      for (const id of ids) store.delete(`${prefix}${id}`)
      return
    }
    const request = store.getAll(range)
    request.onsuccess = () => {
      for (const value of request.result as unknown[]) {
        const id = slotId(value)
        if (id !== undefined) store.delete(`${prefix}${id}`)
      }
    }
  })
}

function ownShelfKey(deck: string): string | undefined {
  const account = accountKey()
  const parsed = readDeckId(deck)
  return account === undefined || !parsed.ok ? undefined : shelfKey(account, parsed.deck)
}

function shelvedChats(key: string, shelf: Shelf | undefined): unknown[] {
  if (shelf === undefined) return []
  try {
    const raw = shelf.getItem(key)
    const parsed: unknown = raw === null ? [] : JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((chat) => slotId(chat) !== undefined) : []
  } catch {
    return []
  }
}

export function shelveChats<Chat extends ChatSlot>(
  deck: string,
  chats: readonly Chat[],
  shelf: Shelf | undefined = pageShelf(),
): void {
  const key = ownShelfKey(deck)
  if (shelf === undefined || key === undefined || chats.length === 0) return
  const ids = new Set(chats.map((chat) => chat.id))
  const kept = shelvedChats(key, shelf).filter((chat) => !ids.has(slotId(chat) ?? ""))
  try {
    shelf.setItem(key, JSON.stringify([...kept, ...chats]))
  } catch {
    return
  }
}

export function takeShelvedChats(deck: string, shelf: Shelf | undefined = pageShelf()): unknown[] {
  const key = ownShelfKey(deck)
  if (key === undefined) return []
  const shelved = shelvedChats(key, shelf)
  dropShelvedChats(accountKey(), deck, shelf)
  return shelved
}

export function dropShelvedChats(
  account: string | undefined,
  deck?: string,
  shelf: Shelf | undefined = pageShelf(),
): void {
  if (shelf === undefined || account === undefined) return
  try {
    const parsed = deck === undefined ? undefined : readDeckId(deck)
    if (parsed !== undefined && !parsed.ok) return
    const own = shelfKey(account, "")
    const keys =
      parsed === undefined
        ? Array.from({ length: shelf.length }, (_, at) => shelf.key(at)).filter(
            (key): key is string => key?.startsWith(own) === true,
          )
        : [shelfKey(account, parsed.deck)]
    for (const key of keys) shelf.removeItem(key)
  } catch {
    return
  }
}
