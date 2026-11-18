import { landedPatch, type ElementId, type Register } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { firstAccount, installIndexedDb, memoryShelf, other } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote, type Remote } from "./index.js"
import { accountKey, databaseName, scoped, storeName } from "./device.js"
import { rowKey, writeSlot } from "./store.js"
import written from "../../document/src/format-58-deck.json" with { type: "json" }

type Kept = Readonly<Record<string, unknown>>

const before = written.format

function entry(part: string): Kept {
  const found = written.device.entries.find((each) => each.key === `${written.deck}${part}`)?.value
  if (found === undefined || found === null) throw new Error(`no ${part}`)
  return found as Kept
}

const pending = entry("\u0000p\u0000000000000000")
const page = entry("\u0002layouts\u00020")
const journaled = (JSON.parse(written.device.journal) as readonly Kept[])[0]

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase().catch(() => undefined)
})

async function keptByTheBuildBefore(row: Kept): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = globalThis.indexedDB.open(databaseName, before)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error("open"))
  })
  const writing = database.transaction(storeName, "readwrite")
  writing.objectStore(storeName).put(row, scoped(accountKey() ?? "", rowKey("deck", "pending", 1)))
  await new Promise<void>((resolve) => {
    writing.oncomplete = () => resolve()
  })
  database.close()
}

function sentRemote(): { readonly remote: Remote; readonly sent: unknown[]; readonly server: Remote } {
  const server = memoryRemote()
  const sent: unknown[] = []
  return {
    sent,
    server,
    remote: {
      ...server,
      commit: async (body) => {
        sent.push(...body.batch)
        return server.commit(body)
      },
      index: async (body) => {
        sent.push(body)
        return server.index!(body)
      },
    },
  }
}

function border(register: Register, node: string): unknown {
  const body = register.elements[node as ElementId]
  return body === undefined ? undefined : landedPatch(body, "text").border
}

it("shows and sends the border edit a format 58 build left unsent, and the one its journal kept, under border", async () => {
  expect(Object.keys(pending.patch as Kept)).toEqual(["line"])
  await keptByTheBuildBefore({ ...pending, deck: "deck", order: 1, base: 0, floor: "" })
  const journal = new Map([
    [
      `airdesign:unsaved:${firstAccount}:deck`,
      JSON.stringify([{ ...journaled, id: "kept-1", node: other, floor: "" }]),
    ],
  ])
  const { remote, sent, server } = sentRemote()
  const tab = connect(remote, { shelf: memoryShelf(journal) })
  const opened = await tab.openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  const dotted = { fill: { set: { solid: { scheme: "tx1" } } }, dash: { set: "dot" } }
  expect(border(opened.register, String(pending.node))).toEqual(dotted)
  expect(border(opened.register, other)).toEqual(dotted)

  expect(await tab.flush("deck")).toMatchObject({ ok: true })
  expect(sent).toHaveLength(2)
  const held = await server.open({ deck: "deck" })
  if (!held.ok) throw new Error(held.refusal)
  expect(border(held.register, String(pending.node))).toEqual(dotted)
  expect(border(held.register, other)).toEqual(dotted)
  expect(JSON.stringify(held.register.elements)).not.toContain('"line"')
})

it("sends an index page a format 58 build queued with its border design", async () => {
  expect(JSON.stringify(page)).toContain('"line.width"')
  await writeSlot("deck\u0002layouts\u0002queue", { count: 1, sent: 0, once: page.once, format: before })
  await writeSlot("deck\u0002layouts\u00020", page)
  const { remote, sent, server } = sentRemote()
  await server.open({ deck: "deck" })
  expect(await connect(remote).flush("deck")).toMatchObject({ ok: true })
  expect(sent).toHaveLength(1)
  const held = await server.open({ deck: "deck" })
  if (!held.ok) throw new Error(held.refusal)
  const design = JSON.stringify(held.register.index?.elements.map((element) => element.design))
  expect(design).toContain('"border.width"')
  expect(design).not.toContain('"line.')
})
