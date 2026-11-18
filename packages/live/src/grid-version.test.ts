import { format, gridRows, slideId } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, memoryShelf } from "./browser-fixtures.js"
import { accountKey, newPage } from "./device.js"
import { connect, deleteDatabase, memoryRemote } from "./index.js"
import { keepUnsaved } from "./unsaved.js"

const file = Array.from({ length: 6 }, (_, i) => slideId(String(256 + i)))
const sectionStarts = [file[0]!, file[3]!]
const edit = { slide: "add", grid: 2, id: slideId("300"), after: file[0]!, layout: file[0]!, row: "new" } as const
const after = [file.slice(0, 3), [edit.id], file.slice(3)]

beforeEach(installIndexedDb)
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("adopts the published section starts and replays a version two journal edit offline after a reload", async () => {
  const server = memoryRemote()
  const cache = connect(server)
  await cache.open("deck")
  await cache.index("deck", {
    slides: file.map((id, position) => ({ id, position })),
    elements: [],
    sectionStarts,
  })
  expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 0 })
  const shelf = memoryShelf()
  keepUnsaved(shelf, accountKey()!, "deck", "first", { kind: "slide", file, edit })
  newPage()
  const down = {
    ...server,
    open: () => Promise.reject(new TypeError("offline")),
    commit: () => Promise.reject(new TypeError("offline")),
  }
  const device = connect(down, { shelf })
  const recovered = await device.openDeck("deck")
  if (!recovered.ok) throw new Error(recovered.refusal)
  expect(gridRows(recovered.register)).toEqual(after)
  expect(recovered.pending).toMatchObject([{ format, slideEdit: edit }])
  await expect(device.flush("deck")).rejects.toThrow("offline")
  expect(await connect(server).flush("deck")).toMatchObject({ ok: true, revision: 1 })
  const saved = await server.open({ deck: "deck" })
  if (!saved.ok) throw new Error(saved.refusal)
  expect(gridRows(saved.register)).toEqual(after)
  newPage()
  const reloaded = await connect(down).openDeck("deck")
  if (!reloaded.ok) throw new Error(reloaded.refusal)
  expect(gridRows(reloaded.register)).toEqual(after)
})

it("opens a new import offline and publishes its section starts before sending its first version two edit", async () => {
  const server = memoryRemote()
  const cache = connect(server)
  await cache.index(
    "fresh",
    { slides: file.map((id, position) => ({ id, position })), elements: [], sectionStarts },
    true,
  )
  await cache.open("fresh")
  const opened = await cache.openDeck("fresh")
  if (!opened.ok) throw new Error(opened.refusal)
  expect(opened.register.index).toBeUndefined()
  expect(await cache.rows("fresh")).toEqual([])
  expect(gridRows({ ...opened.register, file })).toEqual([file.slice(0, 3), file.slice(3)])
  newPage()
  const down = connect({ ...server, open: () => Promise.reject(new TypeError("offline")) })
  expect(await down.enqueueSlide("fresh", file, edit)).toMatchObject({ ok: true })
  const accepted = await server.open({ deck: "fresh" })
  if (!accepted.ok) throw new Error(accepted.refusal)
  expect(accepted.register.order).toEqual([])
  expect(await connect(server).flush("fresh")).toMatchObject({ ok: true, revision: 1 })
  const saved = await server.open({ deck: "fresh" })
  if (!saved.ok) throw new Error(saved.refusal)
  expect(saved.register.order).toEqual([edit])
  expect(gridRows(saved.register)).toEqual(after)
})
