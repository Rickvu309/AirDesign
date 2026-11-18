import { landedPatch, type ElementId, type Register } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { firstAccount, installIndexedDb, memoryShelf } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote, type Remote } from "./index.js"
import { accountKey, databaseName, scoped, storeName } from "./device.js"
import { rowKey, writeSlot } from "./store.js"
import written from "../../document/src/format-64-deck.json" with { type: "json" }

type Kept = Readonly<Record<string, unknown>>

const before = written.format

function entry(part: string): Kept {
  const found = written.device.entries.find(
    (each) => each.key === `fd5d16e8e2a940e799c2c046bbdbbc9f\u0005${written.deck}${part}`,
  )?.value
  if (found === undefined || found === null) throw new Error(`no ${part}`)
  return found as Kept
}

const pending = entry("\u0000p\u0000000000000000")
const page = entry("\u0002layouts\u00020")
const journaled = JSON.parse(written.device.journal) as readonly Kept[]

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

function style(register: Register, node: string): unknown {
  const body = register.elements[node as ElementId]
  return body === undefined ? undefined : landedPatch(body, "text").templateStyle
}

it("shows and sends the template colour a format 64 build left unsent, and its journal's rows, on today's names", async () => {
  expect(pending.node).toBe("deck.template2")
  expect(Object.keys(pending.patch as Kept)).toEqual(["theme"])
  await keptByTheBuildBefore({ ...pending, deck: "deck", order: 1, base: 0, floor: "" })
  const journal = new Map([
    [
      `airdesign:unsaved:${firstAccount}:deck`,
      JSON.stringify(journaled.slice(1).map((kept, at) => ({ ...kept, id: `kept-${String(at)}` }))),
    ],
  ])
  const { remote, sent, server } = sentRemote()
  const tab = connect(remote, { shelf: memoryShelf(journal) })
  const opened = await tab.openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  expect(style(opened.register, "deck.templateStyle2")).toEqual({ accent4: { set: "123456" } })
  expect(style(opened.register, "deck.templateStyles")).toEqual({ accent5: { set: "0070C0" } })
  expect(style(opened.register, "2726.slide")).toEqual({ id: { set: "ppt/theme/theme1.xml" } })
  expect(opened.register.nodes).not.toContain("deck.template2")
  expect(opened.register.nodes).not.toContain("deck.theme")

  expect(await tab.flush("deck")).toMatchObject({ ok: true })
  expect(sent).toHaveLength(3)
  const held = await server.open({ deck: "deck" })
  if (!held.ok) throw new Error(held.refusal)
  expect(style(held.register, "deck.templateStyle2")).toEqual({ accent4: { set: "123456" } })
  expect(style(held.register, "deck.templateStyles")).toEqual({ accent5: { set: "0070C0" } })
  expect(style(held.register, "2726.slide")).toEqual({ id: { set: "ppt/theme/theme1.xml" } })
  expect(JSON.stringify(held.register.elements)).not.toMatch(/"(theme|template)"|deck\.(theme|template\d)/)

  const reopened = await connect(remote, { shelf: memoryShelf(journal) }).openDeck("deck")
  if (!reopened.ok) throw new Error(reopened.refusal)
  expect(Object.keys(reopened.register.elements).filter((node) => node.startsWith("deck."))).toEqual([
    "deck.templateStyle2",
    "deck.templateStyles",
  ])
})

it("sends an index page a format 64 build queued with its template styles under today's keys", async () => {
  expect(Object.keys(page)).toContain("templates")
  await writeSlot("deck\u0002layouts\u0002queue", { count: 1, sent: 0, once: page.once, format: before })
  await writeSlot("deck\u0002layouts\u00020", page)
  const { remote, sent, server } = sentRemote()
  await server.open({ deck: "deck" })
  expect(await connect(remote).flush("deck")).toMatchObject({ ok: true })
  expect(sent).toHaveLength(1)
  const held = await server.open({ deck: "deck" })
  if (!held.ok) throw new Error(held.refusal)
  expect(held.register.index?.templateStyles).toEqual(page.templates)
  expect(held.register.index?.slides.map((slide) => slide.templateStyle)).toEqual(
    (page.slides as readonly Kept[]).map((slide) => slide.template),
  )
  expect(JSON.stringify(held.register.index)).not.toMatch(/"templates?":/)
})
