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

export async function readRange(prefix: string): Promise<readonly { readonly key: string; readonly value: unknown }[]> {
  const account = accountKey()
  if (account === undefined) return []
  const reading = await transaction("readonly")
  const store = reading.objectStore(storeName)
  const range = IDBKeyRange.bound(scoped(account, prefix), scoped(account, `${prefix}\uffff`))
  const keys = store.getAllKeys(range)
  const values = store.getAll(range)
  const from = scoped(account, "").length
  return finished(reading, () =>
    (keys.result as string[]).map((key, at) => ({ key: key.slice(from), value: (values.result as unknown[])[at] })),
  )
}

export async function changeSlots(
  puts: readonly { readonly key: string; readonly value: unknown }[],
  drops: readonly string[],
): Promise<void> {
  const account = signedIn()
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  for (const key of drops) store.delete(scoped(account, key))
  for (const { key, value } of puts) store.put(value, scoped(account, key))
  await finished(writing, () => undefined)
}

export function writeSlot(key: string, value: unknown): Promise<void> {
  return putSlots([{ key, value }]).then(() => undefined)
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
