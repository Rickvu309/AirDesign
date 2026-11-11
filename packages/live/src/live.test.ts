import type { DeckId } from "@airdesign/catalog"
import { currentValue, elementId, legacyElement, openRegister, rootElement } from "@airdesign/document"
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
  type OpenResult,
  type Remote,
} from "./index.js"
import { readRows, rowKey, writeRows, writeSlot } from "./store.js"

const node = elementId("258.7")
const other = elementId("258.8")

function installIndexedDb(): void {
  type Running = { mode: string; started: boolean; start: () => void }
  type Fake = {
    names: string[]
    rows: Map<string, Map<string, unknown>>
    live: Running[]
    settle: (transaction: Running) => void
  }
  const databases = new Map<string, Fake>()

  function contains(key: string, range: { lower: string; upper: string; lowerOpen?: boolean; upperOpen?: boolean }) {
    if (range.lowerOpen ? key <= range.lower : key < range.lower) return false
    if (range.upperOpen ? key >= range.upper : key > range.upper) return false
    return true
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
          const created: Fake = {
            names: [],
            rows: new Map(),
            live: [],
            settle: (transaction) => {
              if (transaction.started) return
              const earlier = created.live.slice(0, created.live.indexOf(transaction))
              const blocked = earlier.some((other) => other.mode === "readwrite" || transaction.mode === "readwrite")
              if (!blocked) transaction.start()
            },
          }
          database = created
          databases.set(name, database)
        }
        const current = database
        request.result = {
          objectStoreNames: { contains: (store: string) => current.names.includes(store) },
          createObjectStore: (store: string) => {
            current.names.push(store)
            current.rows.set(store, new Map())
          },
          transaction: (store: string, mode: string) => {
            const rows = current.rows.get(store) ?? new Map()
            type Operation = { request: { result: unknown; onsuccess: (() => void) | null }; run: () => unknown }
            const queue: Operation[] = []
            const transaction = {
              mode,
              started: false,
              oncomplete: null as (() => void) | null,
              onerror: null as (() => void) | null,
              onabort: null as (() => void) | null,
              objectStore: () => {
                const enqueue = (run: () => unknown) => {
                  const request = {
                    result: undefined as unknown,
                    onsuccess: null as (() => void) | null,
                    onerror: null as (() => void) | null,
                  }
                  queue.push({ request, run })
                  return request
                }
                return {
                  getAll: (range: { lower: string; upper: string; lowerOpen?: boolean; upperOpen?: boolean }) =>
                    enqueue(() =>
                      [...rows.keys()]
                        .filter((key) => contains(key, range))
                        .sort()
                        .map((key) => rows.get(key)),
                    ),
                  put: (value: unknown, key: string) =>
                    enqueue(() => {
                      rows.set(key, value)
                      return key
                    }),
                  delete: (key: string) =>
                    enqueue(() => {
                      rows.delete(key)
                      return undefined
                    }),
                }
              },
              start: () => {
                transaction.started = true
                const pump = () => {
                  const next = queue.shift()
                  if (next === undefined) {
                    current.live.splice(current.live.indexOf(transaction), 1)
                    transaction.oncomplete?.()
                    for (const waiting of [...current.live]) current.settle(waiting)
                    return
                  }
                  next.request.result = next.run()
                  next.request.onsuccess?.()
                  queueMicrotask(pump)
                }
                queueMicrotask(pump)
              },
            }
            current.live.push(transaction)
            current.settle(transaction)
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
    await cache.enqueue("deck", "later", node, "")
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
    await remote.open({ deck: "deck" })
    await remote.commit({ deck: "deck", batch: [{ value: "one", node }] })
    await remote.commit({ deck: "deck", batch: [{ value: "two", node }] })
    expect(await remote.watch({ deck: "deck", cursor: 0 })).toEqual({ ok: true, deck: "deck", revision: 2 })
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

  it("drops a stored row that has no node and flushes the row after it", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    await writeRows(
      [
        {
          key: rowKey("deck", "pending", 0),
          row: { kind: "pending", deck: "deck" as DeckId, order: 0, base: 0, value: "orphan" },
        },
      ],
      [],
    )
    expect(await cache.enqueue("deck", "named", node, "file")).toEqual({ ok: true, painted: "named" })
    expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
    expect(commits).toEqual([["named"]])
    expect(await cache.pending("deck")).toEqual([])
    expect((await cache.rows("deck")).map((row) => row.value)).toEqual(["named"])
  })

  it("drops a stored row on the old node a and flushes the row before it", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    expect(await cache.enqueue("deck", "named", node, "file")).toEqual({ ok: true, painted: "named" })
    await writeRows(
      [
        {
          key: rowKey("deck", "pending", 1),
          row: { kind: "pending", deck: "deck" as DeckId, order: 1, base: 1, value: "legacy", node: rootElement },
        },
      ],
      [],
    )
    expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
    expect(commits).toEqual([["named"]])
    expect(await cache.rows("deck")).toEqual([expect.objectContaining({ kind: "confirmed", value: "named", node })])
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "batch" })
  })

  it("drops a stored confirmed row with a malformed node and keeps the legacy node row", async () => {
    const cache = connect(memoryRemote())
    await writeRows(
      [
        {
          key: rowKey("deck", "confirmed", 1),
          row: { kind: "confirmed", deck: "deck" as DeckId, revision: 1, value: "kept", node: legacyElement },
        },
        {
          key: rowKey("deck", "confirmed", 2),
          row: { kind: "confirmed", deck: "deck" as DeckId, revision: 2, value: "bad", node: "toString" as never },
        },
      ],
      [],
    )
    expect((await cache.rows("deck")).map((row) => row.value)).toEqual(["kept"])
    expect((await readRows("deck")).map((row) => row.value)).toEqual(["kept"])
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
    expect(currentValue(opened.register)).toBe("")
  })

  it("shows an edit on its own element after the cache is opened again", async () => {
    const remote = memoryRemote()
    const cache = connect(remote)
    await cache.enqueue("deck", "solo", node, "")
    expect((await cache.flush("deck")).ok).toBe(true)
    await deleteDatabase()
    const opened = await connect(remote).openDeck("deck")
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const body = opened.register.elements[elementId("258.7")]
    expect(body === undefined ? undefined : currentValue(body)).toBe("solo")
    expect(currentValue(opened.register)).not.toBe("solo")
  })

  it("replays an offline queue that interleaves two elements", async () => {
    const remote = memoryRemote()
    const cache = connect(remote)
    await cache.enqueue("deck", "left one", node, "left file")
    await cache.enqueue("deck", "right one", other, "right file")
    await cache.enqueue("deck", "left two", node, "left file")
    expect(await cache.enqueue("deck", "right two", other, "right file")).toEqual({ ok: true, painted: "right two" })
    const shown = async () => {
      const opened = await connect(remote).openDeck("deck")
      if (!opened.ok) return opened
      const left = opened.register.elements[node]
      const right = opened.register.elements[other]
      return {
        left: left === undefined ? undefined : currentValue(left),
        right: right === undefined ? undefined : currentValue(right),
        root: opened.register.landed.length,
      }
    }
    expect(await shown()).toEqual({ left: "left two", right: "right two", root: 0 })
    expect((await cache.flush("deck")).ok).toBe(true)
    expect(await shown()).toEqual({ left: "left two", right: "right two", root: 0 })
    await deleteDatabase()
    expect(await shown()).toEqual({ left: "left two", right: "right two", root: 0 })
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

  it("sends 101 pending edits in batches of at most 100", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    for (let index = 0; index < 101; index += 1) await cache.enqueue("deck", `v${index}`, node, "")
    expect(await cache.flush("deck")).toMatchObject({ ok: true })
    expect(commits.map((batch) => batch.length)).toEqual([100, 1])
    expect(commits.flat()).toEqual(Array.from({ length: 101 }, (_, index) => `v${index}`))
    expect(await cache.pending("deck")).toEqual([])
    expect((await cache.rows("deck")).filter((row) => row.kind === "confirmed")).toHaveLength(101)
  })

  it("sends exactly 100 pending edits in one batch", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    for (let index = 0; index < 100; index += 1) await cache.enqueue("deck", `v${index}`, node, "")
    expect(await cache.flush("deck")).toMatchObject({ ok: true })
    expect(commits.map((batch) => batch.length)).toEqual([100])
    expect(await cache.pending("deck")).toEqual([])
  })

  it("keeps the last row pending when the second batch is refused", async () => {
    const real = memoryRemote()
    const sizes: number[] = []
    let refuse = true
    const remote: Remote = {
      open: (body) => real.open(body),
      watch: (body) => real.watch(body),
      commit: async (body) => {
        sizes.push(body.batch.length)
        if (sizes.length === 2 && refuse) return { ok: false, refusal: "session" }
        return real.commit(body)
      },
    }
    const cache = connect(remote)
    for (let index = 0; index < 101; index += 1) await cache.enqueue("deck", `v${index}`, node, "")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "session" })
    expect(sizes).toEqual([100, 1])
    const kept = await cache.rows("deck")
    expect(kept.filter((row) => row.kind === "confirmed")).toHaveLength(100)
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["v100"])
    refuse = false
    expect(await cache.flush("deck")).toMatchObject({ ok: true })
    expect(sizes).toEqual([100, 1, 1])
    expect(await cache.pending("deck")).toEqual([])
    expect((await cache.rows("deck")).filter((row) => row.kind === "confirmed")).toHaveLength(101)
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

  function tracedRemote(answer?: OpenResult): { remote: Remote; calls: string[] } {
    const real = memoryRemote()
    const calls: string[] = []
    return {
      calls,
      remote: {
        open: async (body) => {
          calls.push(`open ${body.deck}`)
          return answer ?? real.open(body)
        },
        watch: (body) => real.watch(body),
        commit: async (body) => {
          calls.push(`commit ${body.deck}`)
          return real.commit(body)
        },
      },
    }
  }

  it("refuses a commit to a deck that was never opened", async () => {
    expect(await memoryRemote().commit({ deck: "deck", batch: [{ value: "lost", node }] })).toEqual({
      ok: false,
      refusal: "deck",
    })
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
      if (String(url) === "/decks/open") return new Response(JSON.stringify({ ok: true, deck: "clean", revision: 0 }))
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
        body: { deck: "clean", batch: [{ value: "Hello!", node: "258.7", floor: "Hello" }] },
      },
    ])
    expect(Object.keys(seen[1]?.body ?? {}).sort()).toEqual(["batch", "deck"])
    expect(await cache.pending("clean")).toEqual([])
  })

  it("keeps the pending row when the clean commit key does not match", async () => {
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (String(url) === "/decks/open") return new Response(JSON.stringify({ ok: true, deck: "clean", revision: 0 }))
      expect(String(url)).toBe("/decks/commit")
      expect(String(init.method)).toBe("POST")
      expect(String(init.credentials)).toBe("same-origin")
      expect(JSON.parse(String(init.body))).toEqual({
        deck: "clean",
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
    expect(opened.register.landed).toEqual([])
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

  it("stores a deck's parts with names and hashes only", async () => {
    installParts()
    const bytes = new Uint8Array([9, 8, 7])
    const slide = "ppt/slides/slide1.xml"
    const saved = await putParts("clean", { parts: new Map([[slide, bytes]]), file: new Uint8Array([5]) })
    expect(saved.ok).toBe(true)
    const read = await getParts("clean")
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(Object.keys(read).sort()).toEqual(["file", "ok", "parts"])
    expect(Array.from(read.parts.get(slide) ?? [])).toEqual([9, 8, 7])
  })

  it("keeps the name stored with a deck", async () => {
    installParts()
    const slide = "ppt/slides/slide1.xml"
    await putParts("named", {
      parts: new Map([[slide, new Uint8Array([9])]]),
      file: new Uint8Array([5]),
      name: "Board deck",
    })
    const read = await getParts("named")
    expect(read.ok && read.name).toBe("Board deck")
  })

  it("reads an old part row that still carries a node table", async () => {
    installParts()
    const slide = "ppt/slides/slide1.xml"
    await writeSlot("clean\u0001", {
      names: { [slide]: await putPart(new Uint8Array([9, 8, 7])) },
      file: await putPart(new Uint8Array([5])),
      nodes: { a: { part: slide, shape: "2" } },
    })
    const read = await getParts("clean")
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(Object.keys(read).sort()).toEqual(["file", "ok", "parts"])
    expect(Array.from(read.parts.get(slide) ?? [])).toEqual([9, 8, 7])
    expect(Array.from(read.file)).toEqual([5])
  })

  it("refuses a part list of 65536 bytes", async () => {
    installParts()
    const saved = await putParts("clean", {
      parts: new Map([["n".repeat(70_000), new Uint8Array([1])]]),
      file: new Uint8Array([5]),
    })
    expect(saved).toEqual({ ok: false, refusal: "limit" })
    expect(await getParts("clean")).toEqual({ ok: false, refusal: "absent" })
  })

  it("reads the same part names and hashes back after a new connect", async () => {
    const files = installParts()
    const shared = new Uint8Array([9, 8, 7])
    const other = new Uint8Array([255, 0, 128])
    const slide = "ppt/slides/slide1.xml"
    const copy = "ppt/slides/slide2.xml"
    const notes = "ppt/notesSlides/notesSlide1.xml"
    const saved = await putParts("clean", {
      parts: new Map<string, Uint8Array>([
        [slide, shared],
        [copy, shared],
        [notes, other],
      ]),
      file: shared,
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
    expect(Array.from(read.parts.get(notes) ?? [])).toEqual([255, 0, 128])
    expect(files.size).toBe(2)
    expect([...files.keys()].sort()).toEqual(stored)
    for (const [hash, bytes] of written) expect(files.get(hash)).toBe(bytes)
  })

  it("keeps each deck's parts apart after a new connect", async () => {
    installParts()
    const slide = "ppt/slides/slide1.xml"
    const notes = "ppt/notesSlides/notesSlide1.xml"
    const layout = "ppt/slideLayouts/slideLayout1.xml"
    const blank = "ppt/media/blank.bin"
    const stale = await putParts("other", {
      parts: new Map<string, Uint8Array>([[layout, new Uint8Array([1])]]),
      file: new Uint8Array([1]),
    })
    const clean = await putParts("clean", {
      parts: new Map<string, Uint8Array>([
        [slide, new Uint8Array([9, 8, 7])],
        [layout, new Uint8Array([3])],
      ]),
      file: new Uint8Array([2]),
    })
    const other = await putParts("other", {
      parts: new Map<string, Uint8Array>([
        [slide, new Uint8Array([4, 5])],
        [notes, new Uint8Array([6])],
        [blank, new Uint8Array()],
      ]),
      file: new Uint8Array([3]),
    })
    expect(clean.ok).toBe(true)
    expect(stale.ok).toBe(true)
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
    expect([...readOther.parts.keys()]).toEqual([slide, notes, blank])
    expect(Array.from(readOther.parts.get(slide) ?? [])).toEqual([4, 5])
    expect(Array.from(readOther.parts.get(notes) ?? [])).toEqual([6])
    expect(readOther.parts.get(blank)?.byteLength).toBe(0)
  })

  it("answers absent for parts after the database is deleted", async () => {
    installParts()
    const saved = await putParts("clean", {
      parts: new Map([["ppt/slides/slide1.xml", new Uint8Array([9, 8, 7])]]),
      file: new Uint8Array([1]),
    })
    expect(saved.ok).toBe(true)
    await deleteDatabase()
    expect(await getParts("clean")).toEqual({ ok: false, refusal: "absent" })
  })

  it("reads a deck's opened file back after a new connect", async () => {
    installParts()
    const file = new Uint8Array([80, 75, 3, 4, 200, 1])
    await putParts("clean", { parts: new Map([["ppt/slides/slide1.xml", new Uint8Array([9])]]), file })
    await connect(memoryRemote()).openDeck("clean")
    const read = await getParts("clean")
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(Array.from(read.file)).toEqual(Array.from(file))
  })

  it("keeps each deck's own opened file", async () => {
    installParts()
    await putParts("first", {
      parts: new Map([["ppt/slides/slide1.xml", new Uint8Array([9])]]),
      file: new Uint8Array([1, 1]),
    })
    await putParts("second", {
      parts: new Map([["ppt/slides/slide1.xml", new Uint8Array([9])]]),
      file: new Uint8Array([2, 2]),
    })
    const first = await getParts("first")
    const second = await getParts("second")
    expect(first.ok && Array.from(first.file)).toEqual([1, 1])
    expect(second.ok && Array.from(second.file)).toEqual([2, 2])
  })

  it("answers absent for a row without the opened file", async () => {
    installParts()
    await writeSlot("clean\u0001", { names: { ["ppt/slides/slide1.xml"]: await putPart(new Uint8Array([9])) } })
    expect(await getParts("clean")).toEqual({ ok: false, refusal: "absent" })
  })

  it("stops at a refused batch and sends no later batch", async () => {
    const real = memoryRemote()
    const sizes: number[] = []
    const remote: Remote = {
      open: (body) => real.open(body),
      watch: (body) => real.watch(body),
      commit: async (body) => {
        sizes.push(body.batch.length)
        if (sizes.length === 2) return { ok: false, refusal: "session" }
        return real.commit(body)
      },
    }
    const cache = connect(remote)
    for (let index = 0; index < 201; index += 1) await cache.enqueue("deck", `v${index}`, node, "")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "session" })
    expect(sizes).toEqual([100, 100])
    expect(await cache.pending("deck")).toHaveLength(101)
  })

  it("keeps the second batch pending when its commit key does not match", async () => {
    const real = memoryRemote()
    let calls = 0
    const remote: Remote = {
      open: (body) => real.open(body),
      watch: (body) => real.watch(body),
      commit: async (body) => {
        calls += 1
        const answer = await real.commit(body)
        if (calls === 2 && answer.ok) return { ...answer, key: "deck:9" } as CommitResult
        return answer
      },
    }
    const cache = connect(remote)
    for (let index = 0; index < 101; index += 1) await cache.enqueue("deck", `v${index}`, node, "")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "payload" })
    expect((await cache.rows("deck")).filter((row) => row.kind === "confirmed")).toHaveLength(100)
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["v100"])
  })

  it("returns the answer of the last batch", async () => {
    const real = memoryRemote()
    const answers: CommitResult[] = []
    const remote: Remote = {
      open: (body) => real.open(body),
      watch: (body) => real.watch(body),
      commit: async (body) => {
        const answer = await real.commit(body)
        answers.push(answer)
        return answer
      },
    }
    const cache = connect(remote)
    for (let index = 0; index < 101; index += 1) await cache.enqueue("deck", `v${index}`, node, "")
    const result = await cache.flush("deck")
    expect(answers).toHaveLength(2)
    expect(result).toEqual(answers[1])
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

  it("refuses a commit answered 500 with a null JSON body as payload and keeps the row", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("null", { status: 500, headers: { "content-type": "application/json" } }),
    )
    const cache = connect(memoryRemote())
    await cache.enqueue("clean", "Hello!", node, "Hello")
    expect(await connect(httpRemote()).flush("clean")).toEqual({ ok: false, refusal: "payload" })
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
