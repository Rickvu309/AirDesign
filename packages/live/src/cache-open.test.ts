import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, node, tracedRemote } from "./browser-fixtures.js"
import { connect, deleteDatabase } from "./index.js"

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("opens the deck once for the editor's mount and its first commit", async () => {
  const { remote, calls } = tracedRemote()
  const cache = connect(remote)
  await cache.openDeck("deck")
  await cache.enqueue("deck", "first", node, "")
  expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
  expect(calls).toEqual(["open deck", "commit deck"])
})

it("hands the deck an import opened to the editor's mount without opening it again", async () => {
  const { remote, calls } = tracedRemote()
  await connect(remote).open("deck")
  const opened = await connect(remote).openDeck("deck")
  expect(opened).toMatchObject({ ok: true, phase: "confirmed", confirmed: [] })
  await connect(remote).enqueue("deck", "first", node, "")
  expect(await connect(remote).flush("deck")).toMatchObject({ ok: true, revision: 1 })
  expect(calls).toEqual(["open deck", "commit deck"])
})
