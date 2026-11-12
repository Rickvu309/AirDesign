import { readDeckId } from "@airdesign/catalog"
import { openDatabase, storeName } from "./store.js"

export type ChatSlot = { readonly id: string }

function chatPrefix(deck: string): string {
  const parsed = readDeckId(deck)
  if (!parsed.ok) throw new Error("deck")
  return `${parsed.deck}\u0004`
}

function chatRange(deck: string): IDBKeyRange {
  const prefix = chatPrefix(deck)
  return IDBKeyRange.bound(prefix, `${prefix}￿`)
}

function slotId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("id" in value)) return undefined
  return typeof value.id === "string" && value.id !== "" ? value.id : undefined
}

function inStore<Result>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, done: (result: Result) => void) => void,
): Promise<Result> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, mode)
        let result: Result | undefined
        work(transaction.objectStore(storeName), (value) => {
          result = value
        })
        transaction.oncomplete = () => {
          database.close()
          resolve(result as Result)
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
        transaction.onabort = () => {
          database.close()
          reject(transaction.error)
        }
      }),
  )
}

export async function readChats(deck: string): Promise<unknown[]> {
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
