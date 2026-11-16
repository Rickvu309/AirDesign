import { currentBox, currentValue, type Box, type Register } from "@airdesign/document"
import { afterEach, expect, it, vi } from "vitest"
import { installIndexedDb, node, other } from "./browser-fixtures.js"
import * as first from "./index.js"
import { memoryRemote, type Remote } from "./index.js"

type Live = typeof first

const deck = "tabs"
const words = "The file's words"
const moved: Box = { x: 1828800, y: 914400, cx: 1828800, cy: 914400 }
const bold = (text: string) => text.toUpperCase()

vi.resetModules()
const second = (await import("./index.js")) as Live

afterEach(() => {
  vi.unstubAllGlobals()
})

function deckOf(register: Register): string {
  const body = register.elements[node]
  const value = body === undefined ? words : currentValue(body)
  const shown = value === words ? "file" : value === bold(words) ? "bold" : `unknown ${value}`
  const box = body === undefined ? null : currentBox(body)
  return JSON.stringify(box) === JSON.stringify(moved) ? `moved ${shown}` : shown
}

it("keeps a moved box's saved row when the other tab adopts the deck before this tab reads its answer", async () => {
  installIndexedDb()
  const server = memoryRemote()
  let release: () => void = () => undefined
  const held: Remote = {
    ...server,
    commit: async (body) => {
      const answer = await server.commit(body)
      if (body.batch.some((edit) => "value" in edit && edit.value === bold(words)))
        await new Promise<void>((resolve) => {
          release = resolve
        })
      return answer
    },
  }
  const one = first.connect(server)
  const two = second.connect(held)
  expect(await one.openDeck(deck)).toMatchObject({ ok: true })
  expect(await two.openDeck(deck)).toMatchObject({ ok: true })
  expect(await server.commit({ deck, batch: [{ node: other, value: "a0" }] })).toMatchObject({ revision: 1 })
  expect(await two.follow(deck)).toMatchObject({ changed: true })
  expect(await second.connect(memoryRemote()).enqueueBox(deck, moved, node, words)).toMatchObject({ ok: true })
  expect(await two.flush(deck)).toMatchObject({ ok: true, revision: 2 })
  expect(await server.commit({ deck, batch: [{ node: other, value: "a1" }] })).toMatchObject({ revision: 3 })
  expect(await second.connect(memoryRemote()).enqueue(deck, bold(words), node, words)).toMatchObject({ ok: true })
  const sending = two.flush(deck)
  await vi.waitFor(async () => {
    const stored = await server.open({ deck })
    if (!stored.ok || stored.revision !== 4) throw new Error("not landed")
  })
  expect(await one.follow(deck)).toMatchObject({ ok: true, changed: true, revision: 4 })
  release()
  expect(await sending).toMatchObject({ ok: true, revision: 4 })
  const copy = await first.connect(memoryRemote()).openDeck(deck)
  if (!copy.ok) throw new Error(copy.refusal)
  expect(deckOf(copy.register)).toBe("moved bold")
})

it("keeps the newer deck the other tab adopted when this tab reads an older answer", async () => {
  installIndexedDb()
  const server = memoryRemote()
  let release: () => void = () => undefined
  const held: Remote = {
    ...server,
    commit: async (body) => {
      const answer = await server.commit(body)
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return answer
    },
  }
  const one = first.connect(server)
  const two = second.connect(held)
  expect(await one.openDeck(deck)).toMatchObject({ ok: true })
  expect(await two.openDeck(deck)).toMatchObject({ ok: true })
  expect(await second.connect(memoryRemote()).enqueue(deck, "First", node, words)).toMatchObject({ ok: true })
  const sending = two.flush(deck)
  await vi.waitFor(async () => {
    const stored = await server.open({ deck })
    if (!stored.ok || stored.revision !== 1) throw new Error("not landed")
  })
  expect(await server.commit({ deck, batch: [{ node, value: "Second" }] })).toMatchObject({ revision: 2 })
  expect(await one.follow(deck)).toMatchObject({ ok: true, changed: true, revision: 2 })
  release()
  expect(await sending).toMatchObject({ ok: true, revision: 1 })
  const copy = await first.connect(memoryRemote()).openDeck(deck)
  if (!copy.ok) throw new Error(copy.refusal)
  const body = copy.register.elements[node]
  expect(body === undefined ? undefined : currentValue(body)).toBe("Second")
})

it("numbers an answer's rows after the rows the other tab adopted while it was on its way", async () => {
  installIndexedDb()
  const server = memoryRemote()
  let release: () => void = () => undefined
  let reached: () => void = () => undefined
  const sent = new Promise<void>((resolve) => {
    reached = resolve
  })
  const held: Remote = {
    ...server,
    commit: async (body) => {
      if (body.batch.some((edit) => "value" in edit && edit.value === bold(words))) {
        reached()
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
      return server.commit(body)
    },
  }
  const one = first.connect(server)
  const two = second.connect(held)
  expect(await one.openDeck(deck)).toMatchObject({ ok: true })
  expect(await two.openDeck(deck)).toMatchObject({ ok: true })
  expect(await server.commit({ deck, batch: [{ node: other, value: "a0" }] })).toMatchObject({ revision: 1 })
  expect(await two.follow(deck)).toMatchObject({ changed: true })
  expect(await second.connect(memoryRemote()).enqueueBox(deck, moved, node, words)).toMatchObject({ ok: true })
  expect(await two.flush(deck)).toMatchObject({ ok: true, revision: 2 })
  expect(await second.connect(memoryRemote()).enqueue(deck, bold(words), node, words)).toMatchObject({ ok: true })
  const sending = two.flush(deck)
  await sent
  expect(await server.commit({ deck, batch: [{ node: other, value: "a1" }] })).toMatchObject({ revision: 3 })
  expect(await one.follow(deck)).toMatchObject({ ok: true, changed: true, revision: 3 })
  release()
  expect(await sending).toMatchObject({ ok: true, revision: 4 })
  const copy = await first.connect(memoryRemote()).openDeck(deck)
  if (!copy.ok) throw new Error(copy.refusal)
  const kept = copy.register.elements[other]
  expect([deckOf(copy.register), kept === undefined ? undefined : currentValue(kept)]).toEqual(["moved bold", "a1"])
})
