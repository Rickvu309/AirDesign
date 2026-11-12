import { currentBox, currentValue, orderKeyAfter, presentSlides, slideId, type Register } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { firstAccount, installSlowIndexedDb, memoryShelf, node, other, slowStore } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote } from "./index.js"
import { keepUnsaved } from "./unsaved.js"

const slow = slowStore()
const first = { x: 914400, y: 457200, cx: 1828800, cy: 914400 }
const file = [slideId("256"), slideId("257")] as const

beforeEach(() => {
  installSlowIndexedDb(slow)
})

afterEach(async () => {
  slow.drop()
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function counted() {
  let count = 0
  return () => `entry-${(count += 1)}`
}

async function reloaded(journal: Map<string, string>): Promise<Register> {
  const opened = await connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() }).openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  return opened.register
}

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function addSlide() {
  const key = orderKeyAfter(presentSlides({ file, order: [] }), file[0])
  if (key === null) throw new Error("key")
  return { slide: "add" as const, id: slideId("258"), after: file[0], key, layout: file[0] }
}

it("keeps the text typed while the device write is slow when the page reloads", async () => {
  const journal = new Map<string, string>()
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  slow.hold()
  void cache.enqueue("deck", "Typed on a new slide", node, "file text")
  await tick()
  slow.drop()
  const register = await reloaded(journal)
  expect(currentValue(register.elements[node]!)).toBe("Typed on a new slide")
  expect(journal.size).toBe(0)
})

it("keeps only the newest text of a box when several keystrokes are still unsaved", async () => {
  const journal = new Map<string, string>()
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  slow.hold()
  void cache.enqueue("deck", "T", node, "file text")
  void cache.enqueue("deck", "Ty", node, "file text")
  void cache.enqueue("deck", "Typ", node, "file text")
  await tick()
  slow.drop()
  const reopened = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  expect((await reopened.pending("deck")).map((row) => row.value)).toEqual(["Typ"])
})

it("keeps a box move that is still unsaved when the page reloads", async () => {
  const journal = new Map<string, string>()
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  slow.hold()
  void cache.enqueueBox("deck", first, node, "file text")
  await tick()
  slow.drop()
  const register = await reloaded(journal)
  expect(currentBox(register.elements[node]!)).toEqual(first)
})

it("keeps a speaker notes edit that is still unsaved when the page reloads", async () => {
  const journal = new Map<string, string>()
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  slow.hold()
  void cache.enqueue("deck", "Say hello", other, "notes text")
  await tick()
  slow.drop()
  const register = await reloaded(journal)
  expect(currentValue(register.elements[other]!)).toBe("Say hello")
})

it("keeps a slide command that is still unsaved when the page reloads", async () => {
  const journal = new Map<string, string>()
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  slow.hold()
  void cache.enqueueSlide("deck", file, addSlide())
  await tick()
  slow.drop()
  const register = await reloaded(journal)
  expect(presentSlides(register).map((spot) => spot.id)).toEqual(["256", "258", "257"])
})

it("does not apply a slide command twice when the device had it but the page died before it cleared the journal", async () => {
  const journal = new Map<string, string>()
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  const kept = new Map<string, string>()
  const pending = cache.enqueueSlide("deck", file, addSlide())
  for (const [key, value] of journal) kept.set(key, value)
  await pending
  expect(journal.size).toBe(0)
  const register = await reloaded(kept)
  expect(presentSlides(register).map((spot) => spot.id)).toEqual(["256", "258", "257"])
})

it("clears the journal once the device holds the edit", async () => {
  const journal = new Map<string, string>()
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  const pending = cache.enqueue("deck", "text", node, "file text")
  expect(journal.size).toBe(1)
  await pending
  expect(journal.size).toBe(0)
})

it("clears the journal when the edit is refused", async () => {
  const journal = new Map<string, string>()
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  expect(await cache.enqueue("deck", "x".repeat(9_000), node, "file text")).toEqual({ ok: false, refusal: "limit" })
  expect(journal.size).toBe(0)
})

it("keeps the journal when the device cannot be written", async () => {
  const journal = new Map<string, string>()
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  vi.stubGlobal("indexedDB", {
    open: () => {
      throw new Error("device")
    },
  })
  await expect(cache.enqueue("deck", "text", node, "file text")).rejects.toThrow("device")
  expect(journal.size).toBe(1)
})

it("replays an unsaved edit once and not again on the next read", async () => {
  const journal = new Map<string, string>()
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  slow.hold()
  void cache.enqueue("deck", "once", node, "file text")
  await tick()
  slow.drop()
  const reopened = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  await reopened.openDeck("deck")
  await reopened.openDeck("deck")
  expect((await reopened.pending("deck")).map((row) => row.value)).toEqual(["once"])
})

it("does not replay an edit that another page has since replaced with a newer keystroke", async () => {
  const journal = new Map<string, string>()
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  slow.hold()
  void cache.enqueue("deck", "abc", node, "file text")
  await tick()
  slow.drop()
  const reopened = connect(memoryRemote(), { shelf: memoryShelf(journal), entry: counted() })
  slow.hold()
  const opening = reopened.openDeck("deck")
  await tick()
  keepUnsaved(memoryShelf(journal), firstAccount, "deck", "newer", { kind: "text", node, floor: "file text", value: "abcd" })
  slow.release()
  await opening
  expect(await reopened.pending("deck")).toEqual([])
})

it("works as before with no shelf to keep the journal on", async () => {
  const cache = connect(memoryRemote())
  expect(await cache.enqueue("deck", "text", node, "file text")).toEqual({ ok: true, painted: "text" })
})
