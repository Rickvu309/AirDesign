import { format, orderKeyBetween, slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { memoryShelf, node, other } from "./browser-fixtures.js"
import {
  holdsUnsaved,
  keepUnsaved,
  noteBoxes,
  readUnsaved,
  recoverUnsaved,
  releaseUnsaved,
  unsavedOf,
  type Shelf,
  type Unsaved,
} from "./unsaved.js"

const account = "a".repeat(32)
const text = (value: string, at = node) => ({ kind: "text" as const, node: at, floor: "file", value })

it("notes a dragged box in the same turn, and leaves it for the next page to replay", async () => {
  const shelf = memoryShelf()
  const box = { x: 1, y: 2, cx: 3, cy: 4 }
  const release = noteBoxes("deck", [{ node, floor: "file", box }], shelf, account)
  expect(unsavedOf(shelf, account, "deck")).toMatchObject([{ kind: "box", box }])
  const replayed: string[] = []
  await recoverUnsaved(shelf, account, "deck", async (entry) => {
    replayed.push(entry.id)
  })
  expect(replayed).toEqual([])
  expect(unsavedOf(shelf, account, "deck")).toHaveLength(1)
  release()
  expect(unsavedOf(shelf, account, "deck")).toEqual([])
})

it("keeps the newest text for one element and every text for another", () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, account, "deck", "a", text("T"))
  keepUnsaved(shelf, account, "deck", "b", text("Ty"))
  keepUnsaved(shelf, account, "deck", "c", text("Say hi", other))
  expect(unsavedOf(shelf, account, "deck").map((entry) => entry.id)).toEqual(["b", "c"])
})

it("keeps a text and a box of one element apart, and slide commands in the order they came", () => {
  const shelf = memoryShelf()
  const box = { x: 1, y: 2, cx: 3, cy: 4 }
  keepUnsaved(shelf, account, "deck", "a", text("T"))
  keepUnsaved(shelf, account, "deck", "b", { kind: "box", node, floor: "file", box })
  keepUnsaved(shelf, account, "deck", "c", {
    kind: "slide",
    file: [slideId("256")],
    edit: { slide: "remove", id: slideId("256") },
  })
  keepUnsaved(shelf, account, "deck", "d", {
    kind: "slide",
    file: [slideId("256")],
    edit: { slide: "restore", id: slideId("256"), key: orderKeyBetween(null, null) },
  })
  expect(unsavedOf(shelf, account, "deck").map((entry) => entry.id)).toEqual(["a", "b", "c", "d"])
})

it("keeps each deck on its own", () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, account, "one", "a", text("T"))
  expect(unsavedOf(shelf, account, "two")).toEqual([])
})

it("releases an entry by its id and leaves a newer entry of the same element", () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, account, "deck", "a", text("T"))
  keepUnsaved(shelf, account, "deck", "b", text("Ty"))
  releaseUnsaved(shelf, account, "deck", "a")
  expect(holdsUnsaved(shelf, account, "deck", "b")).toBe(true)
  releaseUnsaved(shelf, account, "deck", "b")
  expect(unsavedOf(shelf, account, "deck")).toEqual([])
})

it("removes the key once nothing is unsaved", () => {
  const held = new Map<string, string>()
  const shelf = memoryShelf(held)
  keepUnsaved(shelf, account, "deck", "a", text("T"))
  releaseUnsaved(shelf, account, "deck", "a")
  expect(held.size).toBe(0)
})

it("reads nothing from a damaged journal and drops entries it cannot read", () => {
  const held = new Map<string, string>()
  const shelf = memoryShelf(held)
  held.set(`airdesign:unsaved:${account}:deck`, "{not json")
  expect(unsavedOf(shelf, account, "deck")).toEqual([])
  held.set(
    `airdesign:unsaved:${account}:deck`,
    JSON.stringify([
      { kind: "text", id: "ok", node: "258.7", floor: "f", value: "v" },
      { kind: "text", id: "x" },
      7,
      null,
    ]),
  )
  expect(unsavedOf(shelf, account, "deck").map((entry) => entry.id)).toEqual(["ok"])
})

it("does not keep an entry too large for a row", () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, account, "deck", "a", text("x".repeat(70_000)))
  expect(unsavedOf(shelf, account, "deck")).toEqual([])
})

it("carries on when the shelf refuses to store", () => {
  const refusing: Shelf = {
    length: 0,
    key: () => null,
    getItem: () => null,
    setItem: () => {
      throw new Error("full")
    },
    removeItem: () => undefined,
  }
  expect(() => keepUnsaved(refusing, account, "deck", "a", text("T"))).not.toThrow()
})

it("does nothing without a shelf", async () => {
  keepUnsaved(undefined, account, "deck", "a", text("T"))
  releaseUnsaved(undefined, account, "deck", "a")
  expect(unsavedOf(undefined, account, "deck")).toEqual([])
  await expect(
    recoverUnsaved(undefined, account, "deck", () => Promise.reject(new Error("never"))),
  ).resolves.toBeUndefined()
})

it("replays what was unsaved in order once per shelf and releases each after it is replayed", async () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, account, "deck", "a", text("T"))
  keepUnsaved(shelf, account, "deck", "b", text("Say hi", other))
  const replayed: string[] = []
  const replay = (entry: { readonly id: string }) => {
    replayed.push(entry.id)
    return Promise.resolve()
  }
  await Promise.all([recoverUnsaved(shelf, account, "deck", replay), recoverUnsaved(shelf, account, "deck", replay)])
  expect(replayed).toEqual(["a", "b"])
  expect(unsavedOf(shelf, account, "deck")).toEqual([])
})

it("keeps an entry that could not be replayed and stops there", async () => {
  const shelf = memoryShelf()
  keepUnsaved(shelf, account, "deck", "a", text("T"))
  keepUnsaved(shelf, account, "deck", "b", text("Say hi", other))
  await recoverUnsaved(shelf, account, "deck", () => Promise.reject(new Error("device")))
  expect(unsavedOf(shelf, account, "deck").map((entry) => entry.id)).toEqual(["a", "b"])
})

it("journals an entire row move and recovers exactly one command", async () => {
  const shelf = memoryShelf()
  const entry = {
    kind: "slide",
    file: [slideId("256"), slideId("257")],
    edit: { slide: "move-many", grid: 1, row: "keep", ids: [slideId("256"), slideId("257")], after: null },
  } as const
  keepUnsaved(shelf, account, "deck", "move", entry)
  const recovered: unknown[] = []
  await recoverUnsaved(shelf, account, "deck", async (entry) => {
    recovered.push(entry)
  })
  expect(recovered).toEqual([expect.objectContaining(entry)])
  expect(unsavedOf(shelf, account, "deck")).toEqual([])
})

it("reads each kind of entry back as it was kept, and a slide background an older build kept as a fill row", () => {
  const file = [slideId("256"), slideId("257")]
  const kept: Unsaved[] = [
    { ...text("T"), id: "t" },
    { kind: "box", id: "b", node, floor: "file", box: { x: 1, y: 2, cx: 3, cy: 4 } },
    { kind: "row", id: "r", node, floor: "file", row: { v: format, patch: { box: { x: { set: 5 } } } } },
    { kind: "slide", id: "s", file, edit: { slide: "remove", id: slideId("257") } },
    { kind: "slides", id: "m", file, edits: [{ slide: "remove", id: slideId("257") }] },
  ]
  for (const entry of kept) {
    expect(readUnsaved({ ...entry, format })).toEqual({ ok: true, value: entry })
    expect(readUnsaved({ ...entry, format: format + 1 })).toEqual({ ok: false, refusal: "newer" })
  }
  const accent = { scheme: "accent2" } as const
  const background = { slide: "background", id: "256", color: accent }
  expect(readUnsaved(JSON.parse(JSON.stringify({ kind: "slide", id: "g", file, edit: background })))).toEqual({
    ok: true,
    value: {
      kind: "row",
      id: "g",
      node: "256.slide",
      floor: "",
      row: { v: 57, patch: { fills: { p0: { set: { solid: accent } } } } },
    },
  })
})

const journalKey = `airdesign:unsaved:${account}:deck`
const newerRow = {
  kind: "row",
  id: "newer",
  node,
  floor: "file",
  row: { v: format + 1, patch: { fill: { paints: { set: [] } } } },
  format: format + 1,
}
const unknownKind = { kind: "grid-note", id: "unknown", format: format + 1, note: "kept" }

it("keeps entries a newer build wrote, and ones it cannot read, when it keeps and releases its own", () => {
  const held = new Map([[journalKey, JSON.stringify([newerRow, unknownKind])]])
  const shelf = memoryShelf(held)
  keepUnsaved(shelf, account, "deck", "a", text("T"))
  expect(JSON.parse(held.get(journalKey) ?? "[]")).toEqual([newerRow, unknownKind, { ...text("T"), id: "a", format }])
  releaseUnsaved(shelf, account, "deck", "a")
  expect(JSON.parse(held.get(journalKey) ?? "[]")).toEqual([newerRow, unknownKind])
})

it("stops replaying at an entry it cannot read, keeps it and every later entry, and says so", async () => {
  const held = new Map<string, string>()
  const shelf = memoryShelf(held)
  keepUnsaved(shelf, account, "deck", "a", text("T"))
  held.set(journalKey, JSON.stringify([...JSON.parse(held.get(journalKey) ?? "[]"), newerRow]))
  keepUnsaved(shelf, account, "deck", "b", text("Say hi", other))
  const replayed: string[] = []
  const stopped = await recoverUnsaved(shelf, account, "deck", async (entry) => {
    replayed.push(entry.id)
  })
  expect(replayed).toEqual(["a"])
  expect(stopped).toBe("newer")
  expect(JSON.parse(held.get(journalKey) ?? "[]").map((entry: { id: string }) => entry.id)).toEqual(["newer", "b"])
})
