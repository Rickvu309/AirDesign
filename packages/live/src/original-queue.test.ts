import { deckRoutes } from "@airdesign/catalog"
import { afterEach, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { flushOriginal, queueOriginal } from "./original-queue.js"

const stored = vi.hoisted(() => ({ sends: 0, ok: false }))
vi.mock("./part.js", () => ({
  getParts: async () => ({ ok: true, file: new Uint8Array([1]), name: "Blank deck" }),
}))
vi.mock("./original.js", () => ({
  sendOriginal: async () => {
    stored.sends++
    return { ok: stored.ok }
  },
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

it("reports an unsent original when device storage cannot be read", async () => {
  vi.stubGlobal("indexedDB", {
    open() {
      throw new Error("storage")
    },
  })
  await expect(flushOriginal("blank-one")).resolves.toEqual({ ok: false })
})

it("keeps the original queued through an offline rename, a failed upload and a reload", async () => {
  installIndexedDb()
  stored.sends = 0
  stored.ok = false
  const calls: unknown[] = []
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  await queueOriginal("blank-one")
  expect(await flushOriginal("blank-one")).toEqual({ ok: false })
  expect(stored.sends).toBe(0)
  vi.stubGlobal("fetch", async (path: string, init: RequestInit) => {
    expect(path).toBe(deckRoutes.rename.path)
    calls.push(JSON.parse(String(init.body)))
    return new Response(JSON.stringify({ ok: true, deck: "blank-one", name: "Blank deck" }))
  })
  expect(await flushOriginal("blank-one")).toEqual({ ok: false })
  expect(stored.sends).toBe(1)
  stored.ok = true
  expect(await flushOriginal("blank-one")).toEqual({ ok: true })
  expect(stored.sends).toBe(2)
  expect(calls).toEqual([{ deck: "blank-one", name: "Blank deck" }])
  await flushOriginal("blank-one")
  await flushOriginal("another-deck")
  expect(stored.sends).toBe(2)
})
