import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { expect } from "vitest"
import { createDoomDeck, openDoomDeck } from "../doom-deck.js"
import { type DoomRemote, memoryDoomRemote } from "../doom-remote.js"
import { memoryStorage } from "../doom-storage.js"

export const id = doom.nodeId
export const [deckNode, row, slide, title, card, frame] = [
  id("q:1"),
  id("q:2"),
  id("q:3"),
  id("q:4"),
  id("q:5"),
  id("q:6"),
]
export const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
export const words = (chars: string): doom.Text => ({
  chars,
  spans: [],
  paras: [{}],
  style: "body",
  resize: "height",
  alignV: "top",
})
export const placed = (x: number) => ({ x, y: 0, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })

export const start: doom.Edit = {
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckNode, prop: "type", value: "deck" },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deckNode) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    { node: title, prop: "type", value: "shape" },
    { node: title, prop: "parent", value: at(slide) },
    { node: title, prop: "text", value: words("Title") },
    { node: card, prop: "type", value: "shape" },
    { node: card, prop: "parent", value: at(slide) },
    { node: card, prop: "box", value: placed(0) },
    { node: frame, prop: "type", value: "frame" },
    { node: frame, prop: "parent", value: at(slide) },
  ],
}

export const titled: doom.Edit = {
  ...start,
  writes: [
    ...start.writes,
    { node: title, prop: "role", value: "title" },
    { node: deckNode, prop: "name", value: doom.blankDeckName },
    { node: deckNode, prop: "nameFollows", value: true },
  ],
}

export async function tabs(first: doom.Edit) {
  const remote = memoryDoomRemote(first)
  const cut = { off: false }
  const reachable =
    <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      if (cut.off) throw new TypeError("offline")
      return call(...args)
    }
  const join = async (client: string, how: "create" | "open", through: DoomRemote) => {
    let next = 0
    const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(through, "replay", {
      once: () => `${client}-${(next += 1)}`,
      client,
      storage: memoryStorage(),
      pause: () => Promise.resolve(),
    })
    if (!opened.ok) throw new Error(JSON.stringify(opened))
    return opened.deck
  }
  const inFlight: {
    before?: (() => Promise<void>) | undefined
    answer?: Awaited<ReturnType<typeof remote.edit>> | undefined
  } = {}
  const sending = async (...args: Parameters<typeof remote.edit>) => {
    const { before, answer } = inFlight
    inFlight.before = undefined
    inFlight.answer = undefined
    await before?.()
    return answer ?? remote.edit(...args)
  }
  const mine = await join("a", "create", { ...remote, edit: reachable(sending), since: reachable(remote.since) })
  const theirs = await join("b", "open", remote)
  return { cut, mine, theirs, remote, inFlight }
}

export const xOf = (view: doom.Doom) => (view.nodes.get(card) as { box: { x: number } }).box.x
export const parentOf = (view: doom.Doom, node: doom.NodeId) =>
  (view.nodes.get(node) as { parent?: { id: doom.NodeId } | null }).parent?.id ?? null
export const nudge = (x: number): readonly doom.Write[] => [{ node: card, prop: "box", value: placed(x) }]
export const typed: readonly doom.Write[] = [{ node: title, prop: "text", value: words("X") }]
export const deleted: doom.Write = { node: title, prop: "parent", value: null }
export const renamed: doom.Write = { node: deckNode, prop: "name", value: "Board pack" }
export const retyped: doom.Write = { node: title, prop: "text", value: words("Theirs") }

export type Key = "undo" | "redo"

export async function online(
  steps: readonly (readonly doom.Write[])[],
  presses: readonly Key[],
  theirWrites: readonly doom.Write[] = [deleted],
  first = start,
) {
  const { mine, theirs } = await tabs(first)
  for (const writes of steps) expect(mine.push(writes).ok).toBe(true)
  expect(await mine.sync()).toEqual({ ok: true })
  await theirs.catchUp()
  for (const write of theirWrites) expect(theirs.push([write]).ok).toBe(true)
  expect(await theirs.sync()).toEqual({ ok: true })
  await mine.catchUp()
  for (const key of presses) {
    expect(mine[key]().ok).toBe(true)
    expect(await mine.sync()).toEqual({ ok: true })
  }
  return mine
}

export async function offline(
  steps: readonly (readonly doom.Write[])[],
  presses: number | readonly Key[],
  theirWrites: readonly doom.Write[] = [deleted],
  first = start,
) {
  const opened = await tabs(first)
  const { cut, mine, theirs } = opened
  for (const writes of steps) expect(mine.push(writes).ok).toBe(true)
  expect(await mine.sync()).toEqual({ ok: true })
  cut.off = true
  const keys = typeof presses === "number" ? Array.from({ length: presses }, (): Key => "undo") : presses
  for (const key of keys) expect(mine[key]().ok).toBe(true)
  await theirs.catchUp()
  for (const write of theirWrites) expect(theirs.push([write]).ok).toBe(true)
  expect(await theirs.sync()).toEqual({ ok: true })
  cut.off = false
  expect(await mine.sync()).toEqual({ ok: true })
  return mine
}
