import type { DeckId } from "@airdesign/catalog"
import { currentValue, version, type Register } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, node, other, quiet, traffic, writeRows } from "./browser-fixtures.js"
import { newPage } from "./device.js"
import { connect, deleteDatabase, memoryRemote, type Remote } from "./index.js"
import { rowKey } from "./store.js"

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function shown(register: Register, element = node): { readonly text: string; readonly version: number } {
  const body = register.elements[element]
  if (body === undefined) throw new Error("missing node")
  return { text: currentValue(body), version: version(body) }
}

async function reopened(): Promise<Register> {
  newPage()
  const opened = await connect(memoryRemote()).openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  return opened.register
}

it("writes a keystroke with no new connection and no read of the deck's rows", async () => {
  const cache = connect(memoryRemote())
  for (let index = 0; index < 200; index += 1)
    await cache.enqueue("deck", `row ${String(index)}`, index % 2 === 0 ? node : other, "file")
  quiet()
  expect(await cache.enqueue("deck", "row 200", node, "file")).toMatchObject({ ok: true })
  expect(traffic).toEqual({ opens: 0, ranges: 0, keys: 2, puts: 2 })
  expect((await cache.pending("deck")).length).toBe(201)
})

it("joins successive keystrokes on one element into one pending row with the newest text", async () => {
  const cache = connect(memoryRemote())
  await cache.enqueue("deck", "Other", other, "file")
  for (let index = 1; index <= 200; index += 1) {
    const typed = "Typed".repeat(40).slice(0, index)
    expect(await cache.enqueue("deck", typed, node, "file")).toEqual({ ok: true, painted: typed })
  }
  const pending = await cache.pending("deck")
  expect(pending.map((row) => [row.node, String(row.value).length, row.base, row.floor])).toEqual([
    [other, 5, 0, "file"],
    [node, 200, 0, "file"],
  ])
  const opened = await cache.openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  expect(shown(await reopened())).toEqual(shown(opened.register))
  expect(shown(opened.register)).toEqual({ text: "Typed".repeat(40), version: 1 })
})

it("paints after a mix of elements what a fresh page replays from the stored rows", async () => {
  const cache = connect(memoryRemote())
  const steps: [string, typeof node][] = [
    ["a", node],
    ["ab", node],
    ["x", other],
    ["abc", node],
    ["abcd", node],
    ["xy", other],
  ]
  for (const [text, element] of steps) await cache.enqueue("deck", text, element, "file")
  const opened = await cache.openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  const replayed = await reopened()
  expect([shown(replayed), shown(replayed, other)]).toEqual([shown(opened.register), shown(opened.register, other)])
  expect([shown(replayed), shown(replayed, other)]).toEqual([
    { text: "abcd", version: 2 },
    { text: "xy", version: 2 },
  ])
  expect(await connect(memoryRemote()).enqueue("deck", "abcde", node, "file")).toMatchObject({ ok: true })
  expect(shown(await reopened())).toEqual({ text: "abcde", version: 3 })
})

it("sends the newest text of a row typed into while the flush was opening the deck", async () => {
  const real = memoryRemote()
  const sent: string[] = []
  let opening: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    opening = resolve
  })
  const remote: Remote = {
    open: async (body) => {
      await held
      return real.open(body)
    },
    watch: (body) => real.watch(body),
    commit: async (body) => {
      sent.push(...body.batch.map((edit) => ("value" in edit ? String(edit.value) : "")))
      return real.commit(body)
    },
  }
  const cache = connect(remote)
  await cache.enqueue("deck", "ab", node, "file")
  const flushed = cache.flush("deck")
  await new Promise((resolve) => setTimeout(resolve, 5))
  await cache.enqueue("deck", "abc", node, "file")
  opening()
  expect(await flushed).toMatchObject({ ok: true })
  await cache.enqueue("deck", "abcd", node, "file")
  expect(await cache.flush("deck")).toMatchObject({ ok: true })
  expect(sent).toEqual(["abc", "abcd"])
  expect(await cache.pending("deck")).toEqual([])
})

it("never writes over a row another page put at the next place", async () => {
  const cache = connect(memoryRemote())
  await cache.enqueue("deck", "mine", node, "file")
  await writeRows(
    [
      {
        key: rowKey("deck", "pending", 1),
        row: {
          kind: "pending",
          deck: "deck" as DeckId,
          order: 1,
          base: 0,
          value: "theirs",
          node: other,
          floor: "file",
        },
      },
    ],
    [],
  )
  await cache.enqueue("deck", "mine again", node, "file")
  expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["mine", "theirs", "mine again"])
})

it("never writes over a row another page has started to send", async () => {
  const cache = connect(memoryRemote())
  await cache.enqueue("deck", "sending", node, "file")
  await writeRows(
    [
      {
        key: rowKey("deck", "pending", 0),
        row: {
          kind: "pending",
          deck: "deck" as DeckId,
          order: 0,
          base: 0,
          value: "sending",
          node,
          floor: "file",
          once: "o",
        },
      },
    ],
    [],
  )
  await cache.enqueue("deck", "sending more", node, "file")
  expect((await cache.pending("deck")).map((row) => [row.value, row.once])).toEqual([
    ["sending", "o"],
    ["sending more", undefined],
  ])
})
