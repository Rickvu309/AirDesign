import { readDeckId } from "@airdesign/catalog"
import { accountKey, finished, scoped, storeName, transaction } from "./device.js"

export type ChatSlot = { readonly id: string }

function chatPrefix(deck: string): string {
  const parsed = readDeckId(deck)
  if (!parsed.ok) throw new Error("deck")
  const account = accountKey()
  if (account === undefined) throw new Error("session")
  return scoped(account, `${parsed.deck}\u0004`)
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
