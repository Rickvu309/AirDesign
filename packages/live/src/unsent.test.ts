import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, node, other } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote, watchUnsent, type CommitResult, type Remote } from "./index.js"

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function heldRemote() {
  const real = memoryRemote()
  const releases: (() => void)[] = []
  const remote: Remote = {
    open: (body) => real.open(body),
    watch: (body) => real.watch(body),
    commit: async (body) => {
      await new Promise<void>((resolve) => releases.push(resolve))
      return real.commit(body)
    },
  }
  return { remote, releaseFirst: () => releases.shift()?.() }
}

function heard(deck: string) {
  const said: boolean[] = []
  const stop = watchUnsent(deck, (unsent) => said.push(unsent))
  return { said, last: () => said.at(-1), stop }
}

async function settledWrites() {
  await new Promise((resolve) => setTimeout(resolve, 20))
}

it("says a deck has unsent edits once an edit is on the device, and none once its send lands", async () => {
  const cache = connect(memoryRemote())
  await cache.openDeck("deck")
  const watched = heard("deck")
  await cache.enqueue("deck", "typed", node, "")
  expect(watched.last()).toBe(true)
  await cache.flush("deck")
  expect(watched.last()).toBe(false)
  watched.stop()
})

it("keeps saying unsent while an edit made during an earlier send waits for its own", async () => {
  const { remote, releaseFirst } = heldRemote()
  const cache = connect(remote)
  await cache.openDeck("deck")
  const watched = heard("deck")
  await cache.enqueue("deck", "first", node, "")
  const firstSend = cache.flush("deck")
  await settledWrites()
  await cache.enqueue("deck", "second", other, "")
  const secondSend = cache.flush("deck")
  releaseFirst()
  const answered: CommitResult = await firstSend
  expect(answered.ok).toBe(true)
  expect(watched.last()).toBe(true)
  await settledWrites()
  releaseFirst()
  await secondSend
  expect(watched.last()).toBe(false)
  watched.stop()
})

it("says a deck opened with edits from an earlier visit has unsent edits before any send", async () => {
  const cache = connect(memoryRemote())
  await cache.openDeck("deck")
  await cache.enqueue("deck", "left from before", node, "")
  const watched = heard("deck")
  await settledWrites()
  expect(watched.said).toEqual([true])
  watched.stop()
})

it("stops telling a watcher that stopped watching", async () => {
  const cache = connect(memoryRemote())
  await cache.openDeck("deck")
  const watched = heard("deck")
  watched.stop()
  await cache.enqueue("deck", "typed", node, "")
  expect(watched.said.includes(true)).toBe(false)
})
