import { currentValue, elementId } from "@airdesign/document"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  connect,
  deleteDatabase,
  getPart,
  getParts,
  httpRemote,
  memoryRemote,
  ownerRemote,
  putPart,
  putParts,
  type CommitResult,
  type Remote,
} from "./index.js"

const node = elementId("258.7")

function installIndexedDb(): void {
  const databases = new Map<string, { names: string[]; rows: Map<string, Map<string, unknown>> }>()

  function contains(key: string, range: { lower: string; upper: string; lowerOpen?: boolean; upperOpen?: boolean }) {
    if (range.lowerOpen ? key <= range.lower : key < range.lower) return false
    if (range.upperOpen ? key >= range.upper : key > range.upper) return false
    return true
  }

  function finish(transaction: { requests: { onsuccess: (() => void) | null }[]; oncomplete: (() => void) | null }) {
    queueMicrotask(() => {
      for (const request of transaction.requests) request.onsuccess?.()
      transaction.oncomplete?.()
    })
  }

  type Opened = {
    objectStoreNames: { contains: (store: string) => boolean }
    createObjectStore: (store: string) => void
    transaction: (store: string, mode: string) => unknown
    close: () => void
  }

  const indexed = {
    open(name: string) {
      const request: {
        result: Opened | undefined
        onupgradeneeded: (() => void) | null
        onsuccess: (() => void) | null
        onerror: (() => void) | null
      } = {
        result: undefined,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      }
      queueMicrotask(() => {
        let database = databases.get(name)
        const created = database === undefined
        if (database === undefined) {
          database = { names: [], rows: new Map() }
          databases.set(name, database)
        }
        const current = database
        request.result = {
          objectStoreNames: { contains: (store: string) => current.names.includes(store) },
          createObjectStore: (store: string) => {
            current.names.push(store)
            current.rows.set(store, new Map())
          },
          transaction: (store: string) => {
            const rows = current.rows.get(store) ?? new Map()
            const transaction = {
              requests: [] as { onsuccess: (() => void) | null }[],
              oncomplete: null as (() => void) | null,
              onerror: null as (() => void) | null,
              onabort: null as (() => void) | null,
              objectStore: () => ({
                getAll: (range: { lower: string; upper: string; lowerOpen?: boolean; upperOpen?: boolean }) => {
                  const result = [...rows.keys()]
                    .filter((key) => contains(key, range))
                    .sort()
                    .map((key) => rows.get(key))
                  const pending = {
                    result,
                    onsuccess: null as (() => void) | null,
                    onerror: null as (() => void) | null,
                  }
                  transaction.requests.push(pending)
                  return pending
                },
                put: (value: unknown, key: string) => {
                  rows.set(key, value)
                  const pending = {
                    result: key,
                    onsuccess: null as (() => void) | null,
                    onerror: null as (() => void) | null,
                  }
                  transaction.requests.push(pending)
                  return pending
                },
                delete: (key: string) => {
                  rows.delete(key)
                  const pending = {
                    result: undefined,
                    onsuccess: null as (() => void) | null,
                    onerror: null as (() => void) | null,
                  }
                  transaction.requests.push(pending)
                  return pending
                },
              }),
            }
            finish(transaction)
            return transaction
          },
          close: () => undefined,
        }
        if (created) request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    },
    deleteDatabase(name: string) {
      const request = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null }
      queueMicrotask(() => {
        databases.delete(name)
        request.onsuccess?.()
      })
      return request
    },
  }

  Object.assign(globalThis, {
    indexedDB: indexed,
    IDBKeyRange: {
      bound: (lower: string, upper: string, lowerOpen = false, upperOpen = false) => ({
        lower,
        upper,
        lowerOpen,
        upperOpen,
      }),
    },
  })
}

function installParts(): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>()
  const storage = {
    async getDirectory() {
      return {
        async getFileHandle(name: string, options?: { create?: boolean }) {
          if (!files.has(name)) {
            if (!options?.create) throw new Error("missing")
            files.set(name, new Uint8Array())
          }
          return {
            async createWritable() {
              const chunks: Uint8Array[] = []
              return {
                async write(data: Uint8Array) {
                  chunks.push(data.slice())
                },
                async close() {
                  const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
                  const bytes = new Uint8Array(size)
                  let offset = 0
                  for (const chunk of chunks) {
                    bytes.set(chunk, offset)
                    offset += chunk.byteLength
                  }
                  files.set(name, bytes)
                },
              }
            },
            async getFile() {
              const bytes = files.get(name) ?? new Uint8Array()
              return {
                async arrayBuffer() {
                  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
                },
              }
            },
          }
        },
      }
    },
  }
  Object.defineProperty(globalThis, "navigator", { value: { storage }, configurable: true })
  return files
}

function countingRemote(): { remote: Remote; commits: string[][] } {
  const remote = memoryRemote()
  const commits: string[][] = []
  return {
    commits,
    remote: {
      open: (body) => remote.open(body),
      watch: (body) => remote.watch(body),
      commit: async (body) => {
        commits.push(body.batch.map((edit) => edit.value))
        return remote.commit(body)
      },
    },
  }
}

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
    expect(await cache.enqueue("deck", "next")).toEqual({ ok: true, painted: "next" })
    expect(commits).toEqual([])
  })

  it("drops a refused edit", async () => {
    const cache = connect(memoryRemote())
    expect(await cache.enqueue("deck", "nope", "b")).toEqual({ ok: false, refusal: "dead" })
    expect(await cache.pending("deck")).toEqual([])
  })

  it("flushes the earlier edit before the later one", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    await cache.enqueue("deck", "earlier", "258.7")
    await cache.enqueue("deck", "later", "258.7")
    await cache.flush("deck")
    expect(commits).toEqual([["earlier", "later"]])
  })

  it("refuses an actor and stores nothing", async () => {
    const remote = memoryRemote()
    const body = { deck: "deck", actor: "agent", batch: [{ value: "hi", node }] }
    expect(await remote.commit(body)).toEqual({
      ok: false,
      refusal: "field",
    })
    const opened = await remote.open({ deck: "deck" })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.revision).toBe(0)
    expect(opened.register.landed).toEqual([])
  })

  it("raises revision by one commit", async () => {
    const remote = memoryRemote()
    expect(await remote.open({ deck: "deck" })).toMatchObject({ ok: true, revision: 0 })
    expect(
      await remote.commit({
        deck: "deck",
        batch: [
          { value: "a", node, floor: "sent" },
          { value: "b", node },
        ],
      }),
    ).toEqual({
      ok: true,
      deck: "deck",
      revision: 1,
      key: "deck:1",
    })
    const opened = await remote.open({ deck: "deck" })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.register.elements[node]?.floor).toBe("sent")
    expect(await remote.commit({ deck: "deck", batch: [{ value: "c", node }] })).toEqual({
      ok: true,
      deck: "deck",
      revision: 2,
      key: "deck:2",
    })
  })

  it("returns the stored revision when the cursor is behind", async () => {
    const remote = memoryRemote()
    await remote.commit({ deck: "deck", batch: [{ value: "one", node }] })
    await remote.commit({ deck: "deck", batch: [{ value: "two", node }] })
    expect(await remote.watch({ deck: "deck", cursor: 0 })).toEqual({ ok: true, deck: "deck", revision: 2 })
  })

  it("stays on device until flush", async () => {
    const cache = connect(memoryRemote())
    expect(await cache.phase("deck")).toBe("confirmed")
    await cache.enqueue("deck", "text", "258.7")
    expect(await cache.phase("deck")).toBe("on-device")
    await cache.flush("deck")
    expect(await cache.phase("deck")).toBe("confirmed")
    expect(await cache.pending("deck")).toEqual([])
  })

  it("refuses to flush a row that has no node and keeps it pending", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    await cache.enqueue("deck", "text")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "field" })
    expect(commits).toEqual([])
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["text"])
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "field" })
    expect(await cache.phase("deck")).toBe("on-device")
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["text"])
  })

  it("refuses a flush that mixes a row with no node and sends nothing", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    await cache.enqueue("ahead", "named", "258.7")
    await cache.enqueue("ahead", "orphan")
    const ahead = await cache.pending("ahead")
    expect(await cache.flush("ahead")).toEqual({ ok: false, refusal: "field" })
    expect(commits).toEqual([])
    expect(await cache.pending("ahead")).toEqual(ahead)
    await cache.enqueue("behind", "orphan")
    await cache.enqueue("behind", "named", "258.7")
    const behind = await cache.pending("behind")
    expect(await cache.flush("behind")).toEqual({ ok: false, refusal: "field" })
    expect(commits).toEqual([])
    expect(await cache.pending("behind")).toEqual(behind)
  })

  it("refuses to enqueue a malformed element id and writes no row", async () => {
    const cache = connect(memoryRemote())
    const before = await cache.rows("deck")
    expect(await cache.enqueue("deck", "nope", "258.")).toEqual({ ok: false, refusal: "dead" })
    expect(await cache.rows("deck")).toEqual(before)
  })

  it("refuses to enqueue a value over 8000 bytes and writes no row", async () => {
    const cache = connect(memoryRemote())
    const over = "é".repeat(4001)
    expect(new TextEncoder().encode(over).length).toBe(8002)
    const before = await cache.rows("deck")
    expect(await cache.enqueue("deck", over, "258.7")).toEqual({ ok: false, refusal: "limit" })
    expect(await cache.rows("deck")).toEqual(before)
    for (const value of ["x".repeat(8001), "€".repeat(2667)]) {
      expect(new TextEncoder().encode(value).length).toBe(8001)
      expect(await cache.enqueue("deck", value, "258.7")).toEqual({ ok: false, refusal: "limit" })
    }
    expect(await cache.rows("deck")).toEqual(before)
  })

  it("enqueues a value of exactly 8000 bytes", async () => {
    const cache = connect(memoryRemote())
    const exact = "é".repeat(4000)
    expect(new TextEncoder().encode(exact).length).toBe(8000)
    expect(await cache.enqueue("deck", exact, "258.7")).toMatchObject({ ok: true })
    expect((await cache.rows("deck")).some((row) => row.value === exact)).toBe(true)
    for (const value of ["x".repeat(8000), `${"€".repeat(2666)}xx`]) {
      expect(new TextEncoder().encode(value).length).toBe(8000)
      expect(await cache.enqueue("deck", value, "258.7")).toMatchObject({ ok: true })
      expect((await cache.rows("deck")).some((row) => row.value === value)).toBe(true)
    }
  })

  it("flushes two elements to their own places", async () => {
    const remote = memoryRemote()
    const cache = connect(remote)
    await cache.enqueue("deck", "left", "258.7")
    await cache.enqueue("deck", "right", "258.8")
    expect((await cache.flush("deck")).ok).toBe(true)
    const opened = await remote.open({ deck: "deck" })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const left = opened.register.elements[elementId("258.7")]
    const right = opened.register.elements[elementId("258.8")]
    expect(left === undefined ? undefined : currentValue(left)).toBe("left")
    expect(right === undefined ? undefined : currentValue(right)).toBe("right")
    expect(currentValue(opened.register)).toBe("")
  })

  it.fails("shows an edit on its own element after the cache is opened again", async () => {
    const remote = memoryRemote()
    const cache = connect(remote)
    await cache.enqueue("deck", "solo", "258.7")
    expect((await cache.flush("deck")).ok).toBe(true)
    await deleteDatabase()
    const opened = await connect(remote).openDeck("deck")
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const body = opened.register.elements[elementId("258.7")]
    expect(body === undefined ? undefined : currentValue(body)).toBe("solo")
    expect(currentValue(opened.register)).not.toBe("solo")
  })

  it.fails("paints the value just typed on a new element", async () => {
    const cache = connect(memoryRemote())
    expect(await cache.enqueue("deck", "solo", "258.7")).toEqual({ ok: true, painted: "solo" })
  })

  it("refuses a row of 65536 bytes", async () => {
    const cache = connect(memoryRemote())
    await cache.enqueue("deck", "ok")
    const bytes = (value: string) =>
      new TextEncoder().encode(JSON.stringify({ kind: "pending", deck: "deck", order: 1, base: 1, value })).length
    let value = "x".repeat(65536)
    while (bytes(value) > 65536) value = value.slice(0, -1)
    while (bytes(value) < 65536) value += "x"
    expect(bytes(value)).toBe(65536)
    expect(await cache.enqueue("deck", value)).toEqual({ ok: false, refusal: "limit" })
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
    await cache.enqueue("deck", "earlier", "258.7")
    await cache.enqueue("deck", "later", "258.7")
    const before = await cache.rows("deck")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "session" })
    expect(await cache.rows("deck")).toEqual(before)
    expect(await cache.phase("deck")).toBe("on-device")
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
            { value: "earlier", node },
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
      return new Response(JSON.stringify({ ok: true, deck: "clean", revision: 1, key: "clean:1" }))
    })
    const cache = connect(memoryRemote())
    expect(await cache.enqueue("clean", "Hello!", "258.7")).toMatchObject({ ok: true })
    expect(await connect(httpRemote()).flush("clean")).toEqual({
      ok: true,
      deck: "clean",
      revision: 1,
      key: "clean:1",
    })
    expect(seen).toEqual([
      {
        url: "/decks/commit",
        method: "POST",
        credentials: "same-origin",
        body: { deck: "clean", batch: [{ value: "Hello!", node: "258.7" }] },
      },
    ])
    expect(Object.keys(seen[0]?.body ?? {}).sort()).toEqual(["batch", "deck"])
    expect(await cache.pending("clean")).toEqual([])
  })

  it("keeps the pending row when the clean commit key does not match", async () => {
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      expect(String(url)).toBe("/decks/commit")
      expect(String(init.method)).toBe("POST")
      expect(String(init.credentials)).toBe("same-origin")
      expect(JSON.parse(String(init.body))).toEqual({ deck: "clean", batch: [{ value: "Hello!", node: "258.7" }] })
      return new Response(JSON.stringify({ ok: true, deck: "clean", revision: 1, key: "clean:9" }))
    })
    const cache = connect(memoryRemote())
    await cache.enqueue("clean", "Hello!", "258.7")
    expect(await connect(httpRemote()).flush("clean")).toEqual({ ok: false, refusal: "payload" })
    expect((await cache.pending("clean")).map((row) => ({ value: row.value, node: row.node }))).toEqual([
      { value: "Hello!", node: "258.7" },
    ])
  })

  it("does not create a row when open or watch is refused", async () => {
    const remote = memoryRemote()
    expect(await remote.open({ deck: "bad id" })).toEqual({ ok: false, refusal: "deck" })
    const extra = { deck: "deck", extra: true }
    expect(await remote.open(extra)).toEqual({ ok: false, refusal: "field" })
    expect(await remote.watch({ deck: "deck", cursor: -1 })).toEqual({ ok: false, refusal: "cursor" })
    let settled = false
    const waiting = remote.watch({ deck: "deck", cursor: null }).then((result) => {
      settled = true
      return result
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(settled).toBe(false)
    expect(await remote.open({ deck: "deck" })).toMatchObject({ ok: true, revision: 0 })
    expect(await waiting).toEqual({ ok: true, deck: "deck", revision: 0 })
  })

  it("keeps pending rows when the commit key does not match", async () => {
    const remote: Remote = {
      open: async () => ({ ok: false, refusal: "session" }),
      watch: async () => ({ ok: false, refusal: "session" }),
      commit: async () => ({ ok: true, deck: "deck", revision: 1, key: "deck:9" }) as CommitResult,
    }
    const cache = connect(remote)
    await cache.enqueue("deck", "hi", "258.7")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "payload" })
    expect(await cache.phase("deck")).toBe("on-device")
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["hi"])
  })

  it("fills confirmed rows from open after the database is deleted", async () => {
    const remote = memoryRemote()
    const cache = connect(remote)
    await remote.open({ deck: "deck" })
    await remote.commit({ deck: "deck", batch: [{ value: "kept", node }] })
    await cache.enqueue("deck", "lost")
    await deleteDatabase()
    const opened = await cache.openDeck("deck")
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.pending).toEqual([])
    expect(opened.confirmed.map((row) => row.value)).toEqual(["kept"])
    expect(opened.register.landed.map((row) => row.value)).toEqual(["kept"])
  })

  it("splits a large register into rows under 65536 bytes", async () => {
    const remote = memoryRemote()
    const value = "y".repeat(70_000)
    await remote.commit({ deck: "deck", batch: [{ value, node }] })
    await deleteDatabase()
    const opened = await connect(remote).openDeck("deck")
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.confirmed.length).toBeGreaterThan(1)
    for (const row of opened.confirmed) {
      expect(new TextEncoder().encode(JSON.stringify(row)).length).toBeLessThan(65536)
    }
    expect(opened.register.landed.map((row) => row.value)).toEqual([value])
  })

  it("stores one part for the same bytes", async () => {
    const files = installParts()
    const bytes = new Uint8Array([1, 2, 3, 4])
    const first = await putPart(bytes)
    const second = await putPart(bytes)
    expect(second).toBe(first)
    expect(files.size).toBe(1)
    expect(Array.from(await getPart(first))).toEqual([1, 2, 3, 4])
  })

  it("keeps the register when the owner refuses", async () => {
    const cache = connect(ownerRemote())
    expect(await cache.enqueue("deck", "kept", "a")).toEqual({ ok: true, painted: "kept" })
    const before = await cache.rows("deck")
    const opened = await cache.openDeck("deck")
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.register.landed.map((row) => row.value)).toEqual(["kept"])
    expect(await cache.rows("deck")).toEqual(before)
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "owner" })
    expect(await cache.rows("deck")).toEqual(before)
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["kept"])
  })

  it("stores a deck's parts beside node a", async () => {
    installParts()
    const bytes = new Uint8Array([9, 8, 7])
    const nodes = { a: { part: "ppt/slides/slide1.xml", shape: "2" } }
    const saved = await putParts("clean", { parts: new Map([[nodes.a.part, bytes]]), nodes })
    expect(saved.ok).toBe(true)
    const read = await getParts("clean")
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.nodes).toEqual(nodes)
    expect(Array.from(read.parts.get(nodes.a.part) ?? [])).toEqual([9, 8, 7])
  })

  it("refuses a part list of 65536 bytes", async () => {
    installParts()
    const nodes = { a: { part: "ppt/slides/slide1.xml", shape: "2" } }
    const saved = await putParts("clean", { parts: new Map([["n".repeat(70_000), new Uint8Array([1])]]), nodes })
    expect(saved).toEqual({ ok: false, refusal: "limit" })
    expect(await getParts("clean")).toEqual({ ok: false, refusal: "absent" })
  })

  it("reads the same part names and hashes back after a new connect", async () => {
    const files = installParts()
    const shared = new Uint8Array([9, 8, 7])
    const other = new Uint8Array([1, 2])
    const slide = "ppt/slides/slide1.xml"
    const copy = "ppt/slides/slide2.xml"
    const notes = "ppt/notesSlides/notesSlide1.xml"
    const nodes = { a: { part: slide, shape: "2" } }
    const saved = await putParts("clean", {
      parts: new Map<string, Uint8Array>([
        [slide, shared],
        [copy, shared],
        [notes, other],
      ]),
      nodes,
    })
    expect(saved.ok).toBe(true)
    const sha256 = async (bytes: Uint8Array) => {
      const payload = new Uint8Array(new ArrayBuffer(bytes.byteLength))
      payload.set(bytes)
      const digest = await crypto.subtle.digest("SHA-256", payload)
      let text = ""
      for (const byte of new Uint8Array(digest)) text += byte.toString(16).padStart(2, "0")
      return text
    }
    const sharedHash = await sha256(shared)
    const otherHash = await sha256(other)
    expect([...files.keys()].sort()).toEqual([sharedHash, otherHash].sort())
    for (const [hash, bytes] of files) expect(hash).toBe(await sha256(bytes))
    const stored = [...files.keys()].sort()
    const written = new Map(files)
    const cache = connect(memoryRemote())
    const opened = await cache.openDeck("clean")
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.pending).toEqual([])
    expect(opened.confirmed).toEqual([])
    expect(await cache.rows("clean")).toEqual([])
    const read = await getParts("clean")
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect([...read.parts.keys()]).toEqual([slide, copy, notes])
    expect(Array.from(read.parts.get(slide) ?? [])).toEqual([9, 8, 7])
    expect(Array.from(read.parts.get(copy) ?? [])).toEqual([9, 8, 7])
    expect(Array.from(read.parts.get(notes) ?? [])).toEqual([1, 2])
    expect(read.nodes).toEqual(nodes)
    expect(files.size).toBe(2)
    expect([...files.keys()].sort()).toEqual(stored)
    for (const [hash, bytes] of written) expect(files.get(hash)).toBe(bytes)
  })

  it("keeps each deck's parts apart after a new connect", async () => {
    installParts()
    const slide = "ppt/slides/slide1.xml"
    const notes = "ppt/notesSlides/notesSlide1.xml"
    const layout = "ppt/slideLayouts/slideLayout1.xml"
    const cleanNodes = { a: { part: slide, shape: "2" } }
    const otherNodes = { a: { part: slide, shape: "5" } }
    const clean = await putParts("clean", {
      parts: new Map<string, Uint8Array>([
        [slide, new Uint8Array([9, 8, 7])],
        [layout, new Uint8Array([3])],
      ]),
      nodes: cleanNodes,
    })
    const other = await putParts("other", {
      parts: new Map<string, Uint8Array>([
        [slide, new Uint8Array([4, 5])],
        [notes, new Uint8Array([6])],
      ]),
      nodes: otherNodes,
    })
    expect(clean.ok).toBe(true)
    expect(other.ok).toBe(true)
    const cache = connect(memoryRemote())
    expect((await cache.openDeck("clean")).ok).toBe(true)
    expect((await cache.openDeck("other")).ok).toBe(true)
    const readClean = await getParts("clean")
    const readOther = await getParts("other")
    expect(readClean.ok).toBe(true)
    expect(readOther.ok).toBe(true)
    if (!readClean.ok || !readOther.ok) return
    expect([...readClean.parts.keys()]).toEqual([slide, layout])
    expect(Array.from(readClean.parts.get(slide) ?? [])).toEqual([9, 8, 7])
    expect(Array.from(readClean.parts.get(layout) ?? [])).toEqual([3])
    expect(readClean.nodes).toEqual(cleanNodes)
    expect([...readOther.parts.keys()]).toEqual([slide, notes])
    expect(Array.from(readOther.parts.get(slide) ?? [])).toEqual([4, 5])
    expect(Array.from(readOther.parts.get(notes) ?? [])).toEqual([6])
    expect(readOther.nodes).toEqual(otherNodes)
  })

  it("answers absent for parts after the database is deleted", async () => {
    installParts()
    const nodes = { a: { part: "ppt/slides/slide1.xml", shape: "2" } }
    const saved = await putParts("clean", { parts: new Map([[nodes.a.part, new Uint8Array([9, 8, 7])]]), nodes })
    expect(saved.ok).toBe(true)
    await deleteDatabase()
    expect(await getParts("clean")).toEqual({ ok: false, refusal: "absent" })
  })
})
