import {
  currentBox,
  currentValue,
  elementId,
  format,
  openingElement,
  orderKeyAfter,
  presentSlides,
  slideId,
  type ElementId,
  type Register,
  type SlideId,
} from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { firstAccount, installIndexedDb, memoryShelf, writeRows } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote } from "./index.js"
import { rowKey } from "./store.js"

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

function shown(register: Register, node: ElementId) {
  const body = register.elements[node]
  if (body === undefined) throw new Error("missing node")
  return { value: currentValue(body), box: currentBox(body) }
}

it("refuses to remove the last slide", async () => {
  const cache = connect(memoryRemote())
  expect(await cache.enqueueSlide("deck", [file[0]], { slide: "remove", id: file[0] })).toEqual({
    ok: false,
    refusal: "dead",
  })
})

it("keeps a cloned slide's opening elements and their edits through offline, reload and a cleared browser", async () => {
  const remote = memoryRemote()
  const down = { ...remote, commit: () => Promise.reject(new TypeError("offline")) }
  const offline = connect(down)
  const box = { x: 1, y: 2, cx: 3, cy: 4 }
  const title = { node: elementId("258.2"), kind: "shape" as const, value: "Title", box, grouped: false }
  const clone = { slide: "clone" as const, id: slideId("258"), source: file[0], key: keyAfter(file, file[0]) }
  expect(await offline.enqueueSlide("deck", file, { ...clone, floor: [title] })).toMatchObject({ ok: true })
  expect(await offline.enqueue("deck", "Edited", title.node, "")).toEqual({ ok: true, painted: "Edited" })
  const moved = { ...box, x: 9 }
  expect(await offline.enqueueBox("deck", moved, title.node, "")).toEqual({ ok: true, painted: moved })
  const reloaded = await connect(down).openDeck("deck")
  if (!reloaded.ok) throw new Error(reloaded.refusal)
  expect(openingElement(reloaded.register, title.node)).toEqual(title)
  expect(shown(reloaded.register, title.node)).toEqual({ value: "Edited", box: moved })
  expect((await connect(remote).flush("deck")).ok).toBe(true)
  await deleteDatabase()
  installIndexedDb()
  const cleared = await connect({ ...remote }).openDeck("deck")
  if (!cleared.ok) throw new Error(cleared.refusal)
  expect(presentSlides(cleared.register).map((spot) => spot.id)).toEqual(["256", "258", "257"])
  expect(openingElement(cleared.register, title.node)).toEqual(title)
  expect(shown(cleared.register, title.node)).toEqual({ value: "Edited", box: moved })
})

it("reopens a text box added and typed in while the network is down, and sends both in order", async () => {
  const remote = memoryRemote()
  const offline = { ...remote, commit: () => Promise.reject(new TypeError("offline")) }
  const cache = connect(offline)
  const node = elementId("256.9")
  const element = { node, kind: "shape" as const, value: "", box: { x: 0, y: 0, cx: 10, cy: 5 }, grouped: false }
  expect((await cache.enqueueSlide("deck", file, { slide: "element-add", id: file[0], element })).ok).toBe(true)
  expect((await cache.enqueue("deck", "Typed", node, "")).ok).toBe(true)
  const kept = await connect(offline).openDeck("deck")
  if (!kept.ok) throw new Error(kept.refusal)
  expect(openingElement(kept.register, node)).toEqual(element)
  expect(currentValue(kept.register.elements[node]!)).toBe("Typed")
  expect((await connect(remote).flush("deck")).ok).toBe(true)
  const confirmed = await connect(remote).openDeck("deck")
  if (!confirmed.ok) throw new Error(confirmed.refusal)
  expect(currentValue(confirmed.register.elements[node]!)).toBe("Typed")
})

it("sends a background colour an older build left queued as a fill row on the slide's own node, and shows it meanwhile", async () => {
  const remote = memoryRemote()
  const accent = { scheme: "accent2" } as const
  const navy = { rgb: "0F2433" } as const
  const old = (kind: string, background: unknown) => ({
    kind,
    deck: "deck",
    value: "",
    slideFile: file,
    slideEdit: background,
  })
  await writeRows(
    [
      {
        key: rowKey("deck", "confirmed", 0),
        row: { ...old("confirmed", { slide: "background", id: "257", color: navy }), revision: 0 },
      },
      {
        key: rowKey("deck", "pending", 0),
        row: { ...old("pending", { slide: "background", id: "256", color: accent }), order: 0, base: 0 },
      },
    ] as unknown as Parameters<typeof writeRows>[0],
    [],
  )
  const node = elementId("256.slide")
  const filled = { fill: { value: { set: { solid: accent } } } }
  const kept = await connect(remote).openDeck("deck")
  if (!kept.ok) throw new Error(kept.refusal)
  expect(kept.phase).toBe("on-device")
  expect(kept.register.order).toEqual([])
  expect(kept.register.elements[node]?.landed).toMatchObject([{ actor: "person", visible: true, patch: filled }])
  expect(kept.register.elements[elementId("257.slide")]?.landed).toMatchObject([
    { actor: "person", visible: true, patch: { fill: { value: { set: { solid: navy } } } } },
  ])
  const sent: unknown[] = []
  const online = connect({
    ...remote,
    commit: (body) => {
      sent.push(body.batch)
      return remote.commit(body)
    },
  })
  expect((await online.flush("deck")).ok).toBe(true)
  expect(sent).toEqual([[{ v: format, patch: filled, node, floor: "" }]])
  const confirmed = await connect(remote).openDeck("deck")
  if (!confirmed.ok) throw new Error(confirmed.refusal)
  expect(confirmed.phase).toBe("confirmed")
  expect(confirmed.register.elements[node]?.landed).toMatchObject([{ actor: "person", visible: true, patch: filled }])
})

it("replays a background colour an older build left in the unsaved journal as a fill row", async () => {
  const accent = { scheme: "accent2" } as const
  const entry = { kind: "slide", id: "entry-1", file, edit: { slide: "background", id: "256", color: accent } }
  const journal = new Map([[`airdesign:unsaved:${firstAccount}:deck`, JSON.stringify([entry])]])
  const opened = await connect(memoryRemote(), { shelf: memoryShelf(journal) }).openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  expect(opened.pending).toMatchObject([
    {
      kind: "pending",
      node: "256.slide",
      floor: "",
      v: format,
      patch: { fill: { value: { set: { solid: accent } } } },
    },
  ])
  expect(journal.size).toBe(0)
})
