import { currentValue } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installSlowIndexedDb, memoryShelf, node, slowStore } from "./browser-fixtures.js"
import type { OpenDeckResult } from "./cache.js"
import { connect, deleteDatabase, memoryRemote } from "./index.js"

const slow = slowStore()

beforeEach(() => {
  installSlowIndexedDb(slow)
})

afterEach(async () => {
  slow.drop()
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function text(opened: OpenDeckResult): string | null {
  if (!opened.ok) throw new Error(opened.refusal)
  const body = opened.register.elements[node]
  return body === undefined ? null : currentValue(body)
}

it("reads a deck without an edit asked for after the read, while the device holds the read", async () => {
  const cache = connect(memoryRemote(), { shelf: memoryShelf() })
  expect((await cache.enqueue("deck", "Old", node, "file text")).ok).toBe(true)
  slow.hold()
  const before = cache.openDeck("deck")
  const typed = cache.enqueue("deck", "N", node, "file text")
  const after = cache.openDeck("deck")
  await new Promise((done) => setTimeout(done, 0))
  expect(slow.waiting.length).toBe(1)
  slow.release()
  expect(text(await before)).toBe("Old")
  expect((await typed).ok).toBe(true)
  expect(text(await after)).toBe("N")
})
