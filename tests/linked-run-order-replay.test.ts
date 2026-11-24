import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage } from "@airdesign/live"
import { expect, it } from "vitest"
import { topics } from "../scripts/check-specs.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot } from "./spec-graph.js"

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

const color = (value: string) => [{ kind: "solid", color: { var: value } }]
const sameFill = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
const localFill = color("accent4")
const instance = (fold: doom.Doom) => doom.propOf(fold.nodes.get(frame), "instance")
const bar = (fold: doom.Doom, id: string) =>
  instance(fold)?.parts.find(({ key }) => key[0] === "bar" && key[1] === id)?.node

const agent: doom.Author = { kind: "agent", id: "agent", run: "linked-run" }
const measure = doom.measureWith({})
const dataFor = (ids: string) => ({
  rows: [...ids].map((id) => ({ id, label: id.toUpperCase(), value: id === "a" ? 4 : 8 })),
})

it("replays linked run undo and redo through the editor", async () => {
  const topic = topics(process.cwd()).find((topic: { name: string }) => topic.name === "linked-run-order")
  if (topic === undefined) throw new Error("no linked run order spec")
  const [dump] = await dumpTopics([topic])
  if (dump === undefined) throw new Error("no graph")
  const graph = parseDot(dump.graph)
  let visited = 0
  for (const [startId, initial] of graph.states) {
    if (initial.phase !== "ready") continue
    const remote = memoryDoomRemote(start)
    const opened = await createDoomDeck(remote, "linked-order", { storage: memoryStorage() })
    if (!opened.ok) throw new Error(JSON.stringify(opened))
    const { deck } = opened
    const place = doom.placeComponent(deck.view(), {
      frame,
      parent: { id: slide, at },
      box: { x: 20, y: 30, w: 1200, h: 600, flipH: false, flipV: false, rotation: 0 },
      data: dataFor("ab"),
      measure,
    })
    if (doom.isRefusal(place)) throw new Error(JSON.stringify(place))
    expect(deck.push(place, { read: deck.view() }).ok).toBe(true)
    await deck.sync()
    const newer = { ...agent, run: "newer-linked-run" }
    const sendRun = async (by: doom.Author, data: ReturnType<typeof dataFor>, fill: readonly doom.Write[] = []) => {
      const fold = deck.server()
      const made = doom.regenerateComponent(fold, frame, { data }, measure)
      if (doom.isRefusal(made)) throw new Error(JSON.stringify(made))
      const writes = [
        ...made.writes.filter((write) => !fill.some((own) => own.node === write.node && own.prop === write.prop)),
        ...fill.map((write) => ({ ...write, base: fold.revs.get(write.node)!.get(write.prop)! })),
      ]
      const result = await remote.edit({
        deck: deck.deck,
        edit: { once: by.run!, author: by, phase: "start", readBase: fold.rev, writes },
      })
      if (!result.ok) throw new Error(JSON.stringify(result))
      await deck.catchUp()
    }
    let id = startId
    for (;;) {
      const edges = graph.edges.filter(({ from }) => from === id)
      if (edges.length === 0) break
      expect(edges).toHaveLength(1)
      const edge = edges[0]!
      const after = graph.states.get(edge.to)!
      const input = dataFor(String(after.rows))
      const recolour = (): doom.Write => ({ node: bar(deck.view(), "b")!, prop: "fills", value: localFill })
      switch (edge.action) {
        case "WriteRun":
          await sendRun(agent, input, initial.scenario === "redo-fill" ? [recolour()] : [])
          break
        case "WriteNewerRun":
          await sendRun(newer, input)
          break
        case "UndoRun":
          expect((await deck.undoRun(initial.scenario === "older-run" ? newer.run! : agent.run!)).ok).toBe(true)
          break
        case "RedoRun":
          expect(deck.redo().ok).toBe(true)
          break
        case "UndoOlderRun":
          expect((await deck.undoRun(agent.run!)).ok).toBe(true)
          break
        case "Recolour":
          expect(deck.push([recolour()]).ok).toBe(true)
          break
        case "RemoveRow":
          expect(deck.regenerate(frame, { data: input }).ok).toBe(true)
          break
        case "UndoRemoveRow":
          expect(deck.undo().ok).toBe(true)
          break
        default:
          throw new Error("Unknown action " + edge.action)
      }
      await deck.sync()
      const fold = deck.server()
      expect(instance(fold)?.data.rows).toEqual(input.rows)
      const b = bar(fold, "b")
      const fill = b === undefined ? undefined : doom.propOf(fold.nodes.get(b), "fills")
      expect(fill === undefined ? "none" : sameFill(fill, localFill) ? "override" : "inherited").toBe(after.fill)
      expect(deck.notices()).toEqual([])
      visited += 1
      id = edge.to
    }
  }
  expect(visited).toBe(graph.edges.length)
}, 20_000)
