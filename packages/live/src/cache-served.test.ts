import { currentValue } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, node } from "./browser-fixtures.js"
import { connect, deleteDatabase, knownRevision, memoryRemote, servedDeck } from "./index.js"

beforeEach(installIndexedDb)
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("knows the server revision this page holds and opens the server's copy as the page would show it", async () => {
  const remote = memoryRemote()
  const cache = connect(remote)
  expect(knownRevision(remote, "deck")).toBeUndefined()
  await cache.openDeck("deck")
  expect(knownRevision(remote, "deck")).toBe(0)
  await cache.enqueue("deck", "Mine", node, "")
  await cache.enqueue("deck", "Mine, still typing", node, "")
  expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
  expect(knownRevision(remote, "deck")).toBe(1)
  await remote.commit({ deck: "deck", batch: [{ node, value: "Agent" }] })
  expect(knownRevision(remote, "deck")).toBe(1)
  const served = await servedDeck(remote, "deck")
  if (!served.ok) throw new Error(served.refusal)
  expect(served.revision).toBe(2)
  const body = served.register.elements[node]
  expect(body === undefined ? undefined : currentValue(body)).toBe("Agent")
  expect(await servedDeck(remote, "not a deck")).toEqual({ ok: false, refusal: "deck" })
})
