import { orderKeyBetween, slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { memoryShelf, node, other } from "./browser-fixtures.js"
import { holdsUnsaved, keepUnsaved, recoverUnsaved, releaseUnsaved, unsavedOf, type Shelf } from "./unsaved.js"

const text = (value: string, at = node) => ({ kind: "text" as const, node: at, floor: "file", value })

it("keeps the newest text for one element and every text for another", () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, "deck", "a", text("T"))
  keepUnsaved(shelf, "deck", "b", text("Ty"))
  keepUnsaved(shelf, "deck", "c", text("Say hi", other))
  expect(unsavedOf(shelf, "deck").map((entry) => entry.id)).toEqual(["b", "c"])
})

it("keeps a text and a box of one element apart, and slide commands in the order they came", () => {
  const shelf = memoryShelf()
  const box = { x: 1, y: 2, cx: 3, cy: 4 }
  keepUnsaved(shelf, "deck", "a", text("T"))
  keepUnsaved(shelf, "deck", "b", { kind: "box", node, floor: "file", box })
  keepUnsaved(shelf, "deck", "c", {
    kind: "slide",
    file: [slideId("256")],
    edit: { slide: "remove", id: slideId("256") },
  })
  keepUnsaved(shelf, "deck", "d", {
    kind: "slide",
    file: [slideId("256")],
    edit: { slide: "restore", id: slideId("256"), key: orderKeyBetween(null, null) },
  })
  expect(unsavedOf(shelf, "deck").map((entry) => entry.id)).toEqual(["a", "b", "c", "d"])
})

it("keeps each deck on its own", () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, "one", "a", text("T"))
  expect(unsavedOf(shelf, "two")).toEqual([])
})

it("releases an entry by its id and leaves a newer entry of the same element", () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, "deck", "a", text("T"))
  keepUnsaved(shelf, "deck", "b", text("Ty"))
  releaseUnsaved(shelf, "deck", "a")
  expect(holdsUnsaved(shelf, "deck", "b")).toBe(true)
  releaseUnsaved(shelf, "deck", "b")
  expect(unsavedOf(shelf, "deck")).toEqual([])
})

it("removes the key once nothing is unsaved", () => {
  const held = new Map<string, string>()
  const shelf = memoryShelf(held)
  keepUnsaved(shelf, "deck", "a", text("T"))
  releaseUnsaved(shelf, "deck", "a")
  expect(held.size).toBe(0)
})

it("reads nothing from a damaged journal and drops entries it cannot read", () => {
  const held = new Map<string, string>()
  const shelf = memoryShelf(held)
  held.set("airdesign:unsaved:deck", "{not json")
  expect(unsavedOf(shelf, "deck")).toEqual([])
  held.set(
    "airdesign:unsaved:deck",
    JSON.stringify([
      { kind: "text", id: "ok", node: "258.7", floor: "f", value: "v" },
      { kind: "text", id: "x" },
      7,
      null,
    ]),
  )
  expect(unsavedOf(shelf, "deck").map((entry) => entry.id)).toEqual(["ok"])
})

it("does not keep an entry too large for a row", () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, "deck", "a", text("x".repeat(70_000)))
  expect(unsavedOf(shelf, "deck")).toEqual([])
})

it("carries on when the shelf refuses to store", () => {
  const refusing: Shelf = {
    getItem: () => null,
    setItem: () => {
      throw new Error("full")
    },
    removeItem: () => undefined,
  }
  expect(() => keepUnsaved(refusing, "deck", "a", text("T"))).not.toThrow()
})

it("does nothing without a shelf", async () => {
  keepUnsaved(undefined, "deck", "a", text("T"))
  releaseUnsaved(undefined, "deck", "a")
  expect(unsavedOf(undefined, "deck")).toEqual([])
  await expect(recoverUnsaved(undefined, "deck", () => Promise.reject(new Error("never")))).resolves.toBeUndefined()
})

it("replays what was unsaved in order once per shelf and releases each after it is replayed", async () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, "deck", "a", text("T"))
  keepUnsaved(shelf, "deck", "b", text("Say hi", other))
  const replayed: string[] = []
  const replay = (entry: { readonly id: string }) => {
    replayed.push(entry.id)
    return Promise.resolve()
  }
  await Promise.all([recoverUnsaved(shelf, "deck", replay), recoverUnsaved(shelf, "deck", replay)])
  expect(replayed).toEqual(["a", "b"])
  expect(unsavedOf(shelf, "deck")).toEqual([])
})

it("keeps an entry that could not be replayed and stops there", async () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, "deck", "a", text("T"))
  keepUnsaved(shelf, "deck", "b", text("Say hi", other))
  await recoverUnsaved(shelf, "deck", () => Promise.reject(new Error("device")))
  expect(unsavedOf(shelf, "deck").map((entry) => entry.id)).toEqual(["a", "b"])
})
