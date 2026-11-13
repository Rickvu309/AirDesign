import type { Page } from "@playwright/test"

declare global {
  interface Window {
    deviceDelay?: number
    deviceGate?: Promise<void>
    openDevice?: () => void
  }
}

export async function holdableDevice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const begin = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (
      this: IDBDatabase,
      stores: string | string[],
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions,
    ) {
      const delay = window.deviceDelay
      const gate = window.deviceGate
      if (mode !== "readwrite" || (delay === undefined && gate === undefined))
        return begin.call(this, stores, mode, options)
      type Operation = {
        method: "get" | "getAll" | "put" | "delete"
        args: unknown[]
        request: { result: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null }
      }
      const waiting: Operation[] = []
      const facade = { oncomplete: null as (() => void) | null, onerror: null, onabort: null }
      let store: IDBObjectStore | null = null
      const run = (operation: Operation) => {
        const real = (store as unknown as Record<string, (...args: unknown[]) => IDBRequest>)[operation.method]?.apply(
          store,
          operation.args,
        )
        if (real === undefined) return
        real.onsuccess = () => {
          operation.request.result = real.result
          operation.request.onsuccess?.()
        }
        real.onerror = () => operation.request.onerror?.()
      }
      const queue = (method: Operation["method"], ...args: unknown[]) => {
        const operation: Operation = { method, args, request: { result: undefined, onsuccess: null, onerror: null } }
        if (store === null) waiting.push(operation)
        else run(operation)
        return operation.request
      }
      const start = () => {
        const real = begin.call(this, stores, mode, options)
        real.oncomplete = () => facade.oncomplete?.()
        store = real.objectStore(typeof stores === "string" ? stores : (stores[0] ?? ""))
        for (const operation of waiting.splice(0)) run(operation)
      }
      if (gate === undefined) window.setTimeout(start, delay)
      else void gate.then(start)
      return Object.assign(facade, {
        objectStore: () => ({
          get: (key: unknown) => queue("get", key),
          getAll: (range: unknown) => queue("getAll", range),
          put: (value: unknown, key: unknown) => queue("put", value, key),
          delete: (key: unknown) => queue("delete", key),
        }),
      }) as unknown as IDBTransaction
    } as typeof IDBDatabase.prototype.transaction
  })
}

export async function slowDevice(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.deviceDelay = 20_000
  })
}

export async function holdDevice(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.deviceGate = new Promise((open) => {
      window.openDevice = open
    })
  })
}

export async function openDevice(page: Page): Promise<void> {
  await page.evaluate(() => {
    const open = window.openDevice
    window.deviceGate = undefined
    window.openDevice = undefined
    open?.()
  })
}
