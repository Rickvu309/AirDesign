import { deckRoutes } from "@airdesign/catalog"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, installParts } from "./browser-fixtures.js"
import { flushOriginal } from "./original-queue.js"
import { deleteDatabase, getParts, putParts, renameDeck } from "./index.js"

beforeEach(async () => {
  installIndexedDb()
  installParts()
  await putParts("blank-one", {
    parts: new Map([["a.xml", new Uint8Array([1])]]),
    file: new Uint8Array([2]),
    name: "Old",
  })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function answering(sent: unknown[]) {
  return async (path: string, init: RequestInit) => {
    expect(path).toBe(deckRoutes.rename.path)
    const body: { deck: string; name: string } = JSON.parse(String(init.body))
    sent.push(body)
    return new Response(JSON.stringify({ ok: true, deck: body.deck, name: body.name }))
  }
}

it("keeps the new name on the device and sends it to the server", async () => {
  const sent: unknown[] = []
  vi.stubGlobal("fetch", answering(sent))
  await renameDeck("blank-one", "Quarterly plan")
  const stored = await getParts("blank-one")
  expect(stored.ok && stored.name).toBe("Quarterly plan")
  expect(sent).toEqual([{ deck: "blank-one", name: "Quarterly plan" }])
})

it("keeps the parts and the file as they were", async () => {
  vi.stubGlobal("fetch", answering([]))
  await renameDeck("blank-one", "Quarterly plan")
  const stored = await getParts("blank-one")
  expect(stored.ok && [...stored.parts.keys()]).toEqual(["a.xml"])
  expect(stored.ok && Array.from(stored.file)).toEqual([2])
})

it("sends the name again once the network is back and then stops", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  await renameDeck("blank-one", "Quarterly plan")
  const sent: unknown[] = []
  vi.stubGlobal("fetch", answering(sent))
  await flushOriginal("blank-one")
  await flushOriginal("blank-one")
  expect(sent).toEqual([{ deck: "blank-one", name: "Quarterly plan" }])
})

it("sends only the latest name when it changed twice while offline", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  await renameDeck("blank-one", "First try")
  await renameDeck("blank-one", "Second try")
  const sent: unknown[] = []
  vi.stubGlobal("fetch", answering(sent))
  await flushOriginal("blank-one")
  expect(sent).toEqual([{ deck: "blank-one", name: "Second try" }])
})

it("refuses a deck that is not on the device", async () => {
  vi.stubGlobal("fetch", answering([]))
  await expect(renameDeck("absent-deck", "Name")).resolves.toEqual({ ok: false })
})

it("never has two renames of one deck in flight, so the newest name is the one the server keeps", async () => {
  let open = 0
  let most = 0
  const sent: string[] = []
  vi.stubGlobal("fetch", async (_path: string, init: RequestInit) => {
    const body: { deck: string; name: string } = JSON.parse(String(init.body))
    open++
    most = Math.max(most, open)
    await new Promise((resolve) => setTimeout(resolve, 20))
    open--
    sent.push(body.name)
    return new Response(JSON.stringify({ ok: true, deck: body.deck, name: body.name }))
  })
  await Promise.all([renameDeck("blank-one", "First"), renameDeck("blank-one", "Second")])
  expect(most).toBe(1)
  expect(sent.at(-1)).toBe("Second")
})
