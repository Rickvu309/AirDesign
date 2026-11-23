import { accountKey, finished, scoped, storeName, transaction } from "./device.js"

export function signedIn(): string {
  const account = accountKey()
  if (account === undefined) throw new Error("session")
  return account
}

export async function readSlot(key: string): Promise<unknown> {
  const account = accountKey()
  if (account === undefined) return null
  const reading = await transaction("readonly")
  const request = reading.objectStore(storeName).getAll(IDBKeyRange.bound(scoped(account, key), scoped(account, key)))
  return finished(reading, () => (request.result as unknown[])[0] ?? null)
}

export function writeSlot(key: string, value: unknown): Promise<void> {
  return putSlots([{ key, value }]).then(() => undefined)
}

export function replaceSlots(puts: readonly { readonly key: string; readonly value: unknown }[]): Promise<void> {
  return putSlots(puts).then(() => undefined)
}

export async function changeSlot(key: string, change: (current: unknown) => unknown): Promise<void> {
  const account = signedIn()
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  const request = store.get(scoped(account, key))
  request.onsuccess = () => {
    store.put(change(request.result), scoped(account, key))
  }
  await finished(writing, () => undefined)
}

export function swapSlot(key: string, value: unknown, keep: (current: unknown) => boolean): Promise<boolean> {
  return putSlots([{ key, value }], { key, keep })
}

async function putSlots(
  puts: readonly { readonly key: string; readonly value: unknown }[],
  guard?: { readonly key: string; readonly keep: (current: unknown) => boolean },
): Promise<boolean> {
  const account = signedIn()
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  let written = false
  const put = () => {
    for (const { key, value } of puts) store.put(value, scoped(account, key))
    written = true
  }
  if (guard === undefined) put()
  else {
    const request = store.getAll(IDBKeyRange.bound(scoped(account, guard.key), scoped(account, guard.key)))
    request.onsuccess = () => {
      if (guard.keep((request.result as unknown[])[0])) put()
    }
  }
  return finished(writing, () => written)
}
