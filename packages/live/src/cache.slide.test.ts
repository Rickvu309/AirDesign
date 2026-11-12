import { orderKeyAfter, presentSlides, slideId, type SlideId } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote } from "./index.js"

const file = [slideId("256"), slideId("257")] as const

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function keyAfter(ids: readonly SlideId[], after: SlideId) {
  const key = orderKeyAfter(presentSlides({ file: ids, order: [] }), after)
  if (key === null) throw new Error("key")
  return key
}

it("keeps a new slide on the device when the network is down and sends it later", async () => {
  const remote = memoryRemote()
  const offline = {
    ...remote,
    commit: () => Promise.reject(new TypeError("offline")),
  }
  const cache = connect(offline)
  const added = await cache.enqueueSlide("deck", file, {
    slide: "add",
    id: slideId("258"),
    after: file[0],
    key: keyAfter(file, file[0]),
    layout: file[0],
  })
  expect(added).toEqual({ ok: true, painted: ["256", "258", "257"] })
  await expect(cache.flush("deck")).rejects.toThrow(TypeError)
  const kept = await connect(offline).openDeck("deck")
  if (!kept.ok) throw new Error(kept.refusal)
  expect(kept.phase).toBe("on-device")
  expect(presentSlides(kept.register).map((spot) => spot.id)).toEqual(["256", "258", "257"])
  const sent: unknown[] = []
  const online = connect({
    ...remote,
    commit: (body) => {
      sent.push(body.batch)
      return remote.commit(body)
    },
  })
  expect((await online.flush("deck")).ok).toBe(true)
  expect(sent).toEqual([
    [{ slide: "add", id: slideId("258"), after: file[0], key: keyAfter(file, file[0]), layout: file[0], file }],
  ])
  const confirmed = await connect(remote).openDeck("deck")
  if (!confirmed.ok) throw new Error(confirmed.refusal)
  expect(confirmed.phase).toBe("confirmed")
  expect(presentSlides(confirmed.register).map((spot) => spot.id)).toEqual(["256", "258", "257"])
})

it("refuses to remove the last slide", async () => {
  const cache = connect(memoryRemote())
  expect(await cache.enqueueSlide("deck", [file[0]], { slide: "remove", id: file[0] })).toEqual({
    ok: false,
    refusal: "dead",
  })
})
