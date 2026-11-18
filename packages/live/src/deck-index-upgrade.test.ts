import { beforeEach, expect, it } from "vitest"
import { elementId, format, indexDue } from "@airdesign/document"
import { installIndexedDb } from "./browser-fixtures.js"
import { connect, memoryRemote } from "./index.js"
import { writeSlot } from "./store.js"

beforeEach(installIndexedDb)

const index = {
  slides: [{ id: "258", position: 0 }],
  elements: [{ node: elementId("258.7"), kind: "shape" as const, value: "Title", box: null, grouped: false }],
}
const layout = [{ ...index.elements[0]!, node: elementId("258.2") }]

it("sends the index queued again at this build's format while an older queue's last page was in flight", async () => {
  const real = memoryRemote()
  await real.open({ deck: "race" })
  let release = () => {}
  let reached = () => {}
  const inFlight = new Promise<void>((resolve) => {
    reached = resolve
  })
  let held = true
  const remote = {
    ...real,
    index: async (body: Parameters<NonNullable<typeof real.index>>[0]) => {
      const answer = await real.index!(body)
      if (held) {
        held = false
        reached()
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
      return answer
    },
  }
  await writeSlot("race\u0002layouts\u0002queue", { count: 1, sent: 0, once: "older-once" })
  await writeSlot("race\u0002layouts\u00020", { once: "older-once", offset: 0, total: 1, ...index })
  const cache = connect(remote)
  const sending = cache.flush("race")
  await inFlight
  expect(await cache.index("race", { ...index, slides: [{ id: "258", position: 0, free: 5, layout }] })).toEqual({
    ok: true,
  })
  release()
  expect((await sending).ok).toBe(true)
  await cache.flush("race")
  const opened = await real.open({ deck: "race" })
  expect(opened.ok && opened.register.index?.format).toBe(format)
  expect(opened.ok && opened.register.index?.slides[0]?.layout).toEqual(layout)
})

const designed = {
  palettes: [{ slots: { dk1: "000000", accent1: "4472C4" }, map: { tx1: "dk1" } }] as const,
  slides: [{ id: "258", position: 0 }],
  elements: [{ ...index.elements[0]!, role: "title", design: { fills: ["accent1", "style"] } } as const],
}

function olderIndex(remote: ReturnType<typeof memoryRemote>, deck: string, elements = index.elements) {
  return remote.index!({
    deck,
    once: `older-${deck}`,
    offset: 0,
    total: elements.length,
    slides: index.slides,
    elements,
  })
}

it("sends the index again when the stored one is at an older format, and a second device reads it from its open answer", async () => {
  const real = memoryRemote()
  await real.open({ deck: "older" })
  expect((await olderIndex(real, "older")).ok).toBe(true)
  const first = connect(real)
  const before = await first.open("older")
  expect(before.ok && indexDue(before.index)).toBe(true)
  expect(await first.index("older", designed)).toEqual({ ok: true })
  expect((await first.flush("older")).ok).toBe(true)
  installIndexedDb()
  const second = connect({ ...real })
  const after = await second.open("older")
  expect(after.ok && after.index?.format).toBe(format)
  expect(after.ok && after.index?.elements).toEqual(designed.elements)
  expect(after.ok && indexDue(after.index)).toBe(false)
  const answer = await real.open({ deck: "older" })
  expect(answer.ok && (answer.register as { format?: number }).format).toBe(format)
})

it("keeps the stored index whole until every page of the re-sent one arrives", async () => {
  const real = memoryRemote()
  await real.open({ deck: "half" })
  const elements = [1, 2].map((n) => ({
    ...index.elements[0]!,
    node: elementId(`258.${String(n)}`),
    value: `${"x".repeat(40_000)}${String(n)}`,
  }))
  expect((await olderIndex(real, "half", elements)).ok).toBe(true)
  const seen: unknown[] = []
  const cache = connect({
    ...real,
    index: async (body: Parameters<NonNullable<typeof real.index>>[0]) => {
      const answer = await real.index!(body)
      const opened = await real.open({ deck: "half" })
      seen.push(opened.ok ? opened.register.index : undefined)
      return answer
    },
  })
  const resent = elements.map((element) => ({ ...element, role: "body" as const }))
  expect(await cache.index("half", { slides: index.slides, elements: resent })).toEqual({ ok: true })
  expect((await cache.flush("half")).ok).toBe(true)
  expect(seen).toHaveLength(2)
  expect(seen[0]).toMatchObject({ elements })
  expect(seen[0]).not.toHaveProperty("format")
  expect(seen[0]).not.toHaveProperty("next")
  expect(seen[1]).toMatchObject({ format, elements: resent })
})

it("drops a re-sent index the server refuses, so edits still send", async () => {
  const real = memoryRemote()
  await real.open({ deck: "drift" })
  expect((await olderIndex(real, "drift")).ok).toBe(true)
  const cache = connect(real)
  const drifted = { ...designed, elements: [{ ...designed.elements[0]!, value: "Read another way" }] }
  expect(await cache.index("drift", drifted)).toEqual({ ok: true })
  expect(await cache.enqueue("drift", "Edited", elementId("258.7"), "Title")).toMatchObject({ ok: true })
  expect((await cache.flush("drift")).ok).toBe(true)
  const opened = await real.open({ deck: "drift" })
  expect(opened.ok && opened.register.index?.elements).toEqual(index.elements)
  expect(opened.ok && opened.register.elements[elementId("258.7")]?.landed[0]?.value).toBe("Edited")
})
