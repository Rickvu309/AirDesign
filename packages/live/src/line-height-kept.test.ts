import { currentValue, readTextValue, type Register } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { firstAccount, installIndexedDb, memoryShelf, node, other } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote, type Remote } from "./index.js"
import { accountKey, databaseName, scoped, storeName } from "./device.js"
import { rowKey, writeSlot } from "./store.js"

const before = 54
const typed = '[{"from":0,"lineSpacing":150000,"runs":[{"from":-1,"text":"Quarterly plan"}]}]'
const styled =
  '[{"from":0,"align":"center","lineSpacing":130000,"spaceBefore":0,"spaceAfter":0,"runs":[{"from":-1,"text":"North and South"}]}]'

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase().catch(() => undefined)
})

async function keptByTheBuildBefore(row: Record<string, unknown>): Promise<void> {
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

function lineHeight(register: Register, at: typeof node): number | undefined {
  const body = register.elements[at]
  return body === undefined ? undefined : readTextValue(currentValue(body))?.[0]?.lineHeight
}

it("shows and sends a pending row and a journal entry the build before line height kept, as that build wrote them", async () => {
  await keptByTheBuildBefore({
    kind: "pending",
    deck: "deck",
    order: 1,
    base: 0,
    node,
    v: before,
    patch: { text: { value: { set: typed } } },
    floor: "",
  })
  const journal = new Map([
    [
      `airdesign:unsaved:${firstAccount}:deck`,
      JSON.stringify([
        {
          id: "kept-1",
          kind: "row",
          node: other,
          floor: "",
          row: { v: before, patch: { text: { value: { set: styled } } } },
        },
      ]),
    ],
  ])
  const { remote, sent, server } = sentRemote()
  const tab = connect(remote, { shelf: memoryShelf(journal) })
  const opened = await tab.openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  expect(lineHeight(opened.register, node)).toBe(150_000)
  expect(lineHeight(opened.register, other)).toBe(130_000)

  expect(await tab.flush("deck")).toMatchObject({ ok: true })
  expect(sent).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ node, patch: { text: { value: { set: typed } } } }),
      expect.objectContaining({ node: other, patch: { text: { value: { set: styled } } } }),
    ]),
  )
  const held = await server.open({ deck: "deck" })
  if (!held.ok) throw new Error(held.refusal)
  expect(lineHeight(held.register, node)).toBe(150_000)
  expect(lineHeight(held.register, other)).toBe(130_000)
})

it("sends an index page the build before line height queued, with its text styles' line height", async () => {
  const subtitle = {
    id: "ppt/slideLayouts/slideLayout1.xml/3/0",
    name: "Subtitle",
    fields: { size: 2400, align: "center", lineSpacing: 90000 },
  }
  const page = {
    format: before,
    once: "older-once",
    offset: 0,
    total: 1,
    slides: [{ id: "258", position: 0, textStyles: [subtitle] }],
    elements: [{ node, kind: "shape", value: "Title", box: null, grouped: false }],
  }
  await writeSlot("deck\u0002layouts\u0002queue", { count: 1, sent: 0, once: "older-once", format: before })
  await writeSlot("deck\u0002layouts\u00020", page)
  const { remote, sent, server } = sentRemote()
  await server.open({ deck: "deck" })
  expect(await connect(remote).flush("deck")).toMatchObject({ ok: true })
  expect(sent).toHaveLength(1)
  const held = await server.open({ deck: "deck" })
  if (!held.ok) throw new Error(held.refusal)
  const styles = held.register.index?.slides[0]?.textStyles
  expect(Array.isArray(styles) ? styles[0]?.fields : undefined).toMatchObject({ lineHeight: 90_000 })
})
