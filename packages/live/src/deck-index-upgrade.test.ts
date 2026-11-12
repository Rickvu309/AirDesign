import { beforeEach, expect, it } from "vitest"
import { elementId } from "@airdesign/document"
import { installIndexedDb } from "./browser-fixtures.js"
import { connect, memoryRemote } from "./index.js"

beforeEach(installIndexedDb)

const index = {
  slides: [{ id: "258", position: 0 }],
  elements: [{ node: elementId("258.7"), kind: "shape" as const, value: "Title", box: null, grouped: false }],
}
const layout = [{ ...index.elements[0]!, node: elementId("258.2") }]

it.fails("sends the layout upgrade that was queued while the last import page was in flight", async () => {
  const real = memoryRemote()
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
  const cache = connect(remote)
  expect(await cache.index("race", index)).toEqual({ ok: true })
  const sending = cache.flush("race")
  await inFlight
  expect(await cache.index("race", { ...index, slides: [{ id: "258", position: 0, layout }] })).toEqual({ ok: true })
  release()
  expect((await sending).ok).toBe(true)
  await cache.flush("race")
  const opened = await real.open({ deck: "race" })
  expect(opened.ok && opened.register.index?.slides[0]?.layout).toEqual(layout)
})
