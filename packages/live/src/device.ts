import { readAccountCookie } from "@airdesign/catalog"
import { format } from "@airdesign/document"

export const databaseName = "airdesign"
export const storeName = "rows"

type Page = {
  readonly factory: IDBFactory
  account?: string | undefined
  database?: Promise<IDBDatabase> | undefined
  readonly decks: Map<string, unknown>
  readonly edits: Map<string, string>
  readonly adopted: Map<string, number>
  readonly seen: Set<string>
  newer?: true
}

let page: Page | undefined

const watching = new Set<() => void>()

function current(): Page {
  const factory = globalThis.indexedDB
  if (page === undefined || page.factory !== factory)
    page = { factory, decks: new Map(), edits: new Map(), adopted: new Map(), seen: new Set() }
  return page
}

export function newPage(): void {
  page = undefined
}

export function storeNewer(): boolean {
  return current().newer === true
}

export function markNewer(): void {
  const held = current()
  if (held.newer === true) return
  held.newer = true
  held.decks.clear()
  for (const listener of watching) listener()
}

export function watchNewer(listener: () => void): () => void {
  watching.add(listener)
  return () => {
    watching.delete(listener)
  }
}

export function accountKey(): string | undefined {
  const held = current()
  held.account ??= readAccountCookie(globalThis.document?.cookie)
  return held.account
}

export function heldDecks(): Map<string, unknown> {
  return current().decks
}

export function pageEdits(): Map<string, string> {
  return current().edits
}

export function pageAdopted(): Map<string, number> {
  return current().adopted
}

export function firstOnPage(key: string): boolean {
  const seen = current().seen
  if (seen.has(key)) return false
  seen.add(key)
  return true
}

const separator = "\u0005"

export function scoped(account: string, key: string): string {
  return `${account}${separator}${key}`
}

export function accountRange(account: string): IDBKeyRange {
  return IDBKeyRange.bound(`${account}${separator}`, `${account}${separator}\uffff`)
}

export function legacyRange(deck: string): IDBKeyRange {
  return IDBKeyRange.bound(`${deck}\u0000`, `${deck}${separator}`, false, true)
}

export function deckRange(account: string, deck: string): IDBKeyRange {
  return legacyRange(scoped(account, deck))
}

function connectDatabase(held: Page): Promise<IDBDatabase> {
  const opening: Promise<IDBDatabase> = new Promise((resolve, reject) => {
    const request = held.factory.open(databaseName, format)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName)
    }
    request.onsuccess = () => {
      const database = request.result
      const forget = () => {
        if (held.database === opening) held.database = undefined
        held.decks.clear()
      }
      database.onversionchange = () => {
        database.close()
        forget()
      }
      database.onclose = forget
      resolve(database)
    }
    request.onerror = () => {
      if (held.database === opening) held.database = undefined
      if (request.error?.name === "VersionError") markNewer()
      reject(request.error)
    }
  })
  return opening
}

export function openDatabase(): Promise<IDBDatabase> {
  const held = current()
  if (held.newer === true) return Promise.reject(new Error("newer"))
  held.database ??= connectDatabase(held)
  return held.database
}

export async function transaction(mode: IDBTransactionMode): Promise<IDBTransaction> {
  const database = await openDatabase()
  try {
    return database.transaction(storeName, mode)
  } catch (error) {
    const held = current()
    held.database = undefined
    held.decks.clear()
    if (!(error instanceof DOMException) || error.name !== "InvalidStateError") throw error
    return (await openDatabase()).transaction(storeName, mode)
  }
}

export function finished<Result>(transaction: IDBTransaction, result: () => Result): Promise<Result> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(result())
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error ?? new Error("aborted"))
  })
}

export async function closeDatabase(): Promise<void> {
  const held = current()
  const open = held.database
  held.database = undefined
  held.decks.clear()
  if (open !== undefined) (await open.catch(() => undefined))?.close()
}

export async function deleteDatabase(): Promise<void> {
  await closeDatabase()
  const factory = current().factory
  await new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
