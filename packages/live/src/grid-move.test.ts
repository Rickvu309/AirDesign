import { gridRows, slideId, slideUndoable, undoOf, type SlideCommand } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { newPage } from "./device.js"
import { connect, deleteDatabase, memoryRemote } from "./index.js"

const file = Array.from({ length: 6 }, (_, i) => slideId(String(i + 256)))
const below: SlideCommand = { slide: "move-many", grid: 1, row: "keep", ids: [file[4]!, file[5]!], after: null }
const original = [file.slice(0, 4), file.slice(4)]
const inserted = [file.slice(4), file.slice(0, 4)]

beforeEach(installIndexedDb)
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("replays a whole-row move after an offline reload against the server's current row tail", async () => {
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
  expect(gridRows(confirmed.register)).toEqual([file.slice(4), [...file.slice(0, 4), "301"]])
})

it("keeps a sealed whole-row-move request byte-identical after a lost answer and reload", async () => {
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

it("keeps a whole-row move and its undo through an offline reload and one flush", async () => {
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
  expect(saved.register.order[0]).toMatchObject({ grid: 1, row: "keep" })
})

it("undoes a confirmed row move with one later server revision", async () => {
  const server = memoryRemote(),
    cache = connect(server)
  const before = await cache.openDeck("deck")
  if (!before.ok) throw new Error(before.refusal)
  const undoable = slideUndoable(before.register, file, below)
  if (undoable === null) throw new Error("undoable")
  await cache.enqueueSlide("deck", file, below)
  await cache.flush("deck")
  const moved = await cache.openDeck("deck")
  if (!moved.ok) throw new Error(moved.refusal)
  const inverse = undoOf(moved.register, undoable)
  if (!inverse.ok || inverse.commands.length !== 1) throw new Error("inverse")
  for (const command of inverse.commands) {
    if (command.command !== "slide") throw new Error("slide")
    await cache.enqueueSlide("deck", file, command.edit)
  }
  await cache.flush("deck")
  const saved = await server.open({ deck: "deck" })
  if (!saved.ok) throw new Error(saved.refusal)
  expect(saved.revision).toBe(2)
  expect(gridRows(saved.register)).toEqual(original)
})

it("keeps one move through a lost answer before an undo on the adopted server copy", async () => {
  const server = memoryRemote()
  let lose = true
  const remote = {
    ...server,
    commit: async (body: Parameters<typeof server.commit>[0]) => {
      const result = await server.commit(body)
      if (lose) {
        lose = false
        throw new TypeError("answer lost")
      }
      return result
    },
  }
  const cache = connect(remote)
  const first = await cache.openDeck("deck")
  if (!first.ok) throw new Error(first.refusal)
  const undoable = slideUndoable(first.register, file, below)
  if (undoable === null) throw new Error("undoable")
  await cache.enqueueSlide("deck", file, below)
  await expect(cache.flush("deck")).rejects.toThrow("answer lost")
  newPage()
  const again = connect({ ...remote }),
    adopted = await again.openDeck("deck")
  if (!adopted.ok) throw new Error(adopted.refusal)
  expect(adopted.register.order.filter((edit) => edit.slide === "move-many")).toHaveLength(1)
  const inverse = undoOf(adopted.register, undoable)
  if (!inverse.ok) throw new Error("undo")
  for (const command of inverse.commands) {
    if (command.command !== "slide") throw new Error("slide")
    expect(await again.enqueueSlide("deck", file, command.edit)).toMatchObject({ ok: true })
  }
  expect(await again.flush("deck")).toMatchObject({ ok: true })
  const saved = await server.open({ deck: "deck" })
  if (!saved.ok) throw new Error(saved.refusal)
  expect(saved.revision).toBe(2)
  expect(gridRows(saved.register)).toEqual(original)
})
