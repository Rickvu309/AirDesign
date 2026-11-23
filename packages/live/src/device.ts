import { readAccountCookie } from "@airdesign/catalog"
import { format } from "@airdesign/document"

export const databaseName = "airdesign"
export const storeName = "rows"

type Page = {
  readonly factory: IDBFactory
  account?: string | undefined
  database?: Promise<IDBDatabase> | undefined
  newer?: true
}

let page: Page | undefined

function current(): Page {
  const factory = globalThis.indexedDB
  if (page === undefined || page.factory !== factory) page = { factory }
  return page
}

export function newPage(): void {
  page = undefined
}

export function accountKey(): string | undefined {
  const held = current()
  held.account ??= readAccountCookie(globalThis.document?.cookie)
  return held.account
}

const separator = "\u0005"

export function scoped(account: string, key: string): string {
  return `${account}${separator}${key}`
}

export function accountRange(account: string): IDBKeyRange {
  return IDBKeyRange.bound(`${account}${separator}`, `${account}${separator}\uffff`)
}

export function deckRange(account: string, deck: string): IDBKeyRange {
  const scope = scoped(account, deck)
  return IDBKeyRange.bound(`${scope}\u0000`, `${scope}${separator}`, false, true)
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
      if (request.error?.name === "VersionError") held.newer = true
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
    current().database = undefined
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
