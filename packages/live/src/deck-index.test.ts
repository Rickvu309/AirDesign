import { beforeEach, expect, it } from "vitest"
import { bytesOf, elementId, format, limits, readIndexPage } from "@airdesign/document"
import { installIndexedDb } from "./browser-fixtures.js"
import { connect, memoryRemote } from "./index.js"
import { readSlot, writeSlot } from "./store.js"

beforeEach(installIndexedDb)
const index = {
  slides: [{ id: "258", position: 0 }],
  elements: [{ node: elementId("258.7"), kind: "shape" as const, value: "Title", box: null, grouped: false }],
}

it("queues import offline, keeps the once key after a lost answer, and replays before edits", async () => {
  const real = memoryRemote()
  let online = false
  let lose = true
  const pages: unknown[] = []
  const remote = {
    ...real,
    index: async (body: Parameters<NonNullable<typeof real.index>>[0]) => {
      pages.push(structuredClone(body))
      if (!online) throw new TypeError("offline")
      const answer = await real.index!(body)
      if (lose) {
        lose = false
        throw new TypeError("lost answer")
      }
      return answer
    },
  }
  const cache = connect(remote, { once: () => "stable-once" })
  expect(await cache.index("deck", index)).toEqual({ ok: true })
  await expect(cache.flush("deck")).rejects.toThrow("offline")
  online = true
  await expect(connect(remote).flush("deck")).rejects.toThrow("lost answer")
  expect((await connect(remote).flush("deck")).ok).toBe(true)
  expect(pages[0]).toEqual(pages[1])
  expect(pages[1]).toEqual(pages[2])
  const read = await real.open({ deck: "deck" })
  expect(read.ok && read.register.index?.elements).toEqual(index.elements)
  expect(read.ok && read.revision).toBe(0)
})

it("backfills an older deck without changing its edits and sends an import in bounded pages", async () => {
  const remote = memoryRemote()
  await remote.open({ deck: "old" })
  await remote.commit({ deck: "old", batch: [{ node: elementId("258.7"), value: "Edited", floor: "Title" }] })
  const cache = connect(remote)
  await cache.index("old", index)
  await cache.flush("old")
  const old = await remote.open({ deck: "old" })
  expect(old.ok && old.revision).toBe(1)
  expect(old.ok && old.register.elements[elementId("258.7")]?.landed[0]?.value).toBe("Edited")
  const elements = Array.from({ length: 101 }, (_, n) => ({ ...index.elements[0]!, node: elementId(`258.${n}`) }))
  await cache.index("many", { ...index, elements })
  expect((await cache.flush("many")).ok).toBe(true)
  const many = await remote.open({ deck: "many" })
  expect(many.ok && many.register.index?.elements).toHaveLength(101)
})

it("persists every worst-case escaped floor in bounded rows at the full deck limit", async () => {
  const slides = Array.from({ length: limits.slides }, (_, position) => ({ id: String(258 + position), position }))
  const elements = Array.from({ length: limits.elements }, (_, n) => ({
    ...index.elements[0]!,
    node: elementId(`${258 + (n % limits.slides)}.${n}`),
    value: "\\".repeat(limits.valueBytes),
  }))
  const remote = memoryRemote()
  const cache = connect(remote, {
    once: (() => {
      let n = 0
      return () => String(n++).padStart(200, "k")
    })(),
  })
  expect(await cache.index("largest", { slides, elements })).toEqual({ ok: true })
  const queued = (await readSlot("largest\u0002layouts\u0002queue")) as { count: number }
  let count = 0
  for (let n = 0; n < queued.count; n++) {
    const page = await readSlot(`largest\u0002layouts\u0002${n}`)
    expect(bytesOf(JSON.stringify(page))).toBeLessThan(limits.row)
    const parsed = readIndexPage(page)
    expect(parsed).not.toBeNull()
    count += parsed?.elements.length ?? 0
  }
  expect(count).toBe(limits.elements)
  expect((await cache.flush("largest")).ok).toBe(true)
  const opened = await remote.open({ deck: "largest" })
  expect(opened.ok && opened.register.index?.elements).toEqual(elements)
  expect(opened.ok && opened.revision).toBe(0)
}, 60_000)

it("keeps opening text larger than an edit or a storage row without clipping it", async () => {
  const remote = memoryRemote()
  const value = "\\".repeat(80_000)
  const cache = connect(remote)
  expect(
    await cache.index("long-floor", {
      ...index,
      elements: [{ ...index.elements[0]!, value }],
    }),
  ).toEqual({ ok: true })
  const stored = (await readSlot("long-floor\u0002layouts\u00020")) as { chunks: number }
  expect(stored.chunks).toBeGreaterThan(1)
  for (let part = 0; part < stored.chunks; part++) {
    expect(bytesOf(JSON.stringify(await readSlot(`long-floor\u0002layouts\u00020:${part}`)))).toBeLessThan(limits.row)
  }
  expect((await cache.flush("long-floor")).ok).toBe(true)
  const opened = await remote.open({ deck: "long-floor" })
  expect(opened.ok && opened.register.index?.elements[0]?.value).toBe(value)
})

it("leaves a queue at this build's format alone, sent or not", async () => {
  const remote = memoryRemote()
  const cache = connect(remote)
  const layout = [{ ...index.elements[0]!, node: elementId("258.2") }]
  const layered = { ...index, slides: [{ id: "258", position: 0, free: 5, layout }] }
  expect(await cache.index("up", layered)).toEqual({ ok: true })
  const queued = await readSlot("up\u0002layouts\u0002queue")
  expect(queued).toMatchObject({ count: 1, sent: 0, format })
  expect(await cache.index("up", index)).toEqual({ ok: true })
  expect(await readSlot("up\u0002layouts\u0002queue")).toEqual(queued)
  expect((await cache.flush("up")).ok).toBe(true)
  expect(await cache.index("up", index)).toEqual({ ok: true })
  expect(await readSlot("up\u0002layouts\u0002queue")).toEqual({ ...(queued as object), sent: 1 })
  const opened = await remote.open({ deck: "up" })
  expect(opened.ok && opened.register.index).toMatchObject({ format, elements: index.elements })
  expect(opened.ok && opened.register.index?.slides[0]?.layout).toEqual(layout)
})

it("queues an older build's queue again at this build's format", async () => {
  const remote = memoryRemote()
  await writeSlot("old\u0002layouts\u0002queue", { count: 1, sent: 0, once: "old-once" })
  await writeSlot("old\u0002layouts\u00020", { once: "old-once", offset: 0, total: 1, ...index })
  expect(await connect(remote).index("old", index)).toEqual({ ok: true })
  expect(await readSlot("old\u0002layouts\u0002queue")).toMatchObject({ count: 1, sent: 0, format })
  expect(await readSlot("old\u0002layouts\u00020")).toMatchObject({ format })
})
