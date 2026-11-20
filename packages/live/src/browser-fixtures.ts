import type { WireEdit } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { accountCookieName } from "@airdesign/catalog"
import { accountKey, finished, newPage, scoped, storeName, transaction } from "./device.js"
import { memoryRemote, type OpenResult, type Remote } from "./index.js"
import type { StoredRow } from "./store.js"

export const node = elementId("258.7")
export const other = elementId("258.8")
export const firstAccount = "a".repeat(32)
export const secondAccount = "b".repeat(32)

export function signInAs(account: string | undefined): void {
  Object.assign(globalThis, { document: { cookie: account === undefined ? "" : `${accountCookieName}=${account}` } })
  newPage()
}

export type Traffic = { opens: number; ranges: number; keys: number; puts: number }

export const traffic: Traffic = { opens: 0, ranges: 0, keys: 0, puts: 0 }

export function quiet(): void {
  traffic.opens = 0
  traffic.ranges = 0
  traffic.keys = 0
  traffic.puts = 0
}

export async function writeRows(
  puts: readonly { readonly key: string; readonly row: StoredRow }[],
  deletes: readonly string[],
): Promise<void> {
  const account = accountKey()
  if (account === undefined) throw new Error("session")
  const writing = await transaction("readwrite")
  const store = writing.objectStore(storeName)
  for (const key of deletes) store.delete(scoped(account, key))
  for (const put of puts) store.put(put.row, scoped(account, put.key))
  await finished(writing, () => undefined)
}

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
      newPage()
    },
  }
  return slow
}

export function memoryShelf(
  held: Map<string, string> = new Map(),
): Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length"> {
  return {
    get length() {
      return held.size
    },
    key: (at) => [...held.keys()][at] ?? null,
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
  signInAs(firstAccount)
}

export function installSlowIndexedDb(slow: SlowStore): void {
  installStore(slow)
  signInAs(firstAccount)
}

function nextTask(run: () => void): void {
  const channel = new MessageChannel()
  channel.port1.onmessage = () => {
    channel.port1.close()
    run()
  }
  channel.port2.postMessage(undefined)
}

function installStore(slow?: SlowStore): void {
  type Running = { mode: string; started: boolean; start: () => void }
  type Fake = {
    version: number
    connections: Opened[]
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
    onversionchange: (() => void) | null
    onclose: (() => void) | null
  }

  const indexed = {
    open(name: string, version = 1) {
      traffic.opens += 1
      const request: {
        result: Opened | undefined
        error: { readonly name: string } | null
        onupgradeneeded: (() => void) | null
        onsuccess: (() => void) | null
        onerror: (() => void) | null
      } = {
        result: undefined,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      }
      queueMicrotask(() => {
        let database = databases.get(name)
        if (database !== undefined && version < database.version) {
          request.error = { name: "VersionError" }
          request.onerror?.()
          return
        }
        const upgraded = database === undefined || version > database.version
        if (database === undefined) {
          const created: Fake = {
            version,
            connections: [],
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
        if (upgraded) {
          for (const connection of current.connections.splice(0)) connection.onversionchange?.()
          current.version = version
        }
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
                type Range = { lower: string; upper: string; lowerOpen?: boolean; upperOpen?: boolean }
                const within = (range?: Range) =>
                  [...rows.keys()].filter((key) => range === undefined || contains(key, range)).sort()
                return {
                  getAll: (range: Range) =>
                    enqueue(() => {
                      traffic.ranges += 1
                      return within(range).map((key) => rows.get(key))
                    }),
                  getAllKeys: (range?: Range | null, count?: number) =>
                    enqueue(() => {
                      traffic.ranges += 1
                      return within(range ?? undefined).slice(0, count)
                    }),
                  get: (key: string) =>
                    enqueue(() => {
                      traffic.keys += 1
                      return rows.get(key)
                    }),
                  put: (value: unknown, key: string) =>
                    enqueue(() => {
                      traffic.puts += 1
                      rows.set(key, structuredClone(value))
                      return key
                    }),
                  delete: (key: string | Range) =>
                    enqueue(() => {
                      if (typeof key === "string") rows.delete(key)
                      else for (const each of within(key)) rows.delete(each)
                      return undefined
                    }),
                }
              },
              start: () => {
                transaction.started = true
                const pump = () => {
                  const next = queue.shift()
                  if (next === undefined) {
                    nextTask(() => {
                      current.live.splice(current.live.indexOf(transaction), 1)
                      transaction.oncomplete?.()
                      for (const waiting of [...current.live]) current.settle(waiting)
                    })
                    return
                  }
                  next.request.result = next.run()
                  next.request.onsuccess?.()
                  queueMicrotask(pump)
                }
                if (slow?.closed !== true) {
                  nextTask(pump)
                  return
                }
                slow.waiting.push(() => nextTask(pump))
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
          onversionchange: null,
          onclose: null,
        }
        current.connections.push(request.result)
        if (upgraded) request.onupgradeneeded?.()
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
            if (!options?.create)
              throw new DOMException("A requested file or directory could not be found", "NotFoundError")
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
