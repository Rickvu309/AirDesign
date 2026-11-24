import type { SlowStore } from "../browser-fixtures.js"
import { newPage } from "../device.js"

export const secondAccount = "b".repeat(32)

export function slowStore(): SlowStore {
  const slow: SlowStore = {
    closed: false,
    waiting: [],
    alive: new Set(),
    hold: () => {
      slow.closed = true
    },
    release: () => {
      slow.closed = false
      for (const run of slow.waiting.splice(0)) run()
    },
    drop: () => {
      slow.closed = false
      slow.waiting.length = 0
      for (const drop of [...slow.alive]) drop()
      slow.alive.clear()
      newPage()
    },
  }
  return slow
}

export function memoryShelf(
  held: Map<string, string> = new Map(),
): Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length"> {
  return {
    get length() {
      return held.size
    },
    key: (at) => [...held.keys()][at] ?? null,
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => {
      held.set(key, value)
    },
    removeItem: (key) => {
      held.delete(key)
    },
  }
}
