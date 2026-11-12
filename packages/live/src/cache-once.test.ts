import { readCommit } from "@airdesign/catalog"
import { limits } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, node, other } from "./browser-fixtures.js"
import { connect, deleteDatabase, httpRemote, memoryRemote, type CommitResult } from "./index.js"

beforeEach(installIndexedDb)
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it.each([false, true])("lands a lost answer once with reload %s and drains later edits separately", async (reload) => {
  const server = memoryRemote()
  const stored = new Map<string, CommitResult>()
  const requests: unknown[] = []
  let drop = true
  vi.stubGlobal("fetch", async (_path: string, init: RequestInit) => {
    const body: unknown = JSON.parse(String(init.body))
    const parsed = readCommit(body)
    if (!parsed.ok) return new Response(JSON.stringify(await server.open({ deck: "once" })))
    requests.push(parsed)
    const prior = parsed.once === undefined ? undefined : stored.get(parsed.once)
    const result = prior ?? (await server.commit({ deck: parsed.deck, batch: parsed.batch }))
    if (parsed.once !== undefined) stored.set(parsed.once, result)
    if (drop) {
      drop = false
      throw new Error("answer lost")
    }
    return new Response(JSON.stringify(result))
  })
  let next = 0
  const once = vi.fn(() => `batch-${next++}`)
  let cache = connect(httpRemote(), { once })
  await cache.enqueue("once", "first", node, "")
  await expect(cache.flush("once")).rejects.toThrow("answer lost")
  expect((await cache.pending("once")).map((row) => row.value)).toEqual(["first"])
  if (reload) {
    vi.resetModules()
    cache = (await import("./index.js")).connect(httpRemote(), { once })
  }
  expect(await cache.flush("once")).toMatchObject({ ok: true, revision: 1 })
  expect(await server.open({ deck: "once" })).toMatchObject({ ok: true, revision: 1 })
  await cache.enqueue("once", "later", node, "")
  expect(await cache.flush("once")).toMatchObject({ ok: true, revision: 2 })
  expect(once).toHaveBeenCalledTimes(2)
  expect(requests).toHaveLength(3)
  expect(requests[1]).toEqual(requests[0])
  expect(await server.open({ deck: "once" })).toMatchObject({ ok: true, revision: 2 })
  expect(await cache.pending("once")).toEqual([])
  expect(await cache.phase("once")).toBe("confirmed")
})

it("keeps full batch boundaries when an answer is lost", async () => {
  const server = memoryRemote()
  const stored = new Map<string, CommitResult>()
  let attempts = 0
  const cache = connect({
    ...server,
    commit: async (body) => {
      const parsed = readCommit(body)
      if (!parsed.ok) throw new Error("commit")
      const prior = parsed.once === undefined ? undefined : stored.get(parsed.once)
      const result = prior ?? (await server.commit(body))
      if (parsed.once !== undefined) stored.set(parsed.once, result)
      attempts += 1
      if (attempts === 2) throw new Error("answer lost")
      return result
    },
  })
  for (let i = 0; i < limits.batch + 1; i += 1) await cache.enqueue("full", String(i), i % 2 === 0 ? node : other, "")
  await expect(cache.flush("full")).rejects.toThrow("answer lost")
  await cache.enqueue("full", "last", other, "")
  expect(await cache.flush("full")).toMatchObject({ ok: true, revision: 3 })
  const opened = await server.open({ deck: "full" })
  expect(opened).toMatchObject({ ok: true, revision: 3 })
  if (!opened.ok) throw new Error("open")
  expect(
    (opened.register.elements[node]?.landed.length ?? 0) + (opened.register.elements[other]?.landed.length ?? 0),
  ).toBe(limits.batch + 2)
  expect(await cache.pending("full")).toEqual([])
})
