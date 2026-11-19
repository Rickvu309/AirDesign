import type { Page } from "@playwright/test"

type HeldWrite = { value: string | null; written: boolean; released: boolean; readwrites: number }

type Holding = { heldWrite: HeldWrite }

export async function holdWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const held: HeldWrite = { value: null, written: false, released: false, readwrites: 0 }
    Object.assign(window, { heldWrite: held })
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const request = put.call(this, value, key)
      const row = typeof value === "object" && value !== null ? (value as { readonly value?: unknown }) : {}
      if (held.written || held.value === null || row.value !== held.value) return request
      held.written = true
      const keepOpen = () => {
        if (!held.released) this.get("").onsuccess = keepOpen
      }
      keepOpen()
      return request
    }
    const transaction = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...asked: Parameters<IDBDatabase["transaction"]>) {
      if (asked[1] === "readwrite") held.readwrites += 1
      return transaction.apply(this, asked)
    }
  })
}

export async function holdWriteOf(page: Page, value: string): Promise<void> {
  await page.evaluate((value) => {
    ;(window as unknown as Holding).heldWrite.value = value
  }, value)
}

export async function writeHeld(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as Holding).heldWrite.written)
}

export function readwrites(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as Holding).heldWrite.readwrites)
}

export async function releaseWrite(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as Holding).heldWrite.released = true
  })
}
