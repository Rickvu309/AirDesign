import { format, gridRows, slideId, slideUndoable, undoOf, type SlideCommand } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { newPage } from "./device.js"
import { connect, deleteDatabase, memoryRemote } from "./index.js"
import { readRows } from "./store.js"

const id = (number: number) => slideId(String(number))
const file = [1, 2, 3, 4, 5, 6].map(id)
const original = [file.slice(0, 4), file.slice(4)]
const removed: SlideCommand = { slide: "remove-many", grid: 1, ids: [id(1), id(5), id(6)] }
const copied: SlideCommand = {
  slide: "clone-many",
  grid: 1,
  copies: [
    { id: id(7), source: id(1) },
    { id: id(8), source: id(5) },
  ],
}

beforeEach(installIndexedDb)
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

for (const [edit, rows] of [
  [removed, [["2", "3", "4"]]],
  [
    copied,
    [
      ["1", "2", "3", "4"],
      ["5", "7", "8", "6"],
    ],
  ],
] as const) {
  it(`${edit.slide} survives offline reload and byte-identical resend as one saved revision with one undo`, async () => {
    const server = memoryRemote()
    const sent: string[] = []
    const remote = {
      ...server,
      commit: async (body: Parameters<typeof server.commit>[0]) => {
        sent.push(JSON.stringify(body))
        const answer = await server.commit(body)
        if (sent.length === 1) throw new Error("answer lost")
        return answer
      },
    }
    const device = connect(remote)
    const opened = await device.openDeck("deck")
    if (!opened.ok) throw new Error(opened.refusal)
    const undoable = slideUndoable(opened.register, file, edit)
    expect(await device.enqueueSlide("deck", file, edit)).toMatchObject({ ok: true })
    expect(await readRows("deck")).toEqual([expect.objectContaining({ kind: "pending", format, slideEdit: edit })])
    newPage()
    const reloaded = connect(remote)
    const pending = await reloaded.openDeck("deck")
    if (!pending.ok || undoable === null) throw new Error("pending edit")
    expect(gridRows(pending.register)).toEqual(rows)
    await expect(reloaded.flush("deck")).rejects.toThrow("answer lost")
    newPage()
    const again = connect(remote)
    expect(await again.flush("deck")).toMatchObject({ ok: true })
    expect(sent).toHaveLength(2)
    expect(sent[1]).toBe(sent[0])
    const saved = await server.open({ deck: "deck" })
    if (!saved.ok) throw new Error(saved.refusal)
    expect(saved.revision).toBe(1)
    expect(saved.register.order).toEqual([edit])
    expect(gridRows(saved.register)).toEqual(rows)
    const inverse = undoOf(saved.register, undoable)
    if (!inverse.ok) throw new Error("undo refused")
    expect(inverse.commands).toHaveLength(1)
    const [turn] = inverse.commands
    if (turn?.command !== "slide") throw new Error("expected slide undo")
    expect(await again.enqueueSlide("deck", file, turn.edit)).toMatchObject({ ok: true })
    expect(await again.flush("deck")).toMatchObject({ ok: true })
    const undone = await server.open({ deck: "deck" })
    if (!undone.ok) throw new Error(undone.refusal)
    expect(undone.revision).toBe(2)
    expect(gridRows(undone.register)).toEqual(original)
  })
}
