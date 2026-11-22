import { presentSlides, slideId, type SlideCommand } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, node, tracedRemote } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote, type OpenResult, type Remote } from "./index.js"

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("opens the deck once for the editor's mount and its first commit", async () => {
  const { remote, calls } = tracedRemote()
  const cache = connect(remote)
  await cache.openDeck("deck")
  await cache.enqueue("deck", "first", node, "")
  expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
  expect(calls).toEqual(["open deck", "commit deck"])
})

it("hands the deck an import opened to the editor's mount without opening it again", async () => {
  const { remote, calls } = tracedRemote()
  await connect(remote).open("deck")
  const opened = await connect(remote).openDeck("deck")
  expect(opened).toMatchObject({ ok: true, phase: "confirmed", confirmed: [] })
  await connect(remote).enqueue("deck", "first", node, "")
  expect(await connect(remote).flush("deck")).toMatchObject({ ok: true, revision: 1 })
  expect(calls).toEqual(["open deck", "commit deck"])
})

it("keeps a slide enqueued while openDeck is waiting on the server", async () => {
  const real = memoryRemote()
  let openStarted = () => undefined as void
  const started = new Promise<void>((resolve) => {
    openStarted = resolve
  })
  let releaseOpen = (_result: OpenResult) => undefined as void
  const remote: Remote = {
    ...real,
    open: () => {
      openStarted()
      return new Promise<OpenResult>((resolve) => {
        releaseOpen = resolve
      })
    },
  }
  const cache = connect(remote)
  const opening = cache.openDeck("deck")
  await started
  const file = [slideId("256")] as const
  const added: SlideCommand = {
    slide: "add",
    grid: 1,
    row: "same",
    id: slideId("257"),
    after: file[0],
    layout: file[0],
  }
  expect(await cache.enqueueSlide("deck", file, added)).toEqual({ ok: true, painted: ["256", "257"] })
  releaseOpen(await real.open({ deck: "deck" }))
  const opened = await opening
  if (!opened.ok) throw new Error(opened.refusal)
  expect(opened.pending).toHaveLength(1)
  expect(presentSlides(opened.register).map((slide) => slide.id)).toEqual(["256", "257"])
})
