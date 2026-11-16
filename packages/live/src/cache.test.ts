import { rootElement, type NodeRegister, type Register } from "@airdesign/document"
import type { DeckId } from "@airdesign/catalog"
import { currentValue, elementId, legacyElement, openRegister } from "@airdesign/document"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installIndexedDb, node, other, countingRemote, tracedRemote } from "./browser-fixtures.js"
import {
  type CommitResult,
  connect,
  deleteDatabase,
  httpRemote,
  memoryRemote,
  ownerRemote,
  type Remote,
} from "./index.js"

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

describe("live cache", () => {
  it("paints the enqueue and does not commit", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    expect(await cache.enqueue("deck", "next", node, "")).toEqual({ ok: true, painted: "next" })
    expect(commits).toEqual([])
  })

  it("drops a refused edit", async () => {
    const cache = connect(memoryRemote())
    expect(await cache.enqueue("deck", "nope", legacyElement, "")).toEqual({ ok: false, refusal: "dead" })
    expect(await cache.pending("deck")).toEqual([])
  })

  it("flushes the earlier edit before the later one", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    await cache.enqueue("deck", "earlier", node, "")
    await cache.enqueue("deck", "later", other, "")
    await cache.flush("deck")
    expect(commits).toEqual([["earlier", "later"]])
  })

  it("stays on device until flush", async () => {
    const cache = connect(memoryRemote())
    expect(await cache.phase("deck")).toBe("confirmed")
    await cache.enqueue("deck", "text", node, "")
    expect(await cache.phase("deck")).toBe("on-device")
    await cache.flush("deck")
    expect(await cache.phase("deck")).toBe("confirmed")
    expect(await cache.pending("deck")).toEqual([])
  })

  it("refuses to enqueue a malformed element id and writes no row", async () => {
    const cache = connect(memoryRemote())
    const before = await cache.rows("deck")
    expect(await Reflect.apply(cache.enqueue, cache, ["deck", "nope", "258.", ""])).toEqual({
      ok: false,
      refusal: "dead",
    })
    expect(await cache.rows("deck")).toEqual(before)
  })

  it("refuses to enqueue a value over 8000 bytes and writes no row", async () => {
    const cache = connect(memoryRemote())
    const over = "é".repeat(4001)
    expect(new TextEncoder().encode(over).length).toBe(8002)
    const before = await cache.rows("deck")
    expect(await cache.enqueue("deck", over, node, "")).toEqual({ ok: false, refusal: "limit" })
    expect(await cache.rows("deck")).toEqual(before)
    for (const value of ["x".repeat(8001), "€".repeat(2667)]) {
      expect(new TextEncoder().encode(value).length).toBe(8001)
      expect(await cache.enqueue("deck", value, node, "")).toEqual({ ok: false, refusal: "limit" })
    }
    expect(await cache.rows("deck")).toEqual(before)
  })

  it("enqueues a value of exactly 8000 bytes", async () => {
    const cache = connect(memoryRemote())
    const exact = "é".repeat(4000)
    expect(new TextEncoder().encode(exact).length).toBe(8000)
    expect(await cache.enqueue("deck", exact, node, "")).toMatchObject({ ok: true })
    expect((await cache.rows("deck")).some((row) => row.value === exact)).toBe(true)
    for (const value of ["x".repeat(8000), `${"€".repeat(2666)}xx`]) {
      expect(new TextEncoder().encode(value).length).toBe(8000)
      expect(await cache.enqueue("deck", value, node, "")).toMatchObject({ ok: true })
      expect((await cache.rows("deck")).some((row) => row.value === value)).toBe(true)
    }
  })

  it("flushes two elements to their own places", async () => {
    const remote = memoryRemote()
    const cache = connect(remote)
    await cache.enqueue("deck", "left", node, "")
    await cache.enqueue("deck", "right", other, "")
    expect((await cache.flush("deck")).ok).toBe(true)
    const opened = await remote.open({ deck: "deck" })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const left = opened.register.elements[elementId("258.7")]
    const right = opened.register.elements[elementId("258.8")]
    expect(left === undefined ? undefined : currentValue(left)).toBe("left")
    expect(right === undefined ? undefined : currentValue(right)).toBe("right")
    expect(currentValue(firstOf(opened.register))).toBe("")
  })

  it("sends the file text as floor on the first edit of each element only", async () => {
    const sent: unknown[] = []
    const remote = memoryRemote()
    const cache = connect({
      open: (body) => remote.open(body),
      watch: (body) => remote.watch(body),
      commit: async (body) => {
        sent.push(body.batch)
        return remote.commit(body)
      },
    })
    await cache.enqueue("deck", "one", node, "left file")
    expect((await cache.flush("deck")).ok).toBe(true)
    await cache.enqueue("deck", "two", node, "left file")
    await cache.enqueue("deck", "three", other, "right file")
    expect((await cache.flush("deck")).ok).toBe(true)
    expect(sent).toEqual([
      [{ value: "one", node, floor: "left file" }],
      [
        { value: "two", node },
        { value: "three", node: other, floor: "right file" },
      ],
    ])
    const opened = await remote.open({ deck: "deck" })
    if (!opened.ok) throw new Error("open")
    expect(opened.register.elements[node]?.floor).toBe("left file")
    expect(opened.register.elements[other]?.floor).toBe("right file")
  })

  it("asks the server to open a deck once when an edit is sent while the first open is in flight", async () => {
    const real = memoryRemote()
    const asked: string[] = []
    let answer: () => void = () => {}
    const answered = new Promise<void>((resolve) => {
      answer = resolve
    })
    const cache = connect({
      open: async (body) => {
        asked.push(body.deck)
        await answered
        return real.open(body)
      },
      watch: (body) => real.watch(body),
      commit: (body) => real.commit(body),
    })
    await cache.enqueue("deck", "typed", node, "")
    const named = cache.open("deck")
    const sent = cache.flush("deck")
    await cache.rows("deck")
    await cache.rows("deck")
    answer()
    expect(await named).toEqual({ ok: true })
    expect(await sent).toMatchObject({ ok: true })
    expect(asked).toEqual(["deck"])
  })

  it("asks again after a refused open", async () => {
    const real = memoryRemote()
    let refuse = true
    let opens = 0
    const cache = connect({
      open: async (body) => {
        opens += 1
        return refuse ? { ok: false, refusal: "session" } : real.open(body)
      },
      watch: (body) => real.watch(body),
      commit: (body) => real.commit(body),
    })
    expect(await cache.open("deck")).toEqual({ ok: false, refusal: "session" })
    refuse = false
    expect(await cache.open("deck")).toEqual({ ok: true })
    expect(await cache.open("deck")).toEqual({ ok: true })
    expect(opens).toBe(2)
  })

  it("opens a new element with the file text it was given", async () => {
    const cache = connect(memoryRemote())
    await cache.enqueue("deck", "typed", node, "from file")
    const opened = await cache.openDeck("deck")
    if (!opened.ok) throw new Error("open")
    expect(opened.register.elements[node]?.floor).toBe("from file")
    expect(opened.pending.map((row) => ({ node: row.node, floor: row.floor, base: row.base }))).toEqual([
      { node, floor: "from file", base: 0 },
    ])
  })

  it("sends each pending row once when two flushes start together", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    await cache.enqueue("deck", "one", node, "")
    await cache.enqueue("deck", "two", other, "")
    const [first, second] = await Promise.all([cache.flush("deck"), connect(remote).flush("deck")])
    expect(first).toMatchObject({ ok: true, revision: 1 })
    expect(second).toEqual({ ok: false, refusal: "batch" })
    expect(commits).toEqual([["one", "two"]])
  })

  it("paints the value just typed on a new element", async () => {
    const cache = connect(memoryRemote())
    expect(await cache.enqueue("deck", "solo", node, "")).toEqual({ ok: true, painted: "solo" })
  })

  it("moves a batch to confirmed rows only after the commit answers", async () => {
    const real = memoryRemote()
    let seenWhileCommitting: string[] = []
    let cache: ReturnType<typeof connect> | undefined
    const remote: Remote = {
      open: (body) => real.open(body),
      watch: (body) => real.watch(body),
      commit: async (body) => {
        seenWhileCommitting = (await cache?.rows("deck"))?.map((row) => row.kind) ?? []
        return real.commit(body)
      },
    }
    cache = connect(remote)
    await cache.enqueue("deck", "only", node, "")
    await cache.flush("deck")
    expect(seenWhileCommitting).toEqual(["pending"])
  })

  it("opens the deck once before its first commit", async () => {
    const { remote, calls } = tracedRemote()
    const cache = connect(remote)
    await cache.enqueue("deck", "first", node, "")
    expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
    await cache.enqueue("deck", "second", node, "")
    expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 2 })
    expect(calls).toEqual(["open deck", "commit deck", "commit deck"])
    expect(await cache.pending("deck")).toEqual([])
  })

  it("opens the deck once across connections to one remote", async () => {
    const { remote, calls } = tracedRemote()
    await connect(remote).enqueue("deck", "first", node, "")
    await connect(remote).flush("deck")
    await connect(remote).enqueue("deck", "second", node, "")
    await connect(remote).flush("deck")
    expect(calls).toEqual(["open deck", "commit deck", "commit deck"])
  })

  it("opens each deck on its own", async () => {
    const { remote, calls } = tracedRemote()
    const cache = connect(remote)
    await cache.enqueue("deck", "first", node, "")
    await cache.flush("deck")
    await cache.enqueue("other", "second", node, "")
    await cache.flush("other")
    expect(calls).toEqual(["open deck", "commit deck", "open other", "commit other"])
  })

  it("opens nothing when no row is pending", async () => {
    const { remote, calls } = tracedRemote()
    expect(await connect(remote).flush("deck")).toEqual({ ok: false, refusal: "batch" })
    expect(calls).toEqual([])
  })

  it("commits nothing and keeps the rows when the open is refused", async () => {
    const { remote, calls } = tracedRemote({ ok: false, refusal: "owner" })
    const cache = connect(remote)
    await cache.enqueue("deck", "kept", node, "")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "owner" })
    expect(calls).toEqual(["open deck"])
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["kept"])
  })

  it("asks again after a refused open", async () => {
    const real = memoryRemote()
    let refuse = true
    const remote: Remote = {
      open: async (body) => (refuse ? { ok: false, refusal: "session" } : real.open(body)),
      watch: (body) => real.watch(body),
      commit: (body) => real.commit(body),
    }
    const cache = connect(remote)
    await cache.enqueue("deck", "kept", node, "")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "session" })
    refuse = false
    expect(await cache.flush("deck")).toMatchObject({ ok: true })
    expect(await cache.pending("deck")).toEqual([])
  })

  it("two enqueues at once keep two rows", async () => {
    const cache = connect(memoryRemote())
    const results = await Promise.all([
      cache.enqueue("deck", "first", node, ""),
      cache.enqueue("deck", "second", other, ""),
    ])
    expect(results.map((result) => result.ok)).toEqual([true, true])
    const pending = await cache.pending("deck")
    expect(pending.map((row) => row.value).sort()).toEqual(["first", "second"])
    expect(new Set(pending.map((row) => row.order)).size).toBe(2)
  })

  it("refuses a row of 65536 bytes", async () => {
    const cache = connect(memoryRemote())
    await cache.enqueue("deck", "ok", node, "")
    const bytes = (value: string) =>
      new TextEncoder().encode(JSON.stringify({ kind: "pending", deck: "deck", order: 1, base: 1, value })).length
    let value = "x".repeat(65536)
    while (bytes(value) > 65536) value = value.slice(0, -1)
    while (bytes(value) < 65536) value += "x"
    expect(bytes(value)).toBe(65536)
    expect(await cache.enqueue("deck", value, node, "")).toEqual({ ok: false, refusal: "limit" })
    expect(await cache.pending("deck")).toEqual([expect.objectContaining({ kind: "pending", order: 0, value: "ok" })])
  })

  it("posts the deck calls and leaves the cache on 401", async () => {
    const seen: { url: string; method: string; credentials: string; type: string; body: unknown }[] = []
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen.push({
        url,
        method: String(init.method),
        credentials: String(init.credentials),
        type: String(new Headers(init.headers).get("content-type")),
        body: JSON.parse(String(init.body)),
      })
      return new Response(JSON.stringify({ ok: false, refusal: "session" }), { status: 401 })
    })
    const remote = httpRemote()
    const cache = connect(remote)
    expect(await remote.open({ deck: "deck" })).toEqual({ ok: false, refusal: "session" })
    expect(await remote.watch({ deck: "deck", cursor: null })).toEqual({ ok: false, refusal: "session" })
    expect(
      await remote.commit({
        deck: "deck",
        batch: [
          { value: "earlier", node, floor: "file" },
          { value: "later", node },
        ],
      }),
    ).toEqual({ ok: false, refusal: "session" })
    await cache.enqueue("deck", "earlier", node, "file")
    await cache.enqueue("deck", "later", node, "file")
    const before = await cache.rows("deck")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "session" })
    expect(await cache.rows("deck")).toEqual(before)
    expect(await cache.phase("deck")).toBe("on-device")
    expect(seen.at(-1)).toEqual({
      url: "/decks/open",
      method: "POST",
      credentials: "same-origin",
      type: "application/json",
      body: { deck: "deck" },
    })
    seen.pop()
    expect(seen).toEqual([
      {
        url: "/decks/open",
        method: "POST",
        credentials: "same-origin",
        type: "application/json",
        body: { deck: "deck" },
      },
      {
        url: "/decks/watch",
        method: "POST",
        credentials: "same-origin",
        type: "application/json",
        body: { deck: "deck", cursor: null },
      },
      {
        url: "/decks/commit",
        method: "POST",
        credentials: "same-origin",
        type: "application/json",
        body: {
          deck: "deck",
          batch: [
            { value: "earlier", node, floor: "file" },
            { value: "later", node },
          ],
        },
      },
    ])
  })

  it("posts Hello! for the clean deck on node a", async () => {
    const seen: { url: string; method: string; credentials: string; body: Record<string, unknown> }[] = []
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen.push({
        url: String(url),
        method: String(init.method),
        credentials: String(init.credentials),
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      })
      if (String(url) === "/decks/open")
        return new Response(JSON.stringify({ ok: true, deck: "clean", revision: 0, register: openRegister("", "") }))
      return new Response(JSON.stringify({ ok: true, deck: "clean", revision: 1, key: "clean:1" }))
    })
    const cache = connect(memoryRemote())
    expect(await cache.enqueue("clean", "Hello!", node, "Hello")).toEqual({ ok: true, painted: "Hello!" })
    expect(await connect(httpRemote()).flush("clean")).toEqual({
      ok: true,
      deck: "clean",
      revision: 1,
      key: "clean:1",
    })
    expect(seen).toEqual([
      { url: "/decks/open", method: "POST", credentials: "same-origin", body: { deck: "clean" } },
      {
        url: "/decks/commit",
        method: "POST",
        credentials: "same-origin",
        body: { deck: "clean", once: expect.any(String), batch: [{ value: "Hello!", node: "258.7", floor: "Hello" }] },
      },
    ])
    expect(Object.keys(seen[1]?.body ?? {}).sort()).toEqual(["batch", "deck", "once"])
    expect(await cache.pending("clean")).toEqual([])
  })

  it("keeps the pending row when the clean commit key does not match", async () => {
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (String(url) === "/decks/open")
        return new Response(JSON.stringify({ ok: true, deck: "clean", revision: 0, register: openRegister("", "") }))
      expect(String(url)).toBe("/decks/commit")
      expect(String(init.method)).toBe("POST")
      expect(String(init.credentials)).toBe("same-origin")
      expect(JSON.parse(String(init.body))).toEqual({
        deck: "clean",
        once: expect.any(String),
        batch: [{ value: "Hello!", node: "258.7", floor: "Hello" }],
      })
      return new Response(JSON.stringify({ ok: true, deck: "clean", revision: 1, key: "clean:9" }))
    })
    const cache = connect(memoryRemote())
    await cache.enqueue("clean", "Hello!", node, "Hello")
    expect(await connect(httpRemote()).flush("clean")).toEqual({ ok: false, refusal: "payload" })
    expect((await cache.pending("clean")).map((row) => ({ value: row.value, node: row.node }))).toEqual([
      { value: "Hello!", node: "258.7" },
    ])
  })

  it("keeps pending rows when the commit key does not match", async () => {
    const remote: Remote = {
      open: async () => ({
        ok: true,
        deck: "deck" as DeckId,
        revision: 0,
        register: openRegister("", "deck" as DeckId),
      }),
      watch: async () => ({ ok: false, refusal: "session" }),
      commit: async () => ({ ok: true, deck: "deck", revision: 1, key: "deck:9" }) as CommitResult,
    }
    const cache = connect(remote)
    await cache.enqueue("deck", "hi", node, "")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "payload" })
    expect(await cache.phase("deck")).toBe("on-device")
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["hi"])
  })

  it("fills confirmed rows from open after the database is deleted", async () => {
    const remote = memoryRemote()
    const cache = connect(remote)
    await remote.open({ deck: "deck" })
    await remote.commit({ deck: "deck", batch: [{ value: "kept", node }] })
    await cache.enqueue("deck", "lost", node, "")
    await deleteDatabase()
    const opened = await cache.openDeck("deck")
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.pending).toEqual([])
    expect(opened.confirmed.map((row) => row.value)).toEqual(["kept"])
    expect(firstOf(opened.register).landed).toEqual([])
    expect(opened.register.elements[node]?.landed.map((row) => row.value)).toEqual(["kept"])
  })

  it("splits a large register into rows under 65536 bytes", async () => {
    const remote = memoryRemote()
    const value = "y".repeat(70_000)
    await remote.open({ deck: "deck" })
    await remote.commit({ deck: "deck", batch: [{ value, node }] })
    await deleteDatabase()
    const opened = await connect(remote).openDeck("deck")
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.confirmed.length).toBeGreaterThan(1)
    for (const row of opened.confirmed) {
      expect(new TextEncoder().encode(JSON.stringify(row)).length).toBeLessThan(65536)
    }
    expect(opened.register.elements[node]?.landed.map((row) => row.value)).toEqual([value])
  })

  it("keeps the register when the owner refuses", async () => {
    const cache = connect(ownerRemote())
    expect(await cache.enqueue("deck", "kept", node, "")).toEqual({ ok: true, painted: "kept" })
    const before = await cache.rows("deck")
    const opened = await cache.openDeck("deck")
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.register.elements[node]?.landed.map((row) => row.value)).toEqual(["kept"])
    expect(await cache.rows("deck")).toEqual(before)
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "owner" })
    expect(await cache.rows("deck")).toEqual(before)
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["kept"])
  })

  it("refuses a commit answered 200 with a null JSON body as payload and keeps the row", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("null", { status: 200, headers: { "content-type": "application/json" } }),
    )
    const cache = connect(memoryRemote())
    await cache.enqueue("clean", "Hello!", node, "Hello")
    expect(await connect(httpRemote()).flush("clean")).toEqual({ ok: false, refusal: "payload" })
    expect((await cache.pending("clean")).map((row) => row.value)).toEqual(["Hello!"])
  })

  it("refuses a commit answered 200 with a JSON array body as payload and keeps the row", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
    )
    const cache = connect(memoryRemote())
    await cache.enqueue("clean", "Hello!", node, "Hello")
    expect(await connect(httpRemote()).flush("clean")).toEqual({ ok: false, refusal: "payload" })
    expect((await cache.pending("clean")).map((row) => row.value)).toEqual(["Hello!"])
  })

  it("reads a commit answered 500 with a null JSON body as no answer and keeps the row", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("null", { status: 500, headers: { "content-type": "application/json" } }),
    )
    const cache = connect(memoryRemote())
    await cache.enqueue("clean", "Hello!", node, "Hello")
    await expect(connect(httpRemote()).flush("clean")).rejects.toBeInstanceOf(TypeError)
    expect((await cache.pending("clean")).map((row) => row.value)).toEqual(["Hello!"])
  })

  it("opens a deck once for an open and a later flush", async () => {
    const real = memoryRemote()
    const opens: string[] = []
    const remote: Remote = {
      open: (body) => {
        opens.push(body.deck)
        return real.open(body)
      },
      watch: (body) => real.watch(body),
      commit: (body) => real.commit(body),
    }
    const cache = connect(remote)
    expect(await cache.open("once-deck")).toEqual({ ok: true })
    await cache.enqueue("once-deck", "Hello!", elementId("258.7"), "")
    expect((await cache.flush("once-deck")).ok).toBe(true)
    expect(opens).toEqual(["once-deck"])
  })
})

function firstOf(register: Register): NodeRegister {
  const body = register.elements[rootElement]
  if (body === undefined) throw new Error("missing node")
  return body
}
