import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installIndexedDb, node } from "./browser-fixtures.js"
import { deleteDatabase, memoryRemote } from "./index.js"

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

describe("live cache", () => {
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

  it("refuses a commit to a deck that was never opened", async () => {
    expect(await memoryRemote().commit({ deck: "deck", batch: [{ value: "lost", node }] })).toEqual({
      ok: false,
      refusal: "deck",
    })
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
})
