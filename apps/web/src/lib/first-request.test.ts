import { afterEach, expect, it, vi } from "vitest"

const memory = new Map<string, string>()

function installStorage() {
  memory.clear()
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function fresh() {
  vi.resetModules()
  return import("./first-request")
}

it("keeps the words across a reload and drops them once they are cleared", async () => {
  installStorage()
  const first = await fresh()
  first.handFirstRequest("A Q3 board update")
  const reloaded = await fresh()
  expect(reloaded.peekFirstRequest()).toBe("A Q3 board update")
  reloaded.clearFirstRequest()
  expect((await fresh()).peekFirstRequest()).toBeUndefined()
})

it("keeps the words in memory when storage is unavailable", async () => {
  vi.stubGlobal("sessionStorage", {
    getItem() {
      throw new Error("denied")
    },
    setItem() {
      throw new Error("denied")
    },
    removeItem() {
      throw new Error("denied")
    },
  })
  const api = await fresh()
  expect(() => api.handFirstRequest("kept")).not.toThrow()
  expect(api.peekFirstRequest()).toBe("kept")
  api.clearFirstRequest()
  expect(api.peekFirstRequest()).toBeUndefined()
})

it("remembers one opening deck across a reload and replaces it", async () => {
  installStorage()
  const api = await fresh()
  api.noteOpeningDeck("one")
  expect((await fresh()).openingDeck()).toBe("one")
  const next = await fresh()
  next.noteOpeningDeck("two")
  expect(next.openingDeck()).toBe("two")
  next.clearOpeningDeck()
  expect((await fresh()).openingDeck()).toBeUndefined()
})
