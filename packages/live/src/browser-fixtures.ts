import type { WireEdit } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { memoryRemote, type OpenResult, type Remote } from "./index.js"

export const node = elementId("258.7")
export const other = elementId("258.8")

export type SlowStore = {
  closed: boolean
  readonly waiting: (() => void)[]
  readonly alive: Set<() => void>
  hold(): void
  release(): void
  drop(): void
}

export function slowStore(): SlowStore {
  const slow: SlowStore = {
    closed: false,
    waiting: [],
    alive: new Set(),
    hold: () => {
      slow.closed = true
    },
    release: () => {
      slow.closed = false
      for (const run of slow.waiting.splice(0)) run()
    },
    drop: () => {
      slow.closed = false
      slow.waiting.length = 0
      for (const drop of [...slow.alive]) drop()
      slow.alive.clear()
    },
  }
  return slow
}

export function memoryShelf(
  held: Map<string, string> = new Map(),
): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => {
      held.set(key, value)
    },
    removeItem: (key) => {
      held.delete(key)
    },
  }
}

export function installIndexedDb(): void {
  installStore()
}

export function installSlowIndexedDb(slow: SlowStore): void {
  installStore(slow)
}

function installStore(slow?: SlowStore): void {
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
                if (slow?.closed !== true) {
                  queueMicrotask(pump)
                  return
                }
                slow.waiting.push(() => queueMicrotask(pump))
              },
            }
            slow?.alive.add(() => {
              const at = current.live.indexOf(transaction)
              if (at >= 0) current.live.splice(at, 1)
              transaction.started = true
            })
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

export function installParts(): Map<string, Uint8Array> {
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

export function countingRemote(): { remote: Remote; commits: WireEdit["value"][][] } {
  const remote = memoryRemote()
  const commits: WireEdit["value"][][] = []
  return {
    commits,
    remote: {
      open: (body) => remote.open(body),
      watch: (body) => remote.watch(body),
      commit: async (body) => {
        commits.push(body.batch.map((edit) => ("slide" in edit ? edit.slide : edit.value)))
        return remote.commit(body)
      },
    },
  }
}

export function tracedRemote(answer?: OpenResult): { remote: Remote; calls: string[] } {
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
