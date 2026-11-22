import { doom } from "@airdesign/document"
import { picturesWantedMilliseconds } from "@airdesign/catalog"
import { describe, expect, it, vi } from "vitest"
import { createDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote, type DoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const deckNode = doom.nodeId("s:1")
const start: doom.Edit = {
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [{ node: deckNode, prop: "type", value: "deck" }],
}

describe("a deck reports the slide pictures its open tab painted", () => {
  it("sends the deck, the revision and the pictures to the server and returns the slides it still wants", async () => {
    const sent: unknown[] = []
    const remote: DoomRemote = {
      ...memoryDoomRemote(start),
      pictures: async (body) => {
        sent.push(body)
        return { ok: true, deck: body.deck as never, missing: [doom.nodeId("s:3")] }
      },
    }
    const opened = await createDoomDeck(remote, "deck1", { storage: memoryStorage() })
    if (!opened.ok) throw new Error("open")
    const pictures = { keys: [{ slide: doom.nodeId("s:3"), key: "a".repeat(64) }], images: [] }
    expect(await opened.deck.reportPictures(1, pictures)).toEqual({ ok: true, deck: "deck1", missing: ["s:3"] })
    expect(sent).toEqual([{ deck: "deck1", rev: 1, pictures }])
  })

  it("is refused plainly when the remote takes no pictures", async () => {
    const opened = await createDoomDeck(memoryDoomRemote(start), "deck1", { storage: memoryStorage() })
    if (!opened.ok) throw new Error("open")
    expect(await opened.deck.reportPictures(1, { keys: [], images: [] })).toEqual({ ok: false, refusal: "server" })
  })
})

describe("a deck learns that an agent wants pictures from its held catch-up", () => {
  it("wants none until the server says an agent asked, tells its listeners, and stops wanting after the window", async () => {
    let answers = 0
    const base = memoryDoomRemote(start)
    const remote: DoomRemote = {
      ...base,
      since: async (body, signal) => {
        const caught = await base.since({ ...body, wait: false }, signal)
        answers += 1
        if (answers === 1) return caught
        if (answers === 2 && caught.ok) return { ...caught, pictures: true }
        await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }))
        return caught
      },
    }
    let now = 10_000
    const spy = vi.spyOn(Date, "now").mockImplementation(() => now)
    try {
      const opened = await createDoomDeck(remote, "deck1", { storage: memoryStorage() })
      if (!opened.ok) throw new Error("open")
      expect(opened.deck.picturesWanted()).toBe(false)
      let told = 0
      opened.deck.subscribe(() => (told += 1))
      const stop = new AbortController()
      const following = opened.deck.follow(stop.signal)
      await vi.waitFor(() => expect(opened.deck.picturesWanted()).toBe(true))
      expect(told).toBeGreaterThan(0)
      now += picturesWantedMilliseconds + 1
      expect(opened.deck.picturesWanted()).toBe(false)
      stop.abort()
      await following
    } finally {
      spy.mockRestore()
    }
  })

  it("says it is already painting for an agent in each catch-up until the window ends, so the server does not tell it again", async () => {
    const bodies: { readonly wait?: boolean; readonly pictures?: boolean }[] = []
    const base = memoryDoomRemote(start)
    const remote: DoomRemote = {
      ...base,
      since: async (body, signal) => {
        bodies.push({
          ...(body.wait === undefined ? {} : { wait: body.wait }),
          ...("pictures" in body ? { pictures: body.pictures as boolean } : {}),
        })
        const caught = await base.since({ ...body, wait: false }, signal)
        if (bodies.length === 2 && caught.ok) return { ...caught, pictures: true }
        if (bodies.length >= 4)
          await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }))
        return caught
      },
    }
    const now = 10_000
    const spy = vi.spyOn(Date, "now").mockImplementation(() => now)
    try {
      const opened = await createDoomDeck(remote, "deck1", { storage: memoryStorage() })
      if (!opened.ok) throw new Error("open")
      const before = bodies.length
      const stop = new AbortController()
      const following = opened.deck.follow(stop.signal)
      await vi.waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(before + 4))
      const followed = bodies.slice(before)
      expect(followed.map((body) => body.pictures === true)).toEqual([false, false, true, true])
      stop.abort()
      await following
    } finally {
      spy.mockRestore()
    }
  })
})
