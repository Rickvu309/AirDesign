import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, type DoomRemote } from "@airdesign/live"
import { expect, it } from "vitest"
import { topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/read-base/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type State = NonNullable<ReturnType<Graph["states"]["get"]>>
type Edge = Graph["edges"][number]

const person = { kind: "person", id: "tab" } as const
const node = doom.nodeId("s:1")
const start: doom.Edit = { once: "start", author: person, writes: [{ node, prop: "type", value: "deck" }] }
const write = (value: string): doom.Write => ({ node, prop: "name", value })
const other: doom.Edit = { once: "other", author: person, writes: [write("other")] }

async function replay(route: readonly Edge[]) {
  const remote = memoryDoomRemote(start)
  let quota = 0
  let lose = false
  let interleave = false
  let answerRev = 0
  const through: DoomRemote = {
    ...remote,
    async edit(body) {
      if (quota === 0) throw new TypeError("offline")
      quota -= 1
      if (interleave) await remote.edit({ deck: body.deck, edit: other })
      const answer = await remote.edit(body)
      if (answer.ok) answerRev = answer.rev
      if (lose) throw new TypeError("reply lost")
      return answer
    },
  }
  const onces = ["first", "second"][Symbol.iterator]()
  const opened = await createDoomDeck(through, "read-base", {
    client: "tab",
    once: () => {
      const once = onces.next().value
      if (once === undefined) throw new Error("extra edit")
      return once
    },
    storage: memoryStorage(),
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  const deck = opened.deck
  for (const { action } of route) {
    if (action === "Other") {
      expect(await remote.edit({ deck: deck.deck, edit: other })).toMatchObject({ ok: true })
    } else if (action === "PrepareFirst" || action === "PrepareSecond") {
      const name = action === "PrepareFirst" ? "first" : "second"
      const pushed = deck.push([write(name)], { read: deck.view() })
      expect(pushed).toMatchObject({ ok: true, once: name })
      await deck.sync()
    } else {
      quota = 1
      lose = action === "LoseReply"
      interleave = action === "LoseCAS"
      await deck.sync()
      if (action === "Retry") expect(answerRev).toBe(2)
    }
  }
  const stored = await remote.open({ deck: deck.deck })
  if (!stored.ok) throw new Error(JSON.stringify(stored))
  const at = (once: string) => stored.fold.onces.get(once) ?? 0
  const status = (once: string) => {
    if (deck.pending().some((edit) => edit.once === once)) return at(once) === 0 ? "queued" : "lost"
    if (deck.notices().some((notice) => notice.once === once && notice.refused === "stale")) return "stale"
    return at(once) === 0 ? "none" : "saved"
  }
  return {
    head: stored.rev,
    known: deck.server().rev,
    other: at("other") > 0,
    first: status("first"),
    second: status("second"),
    aAt: at("first"),
    bAt: at("second"),
    visible: deck.view().rev,
  }
}

const visibleAt = (state: State) =>
  Number(state.known) +
  Number(state.known === 1 && (state.first === "queued" || state.first === "lost")) +
  Number(state.known !== 3 && state.second === "queued")

it("replays every guarded edit edge through the device deck", async () => {
  const topic = topics(process.cwd()).find((topic: { name: string }) => topic.name === "read-base")
  if (topic === undefined) throw new Error("no read-base spec")
  const [dump] = await dumpTopics([topic])
  if (dump === undefined) throw new Error("no graph")
  const graph = parseDot(dump.graph)
  const initial = [...graph.states].find(([, state]) => state.first === "none")
  if (initial === undefined) throw new Error("no initial state")
  const paths = new Map<string, Edge[]>([[initial[0], []]])
  let checked = 0
  for (const [id, path] of paths) {
    for (const edge of graph.edges.filter((edge) => edge.from === id)) {
      const source = graph.states.get(edge.from)!
      const target = graph.states.get(edge.to)!
      const route = [...path, edge]
      expect(await replay(route), `${view.state(source)} -${edge.action}-> ${view.state(target)}`).toEqual({
        ...target,
        visible: visibleAt(target),
      })
      checked += 1
      if (!paths.has(edge.to)) paths.set(edge.to, route)
    }
  }
  expect(checked).toBe(graph.edges.length)
  expect(paths.size).toBe(graph.states.size)
  expect(new Set(graph.edges.map((edge) => edge.action)).size).toBe(10)
}, 30_000)
