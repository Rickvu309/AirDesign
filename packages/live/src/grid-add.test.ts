import { gridRows, slideId, slideUndoable, undoOf, type SlideCommand } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { newPage } from "./device.js"
import { connect, deleteDatabase, memoryRemote } from "./index.js"

const file = Array.from({ length: 6 }, (_, i) => slideId(String(i + 256)))
const below: SlideCommand = { slide: "add", grid: 1, row: "new", id: slideId("300"), after: file[0]!, layout: file[0]! }
const original = [file.slice(0, 4), file.slice(4)]
const inserted = [file.slice(0, 4), [slideId("300")], file.slice(4)]

beforeEach(installIndexedDb)
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("replays a below add after an offline reload against the server's current row tail", async () => {
  const server = memoryRemote()
  const down = { ...server, commit: () => Promise.reject(new TypeError("offline")) }
  const cache = connect(down)
  await cache.openDeck("deck")
  expect(await cache.enqueueSlide("deck", file, below)).toMatchObject({ ok: true })
  await expect(cache.flush("deck")).rejects.toThrow("offline")
  newPage()
  const reloaded = await connect(down).openDeck("deck")
  if (!reloaded.ok) throw new Error(reloaded.refusal)
  expect(gridRows(reloaded.register)).toEqual(inserted)
  expect(
    await server.commit({
      deck: "deck",
      once: "foreign",
      batch: [{ slide: "add", grid: 1, row: "same", id: slideId("301"), after: file[3]!, layout: file[0]!, file }],
    }),
  ).toMatchObject({ ok: true })
  const sent: string[] = []
  const online = connect({
    ...server,
    commit: (body) => {
      sent.push(JSON.stringify(body))
      return server.commit(body)
    },
  })
  expect(await online.flush("deck")).toMatchObject({ ok: true })
  expect(sent).toHaveLength(1)
  expect(JSON.parse(sent[0]!).batch[0]).toEqual({ ...below, file })
  newPage()
  const confirmed = await connect({ ...server }).openDeck("deck")
  if (!confirmed.ok) throw new Error(confirmed.refusal)
  expect(gridRows(confirmed.register)).toEqual([[...file.slice(0, 4), "301"], ["300"], file.slice(4)])
})

it("keeps a sealed below-add request byte-identical after a lost answer and reload", async () => {
  const server = memoryRemote()
  const sent: string[] = []
  let lose = true
  const remote = {
    ...server,
    commit: async (body: Parameters<typeof server.commit>[0]) => {
      sent.push(JSON.stringify(body))
      const answer = await server.commit(body)
      if (lose) {
        lose = false
        throw new TypeError("answer lost")
      }
      return answer
    },
  }
  const cache = connect(remote)
  await cache.openDeck("deck")
  await cache.enqueueSlide("deck", file, below)
  await expect(cache.flush("deck")).rejects.toThrow("answer lost")
  newPage()
  const again = connect({ ...remote })
  await again.open("deck")
  expect(await again.flush("deck")).toMatchObject({ ok: true })
  expect(sent).toHaveLength(2)
  expect(sent[1]).toBe(sent[0])
  const saved = await server.open({ deck: "deck" })
  if (!saved.ok) throw new Error(saved.refusal)
  expect(saved.revision).toBe(1)
  expect(gridRows(saved.register)).toEqual(inserted)
})

it("keeps a below add and its undo through an offline reload and one flush", async () => {
  const server = memoryRemote()
  const down = { ...server, commit: () => Promise.reject(new TypeError("offline")) }
  const cache = connect(down)
  const first = await cache.openDeck("deck")
  if (!first.ok) throw new Error(first.refusal)
  const undoable = slideUndoable(first.register, file, below)
  if (undoable === null) throw new Error("undoable")
  await cache.enqueueSlide("deck", file, below)
  const added = await cache.openDeck("deck")
  if (!added.ok) throw new Error(added.refusal)
  const inverse = undoOf(added.register, undoable)
  if (!inverse.ok) throw new Error("undo")
  for (const command of inverse.commands) {
    if (command.command !== "slide") throw new Error("slide turn")
    expect(await cache.enqueueSlide("deck", file, command.edit)).toMatchObject({ ok: true })
  }
  newPage()
  const reloaded = await connect(down).openDeck("deck")
  if (!reloaded.ok) throw new Error(reloaded.refusal)
  expect(gridRows(reloaded.register)).toEqual(original)
  expect(await connect(server).flush("deck")).toMatchObject({ ok: true })
  const saved = await server.open({ deck: "deck" })
  if (!saved.ok) throw new Error(saved.refusal)
  expect(gridRows(saved.register)).toEqual(original)
  expect(saved.register.order[0]).toMatchObject({ grid: 1, row: "new" })
})
