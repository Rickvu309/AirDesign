import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { countingRemote, installIndexedDb, node, other, tracedRemote } from "./browser-fixtures.js"
import { connect, deleteDatabase } from "./index.js"

beforeEach(installIndexedDb)
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("opens nothing when no row is pending, and says the send carried none", async () => {
  const { remote, calls } = tracedRemote()
  expect(await connect(remote).flush("deck")).toEqual({ ok: false, refusal: "batch", empty: true })
  expect(calls).toEqual([])
})

it("says only the later of two flushes started together carried no rows", async () => {
  const { remote } = countingRemote()
  const cache = connect(remote)
  await cache.enqueue("deck", "one", node, "")
  await cache.enqueue("deck", "two", other, "")
  const [first, second] = await Promise.all([cache.flush("deck"), connect(remote).flush("deck")])
  expect(first).not.toHaveProperty("empty")
  expect(second).toEqual({ ok: false, refusal: "batch", empty: true })
})
