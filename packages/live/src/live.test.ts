import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  connect,
  deleteDatabase,
  getPart,
  httpRemote,
  memoryRemote,
  putPart,
  type CommitResult,
  type Remote,
} from "./index.js"

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
    await cache.enqueue("deck", "earlier")
    await cache.enqueue("deck", "later")
    await cache.flush("deck")
    expect(commits).toEqual([["earlier", "later"]])
  })

  it("refuses an actor and stores nothing", async () => {
    const remote = memoryRemote()
    const body = { deck: "deck", actor: "agent", batch: [{ value: "hi" }] }
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
    expect(await remote.commit({ deck: "deck", batch: [{ value: "a" }, { value: "b" }] })).toEqual({
      ok: true,
      deck: "deck",
      revision: 1,
      key: "deck:1",
    })
    expect(await remote.commit({ deck: "deck", batch: [{ value: "c" }] })).toEqual({
      ok: true,
      deck: "deck",
      revision: 2,
      key: "deck:2",
    })
  })

  it("returns the stored revision when the cursor is behind", async () => {
    const remote = memoryRemote()
    await remote.commit({ deck: "deck", batch: [{ value: "one" }] })
    await remote.commit({ deck: "deck", batch: [{ value: "two" }] })
    expect(await remote.watch({ deck: "deck", cursor: 0 })).toEqual({ ok: true, deck: "deck", revision: 2 })
  })

  it("stays on device until flush", async () => {
    const cache = connect(memoryRemote())
    expect(await cache.phase("deck")).toBe("confirmed")
    await cache.enqueue("deck", "text")
    expect(await cache.phase("deck")).toBe("on-device")
    await cache.flush("deck")
    expect(await cache.phase("deck")).toBe("confirmed")
    expect(await cache.pending("deck")).toEqual([])
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
    await cache.enqueue("deck", "earlier")
    await cache.enqueue("deck", "later")
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
        body: { deck: "deck", batch: [{ value: "earlier" }, { value: "later" }] },
      },
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
    await cache.enqueue("deck", "hi")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "payload" })
    expect(await cache.phase("deck")).toBe("on-device")
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["hi"])
  })

  it("fills confirmed rows from open after the database is deleted", async () => {
    const remote = memoryRemote()
    const cache = connect(remote)
    await remote.open({ deck: "deck" })
    await remote.commit({ deck: "deck", batch: [{ value: "kept" }] })
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
    await remote.commit({ deck: "deck", batch: [{ value }] })
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
})
