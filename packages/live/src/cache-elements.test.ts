import { currentValue, elementId, rootElement, type Register, type NodeRegister } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, node, other } from "./browser-fixtures.js"
import { connect, memoryRemote, deleteDatabase } from "./index.js"

beforeEach(() => {
  installIndexedDb()
})
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})
async function reloaded(): Promise<typeof connect> {
  vi.resetModules()
  return (await import("./index.js")).connect
}
function firstOf(register: Register): NodeRegister {
  const body = register.elements[rootElement]
  if (body === undefined) throw new Error("missing node")
  return body
}
it("shows an edit on its own element after the cache is opened again", async () => {
  const remote = memoryRemote()
  const cache = connect(remote)
  await cache.enqueue("deck", "solo", node, "")
  expect((await cache.flush("deck")).ok).toBe(true)
  await deleteDatabase()
  const opened = await (await reloaded())(remote).openDeck("deck")
  expect(opened.ok).toBe(true)
  if (!opened.ok) return
  const body = opened.register.elements[elementId("258.7")]
  expect(body === undefined ? undefined : currentValue(body)).toBe("solo")
  expect(currentValue(firstOf(opened.register))).not.toBe("solo")
})
it("replays an offline queue that interleaves two elements", async () => {
  const remote = memoryRemote()
  const cache = connect(remote)
  await cache.enqueue("deck", "left one", node, "left file")
  await cache.enqueue("deck", "right one", other, "right file")
  await cache.enqueue("deck", "left two", node, "left file")
  expect(await cache.enqueue("deck", "right two", other, "right file")).toEqual({ ok: true, painted: "right two" })
  const shown = async (open: typeof connect = connect) => {
    const opened = await open(remote).openDeck("deck")
    if (!opened.ok) return opened
    const left = opened.register.elements[node]
    const right = opened.register.elements[other]
    return {
      left: left === undefined ? undefined : currentValue(left),
      right: right === undefined ? undefined : currentValue(right),
      root: firstOf(opened.register).landed.length,
    }
  }
  expect(await shown()).toEqual({ left: "left two", right: "right two", root: 0 })
  expect((await cache.flush("deck")).ok).toBe(true)
  expect(await shown()).toEqual({ left: "left two", right: "right two", root: 0 })
  await deleteDatabase()
  expect(await shown(await reloaded())).toEqual({ left: "left two", right: "right two", root: 0 })
})
