import { currentValue } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, node, other } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote, ownerRemote, type Remote } from "./index.js"

beforeEach(installIndexedDb)
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function traced(): { real: Remote; remote: Remote; calls: string[] } {
  const real = memoryRemote()
  const calls: string[] = []
  return {
    real,
    calls,
    remote: {
      open: async (body) => {
        calls.push("open")
        return real.open(body)
      },
      watch: (body) => real.watch(body),
      commit: async (body) => {
        calls.push("commit")
        return real.commit(body)
      },
    },
  }
}

async function shown(cache: ReturnType<typeof connect>, id = node): Promise<string | undefined> {
  const opened = await cache.openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  const body = opened.register.elements[id]
  return body === undefined ? undefined : currentValue(body)
}

it("brings another writer's edit into the local view and keeps that open answer for the next open", async () => {
  const { real, remote, calls } = traced()
  const cache = connect(remote)
  await cache.openDeck("deck")
  const following = cache.follow("deck")
  await real.commit({ deck: "deck", batch: [{ node, value: "Agent" }] })
  expect(await following).toEqual({ ok: true, deck: "deck", revision: 1, changed: true })
  expect(await shown(cache)).toBe("Agent")
  await deleteDatabase()
  expect(await shown(cache)).toBe("Agent")
  expect(calls).toEqual(["open", "open"])
})

it("does not open the deck again for this device's own commit", async () => {
  const { remote, calls } = traced()
  const cache = connect(remote)
  await cache.openDeck("deck")
  const following = cache.follow("deck")
  await cache.enqueue("deck", "Mine", node, "")
  expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
  expect(await following).toEqual({ ok: true, deck: "deck", revision: 1, changed: false })
  expect(await shown(cache)).toBe("Mine")
  expect(calls).toEqual(["open", "commit"])
})

it("opens the deck again when another writer's revision lands between two of this device's", async () => {
  const { real, remote, calls } = traced()
  const cache = connect(remote)
  await cache.openDeck("deck")
  await real.commit({ deck: "deck", batch: [{ node: other, value: "Agent" }] })
  await cache.enqueue("deck", "Mine", node, "")
  expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 2 })
  expect(await cache.follow("deck")).toEqual({ ok: true, deck: "deck", revision: 2, changed: true })
  expect([await shown(cache), await shown(cache, other)]).toEqual(["Mine", "Agent"])
  expect(calls).toEqual(["open", "commit", "open"])
})

it("catches a reopened tab up on its first follow when it starts from local rows", async () => {
  const { real, remote } = traced()
  const cache = connect(remote)
  await cache.openDeck("deck")
  await cache.enqueue("deck", "Mine", node, "")
  await cache.flush("deck")
  await real.commit({ deck: "deck", batch: [{ node: other, value: "Agent" }] })
  vi.resetModules()
  const reopened = (await import("./index.js")).connect(remote)
  expect(await reopened.follow("deck")).toEqual({ ok: true, deck: "deck", revision: 2, changed: true })
  expect([await shown(reopened), await shown(reopened, other)]).toEqual(["Mine", "Agent"])
})

it("answers the server's refusal and a malformed deck without touching the local rows", async () => {
  expect(await connect(ownerRemote()).follow("deck")).toEqual({ ok: false, refusal: "owner" })
  expect(await connect(memoryRemote()).follow("bad id")).toEqual({ ok: false, refusal: "deck" })
})
