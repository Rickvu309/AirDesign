import { currentValue, presentSlides, slideId, orderKeyAfter } from "@airdesign/document"
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

it("opens the deck once for a visit whose first edit lands before the open is read", async () => {
  const { remote, calls } = traced()
  const cache = connect(remote)
  await cache.open("deck")
  await cache.enqueue("deck", "Mine", node, "")
  expect(await shown(cache)).toBe("Mine")
  const following = cache.follow("deck")
  expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
  expect(await following).toEqual({ ok: true, deck: "deck", revision: 1, changed: false })
  expect(calls).toEqual(["open", "commit"])
})

it("waits for another writer after this device's first commit instead of opening the deck again", async () => {
  const { real, remote, calls } = traced()
  const cache = connect(remote)
  await cache.open("deck")
  await cache.enqueue("deck", "Mine", node, "")
  expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
  let answered = false
  const following = cache.follow("deck").then((result) => {
    answered = true
    return result
  })
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(answered).toBe(false)
  expect(calls).toEqual(["open", "commit"])
  await real.commit({ deck: "deck", batch: [{ node: other, value: "Agent" }] })
  expect(await following).toEqual({ ok: true, deck: "deck", revision: 2, changed: true })
  expect([await shown(cache), await shown(cache, other)]).toEqual(["Mine", "Agent"])
})

it("brings another writer's rows from the open into a first commit that starts from local rows", async () => {
  const { real, remote, calls } = traced()
  const cache = connect(remote)
  await real.open({ deck: "deck" })
  await real.commit({ deck: "deck", batch: [{ node: other, value: "Agent" }] })
  await cache.open("deck")
  await cache.enqueue("deck", "Mine", node, "")
  expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 2 })
  expect([await shown(cache), await shown(cache, other)]).toEqual(["Mine", "Agent"])
  expect(calls).toEqual(["open", "commit"])
})

it("shows a reopened visit what the server holds from the open it already made, and opens once", async () => {
  const { real, remote, calls } = traced()
  const first = connect(remote)
  await first.openDeck("deck")
  await first.enqueue("deck", "Mine", node, "")
  await first.flush("deck")
  await real.commit({ deck: "deck", batch: [{ node: other, value: "Agent" }] })
  vi.resetModules()
  const reopened = (await import("./index.js")).connect(remote)
  expect(await reopened.open("deck")).toEqual({ ok: true })
  expect([await shown(reopened), await shown(reopened, other)]).toEqual(["Mine", "Agent"])
  let answered = false
  const following = reopened.follow("deck").then((result) => {
    answered = true
    return result
  })
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(answered).toBe(false)
  expect(calls).toEqual(["open", "commit", "open"])
  await real.commit({ deck: "deck", batch: [{ node: other, value: "Later" }] })
  expect(await following).toMatchObject({ ok: true, changed: true })
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

it("follows slide commands and continues following the next element revision", async () => {
  const { real, remote } = traced()
  const cache = connect(remote)
  await cache.openDeck("deck")
  const file = [slideId("256")] as const
  const key = orderKeyAfter(presentSlides({ file, order: [] }), file[0])
  if (key === null) throw new Error("key")
  await real.commit({ deck: "deck", batch: [{ slide: "clone", id: slideId("257"), source: file[0], key, file }] })
  expect(await cache.follow("deck")).toMatchObject({ ok: true, changed: true, revision: 1 })
  const opened = await cache.openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  expect(presentSlides(opened.register).map((slide) => slide.id)).toEqual(["256", "257"])
  await real.commit({ deck: "deck", batch: [{ node, value: "After slides" }] })
  expect(await cache.follow("deck")).toMatchObject({ ok: true, changed: true, revision: 2 })
  expect(await shown(cache)).toBe("After slides")
})

it("paints another writer's edit while the opening index send is still on the wire", async () => {
  const real = memoryRemote()
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let indexStarted = false
  let indexReturned = false
  const remote: Remote = {
    ...real,
    index: async (body) => {
      indexStarted = true
      await held
      indexReturned = true
      return real.index!(body)
    },
  }
  const cache = connect(remote)
  await cache.openDeck("deck")
  const importing = {
    slides: [{ id: "258", position: 0 }],
    elements: [{ node, kind: "shape" as const, value: "Title", box: null, grouped: false }],
  }
  expect(await cache.index("deck", importing)).toEqual({ ok: true })
  const flushing = cache.flush("deck")
  try {
    await vi.waitFor(() => {
      if (!indexStarted) throw new Error("index has not started")
    })
    let followed = false
    const following = cache.follow("deck").then((result) => {
      followed = true
      return result
    })
    await real.commit({ deck: "deck", batch: [{ node, value: "Agent" }] })
    await vi.waitFor(() => {
      if (!followed) throw new Error("follow is still behind the index")
    })
    expect(indexReturned).toBe(false)
    expect(await following).toMatchObject({ ok: true, changed: true })
    expect(await shown(cache)).toBe("Agent")
  } finally {
    release()
    await flushing
  }
})

it("keeps its own slide order when follow sees the committed revision", async () => {
  const { remote, calls } = traced()
  const cache = connect(remote)
  await cache.openDeck("deck")
  const following = cache.follow("deck")
  const file = [slideId("256"), slideId("257")] as const
  expect(await cache.enqueueSlide("deck", file, { slide: "remove", id: file[0] })).toMatchObject({ ok: true })
  expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
  expect(await following).toMatchObject({ ok: true, changed: false, revision: 1 })
  const opened = await cache.openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  expect(presentSlides(opened.register).map((slide) => slide.id)).toEqual(["257"])
  expect(calls).toEqual(["open", "commit"])
})
