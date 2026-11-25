import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, openDoomDeck, type DoomRemote } from "@airdesign/live"
import { expect, it } from "vitest"
import { topics } from "../scripts/check-specs.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type State = NonNullable<ReturnType<Graph["states"]["get"]>>
type Edge = Graph["edges"][number]

const person: doom.Author = { kind: "person", id: "other" }
const root = doom.nodeId("s:1")
const row = doom.nodeId("s:2")
const slide = doom.nodeId("s:3")
const frame = doom.nodeId("s:4")
const at = doom.orderKeyBetween(null, null)
const start: doom.Edit = {
  once: "start",
  author: person,
  writes: [
    { node: root, prop: "type", value: "deck" },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: { id: root, at } },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: { id: row, at } },
  ],
}

const instance = (fold: doom.Doom) => doom.propOf(fold.nodes.get(frame), "instance")
const bar = (fold: doom.Doom, id: string) =>
  instance(fold)?.parts.find(({ key }) => key[0] === "bar" && key[1] === id)?.node

const measure = doom.measureWith({})
const dataFor = (ids: string) => ({
  rows: [...ids].map((id) => ({ id, label: id.toUpperCase(), value: id === "a" ? 4 : 8 })),
})

async function reloadReplay(turn: State[string], actions: readonly Edge[], graph: Graph) {
  const shared = memoryDoomRemote(start)
  const storage = memoryStorage()
  let offline = false
  const remote: DoomRemote = {
    ...shared,
    async edit(body) {
      if (offline) throw new TypeError("offline")
      return shared.edit(body)
    },
  }
  const opened = await createDoomDeck(remote, "reload-replay", { storage })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  let deck = opened.deck
  const prior = { data: dataFor("ab"), variant: {}, tokens: {} }
  const edited = {
    data: { rows: dataFor("ab").rows.map((row) => ({ ...row, value: row.value + 7 })) },
    variant: { labels: false },
    tokens: { accent: { var: "accent3" } },
  }
  const later = { data: dataFor("ba"), variant: { labels: true }, tokens: { accent: { var: "accent4" } } }
  const placed = doom.placeComponent(deck.view(), doom.columnDefinition, {
    frame,
    parent: { id: slide, at },
    box: { x: 20, y: 30, w: 1200, h: 600, flipH: false, flipV: false, rotation: 0 },
    data: prior.data,
    measure,
  })
  if (doom.isRefusal(placed)) throw new Error(JSON.stringify(placed))
  expect(deck.push(placed, { read: deck.view() }).ok).toBe(true)
  await deck.sync()
  const alpha = bar(deck.view(), "a")
  const beta = bar(deck.view(), "b")
  if (alpha === undefined || beta === undefined) throw new Error("Missing chart bars")
  if (turn === "undo-delete") expect(deck.push([{ node: beta, prop: "parent", value: null }]).ok).toBe(true)
  else expect(deck.regenerate(frame, edited).ok).toBe(true)
  await deck.sync()
  if (turn === "redo-inputs") {
    expect(deck.undo().ok).toBe(true)
    await deck.sync()
  }

  const saved = async () => {
    const current = await shared.open({ deck: deck.deck })
    if (!current.ok) throw new Error(JSON.stringify(current))
    return current.fold
  }
  const other = async (writes: readonly doom.Write[], readBase?: doom.Rev) => {
    expect(
      await shared.edit({
        deck: deck.deck,
        edit: { author: person, once: "elsewhere", writes, ...(readBase === undefined ? {} : { readBase }) },
      }),
    ).toMatchObject({ ok: true })
  }
  for (const edge of actions) {
    const newState = graph.states.get(edge.to)!
    switch (edge.action) {
      case "Queue": {
        offline = true
        const turned = turn === "redo-inputs" ? deck.redo() : deck.undo()
        if (!turned.ok) throw new Error(JSON.stringify(turned))
        await turned.saved
        await deck.sync()
        break
      }
      case "Reload": {
        const reopened = await openDoomDeck(remote, deck.deck, { storage })
        if (!reopened.ok) throw new Error(JSON.stringify(reopened))
        deck = reopened.deck
        expect(deck.pending()).toHaveLength(1)
        break
      }
      case "OtherDelete":
        await other([{ node: alpha, prop: "parent", value: null }])
        break
      case "OtherInput": {
        const field = newState.written
        if (field !== "data" && field !== "variant" && field !== "tokens") throw new Error("Missing later field")
        const fold = await saved()
        const update = doom.regenerateComponent(fold, frame, { [field]: later[field] }, measure)
        if (doom.isRefusal(update)) throw new Error(JSON.stringify(update))
        await other(update.writes, fold.rev)
        break
      }
      case "Reconnect":
        offline = false
        expect(await deck.sync()).toEqual({ ok: true })
        expect(deck.notices()).toEqual([])
        expect(deck.pending()).toEqual([])
        break
      default:
        throw new Error("Unknown reload action " + edge.action)
    }
    const fold = await saved()
    const current = instance(fold)
    for (const field of ["data", "variant", "tokens"] as const) {
      const value = newState[field]
      expect(current?.[field]).toEqual(
        value === "edited" ? edited[field] : value === "later" ? later[field] : prior[field],
      )
    }
    expect(doom.onDeck(fold.nodes, alpha)).toBe(newState.alpha)
    expect(doom.onDeck(fold.nodes, beta)).toBe(newState.beta)
  }
}

it("replays linked turns through reload and later writers of each input", async () => {
  const topic = topics(process.cwd()).find((topic: { name: string }) => topic.name === "linked-turn-reload")
  if (topic === undefined) throw new Error("no linked-turn-reload spec")
  const [dump] = await dumpTopics([topic])
  if (dump === undefined) throw new Error("no graph")
  const graph = parseDot(dump.graph)
  const paths = new Map<string, Edge[]>(
    [...graph.states].filter(([, state]) => state.phase === "ready").map(([id]) => [id, []]),
  )
  const outgoing = new Map<string, Edge[]>()
  for (const edge of graph.edges) {
    const edges = outgoing.get(edge.from) ?? []
    edges.push(edge)
    outgoing.set(edge.from, edges)
  }
  let checked = 0
  for (const [id, path] of paths) {
    for (const edge of outgoing.get(id) ?? []) {
      const next = [...path, edge]
      if (edge.action === "Reconnect") {
        const turn = graph.states.get(id)?.turn
        if (turn === undefined) throw new Error("Missing turn")
        await reloadReplay(turn, next, graph)
        checked += 1
      }
      if (!paths.has(edge.to)) paths.set(edge.to, next)
    }
  }
  expect(paths.size).toBe(graph.states.size)
  expect(checked).toBe(graph.edges.filter(({ action }) => action === "Reconnect").length)
}, 30_000)
