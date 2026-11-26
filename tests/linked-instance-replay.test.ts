import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, openDoomDeck, type DoomRemote } from "@airdesign/live"
import { expect, it } from "vitest"
import { topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/linked-instance/view.mjs"
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

const rows = [{ id: "a", label: "A", value: 1 }]
const changed = { rows: [{ id: "a", label: "A", value: 9 }] }
const added = { rows: [...changed.rows, { id: "b", label: "B", value: 5 }] }
const color = (value: string) => [{ kind: "solid", color: { var: value } }]
const sameFill = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
const otherFill = color("accent5")
const localFill = color("accent4")
const instance = (fold: doom.Doom) => doom.propOf(fold.nodes.get(frame), "instance")
const bar = (fold: doom.Doom, id: string) =>
  instance(fold)?.parts.find(({ key }) => key[0] === "bar" && key[1] === id)?.node

async function replay(scenario: State[string], actions: readonly string[]) {
  const shared = memoryDoomRemote(start)
  let offline = false
  let secondOffline = false
  const through = (blocked: () => boolean): DoomRemote => ({
    ...shared,
    edit: (body) => (blocked() ? Promise.reject(new TypeError("offline")) : shared.edit(body)),
  })
  const opened = await createDoomDeck(
    through(() => offline),
    "linked-replay",
    { storage: memoryStorage() },
  )
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  const { deck } = opened
  const options = {
    frame,
    parent: { id: slide, at },
    box: { x: 20, y: 30, w: 1200, h: 600, flipH: false, flipV: false, rotation: 0 },
    data: { rows },
    measure: doom.measureWith({}),
    mint: deck.mint,
  }
  const placed = doom.placeComponent(deck.view(), doom.columnDefinition, options)
  if (doom.isRefusal(placed)) throw new Error(JSON.stringify(placed))
  expect(deck.push(placed, { read: deck.view() }).ok).toBe(true)
  await deck.sync()
  const base = deck.server().rev
  const openedSecond = await openDoomDeck(
    through(() => secondOffline),
    deck.deck,
    { storage: memoryStorage() },
  )
  if (!openedSecond.ok) throw new Error(JSON.stringify(openedSecond))
  const second = openedSecond.deck
  const original = bar(deck.view(), "a")
  if (original === undefined) throw new Error("Missing first bar")
  let newBar: doom.NodeId | undefined
  let phase = "start"
  let empty = "untried"
  const other = async (write: doom.Write) =>
    expect(
      await shared.edit({ deck: deck.deck, edit: { once: "other", author: person, writes: [write] } }),
    ).toMatchObject({ ok: true })
  for (const action of actions) {
    switch (action) {
      case "Plan":
        offline = scenario !== "undo"
        secondOffline = true
        if (scenario !== "empty") {
          expect(
            deck.regenerate(frame, {
              data: scenario === "dependent" ? added : changed,
              ...(scenario === "undo" ? { tokens: { accent: { var: "accent3" } } } : {}),
            }).ok,
          ).toBe(true)
          await deck.sync()
        }
        if (scenario === "dependent") {
          newBar = bar(deck.view(), "b")
          if (newBar === undefined) throw new Error("Missing new bar")
          expect(deck.push([{ node: newBar, prop: "fills", value: localFill }]).ok).toBe(true)
        } else if (scenario === "delete") {
          second.push([{ node: original, prop: "parent", value: null }])
          await second.sync()
        } else if (scenario === "undo") {
          offline = true
          expect(deck.undo().ok).toBe(true)
        } else if (scenario === "redo") {
          expect(deck.push([{ node: root, prop: "name", value: "Mine" }]).ok).toBe(true)
          expect(deck.undo().ok).toBe(true)
        }
        await deck.sync()
        phase = "queued"
        break
      case "Other":
        await other({ node: slide, prop: "name", value: "Other" })
        phase = "elsewhere"
        break
      case "OtherFill":
        await other({ node: original, prop: "fills", value: otherFill })
        phase = "sameProperty"
        break
      case "UpdateFirst":
        offline = false
        await deck.sync()
        phase = "updatedFirst"
        break
      case "DeleteFirst":
        secondOffline = false
        await second.sync()
        phase = "deletedFirst"
        break
      case "FinishDeleteRace":
        offline = false
        secondOffline = false
        await deck.sync()
        await second.sync()
        phase = "settled"
        break
      case "Invert":
        offline = false
        await deck.sync()
        phase = phase === "sameProperty" ? "settledOverFill" : "settled"
        break
      case "Rebuild":
        offline = false
        await deck.sync()
        phase = "settled"
        break
      case "TryEmpty": {
        const answer = await shared.edit({
          deck: deck.deck,
          edit: { once: "empty", author: person, writes: [], readBase: base },
        })
        empty = answer.ok ? "accepted" : answer.refusal === "edit" ? answer.refused : answer.refusal
        phase = "settled"
        break
      }
      case "Redo":
        deck.redo()
        await deck.sync()
        phase = "redone"
        break
      default:
        throw new Error(`Unknown action ${action}`)
    }
  }
  const saved = await shared.open({ deck: deck.deck })
  if (!saved.ok) throw new Error(JSON.stringify(saved))
  const fold = saved.fold
  const watched = scenario === "dependent" ? bar(fold, "b") : original
  const fill = watched === undefined ? undefined : doom.propOf(fold.nodes.get(watched), "fills")
  return {
    scenario,
    phase,
    empty,
    head: fold.rev - base,
    data: instance(fold)?.data.rows?.[0]?.value === 9 ? "changed" : "initial",
    fill: sameFill(fill, otherFill)
      ? "other"
      : sameFill(fill, localFill)
        ? "local"
        : sameFill(fill, color("accent3")) || (watched !== undefined && scenario === "dependent")
          ? "generated"
          : "initial",
    sameId: scenario !== "dependent" || phase !== "settled" || watched === newBar,
    suppressed:
      doom.parentOf(fold.nodes.get(original)) === null &&
      (instance(fold)?.suppressed.some(({ key }) => key[0] === "bar" && key[1] === "a") ?? false),
    named: doom.deckName(fold) === "Mine",
    notice: deck.notices().length + second.notices().length > 0,
  }
}

it.each([
  { scenario: "dependent", actions: ["Other", "Rebuild"], expected: { head: 3, sameId: true, fill: "local" } },
  { scenario: "undo", actions: ["Other", "Invert"], expected: { head: 3, data: "initial", fill: "initial" } },
  { scenario: "undo", actions: ["OtherFill", "Invert"], expected: { head: 3, data: "initial", fill: "other" } },
  {
    scenario: "delete",
    actions: ["UpdateFirst", "FinishDeleteRace"],
    expected: { head: 2, data: "changed", suppressed: true },
  },
  {
    scenario: "delete",
    actions: ["DeleteFirst", "FinishDeleteRace"],
    expected: { head: 2, data: "changed", suppressed: true },
  },
  { scenario: "empty", actions: ["TryEmpty"], expected: { head: 0, empty: "accepted" } },
  { scenario: "empty", actions: ["Other", "TryEmpty"], expected: { head: 1, empty: "stale" } },
  { scenario: "redo", actions: ["Other", "Rebuild", "Redo"], expected: { head: 5, named: true } },
])("keeps the round-two $scenario behavior through $actions", async ({ scenario, actions, expected }) => {
  expect(await replay(scenario, ["Plan", ...actions])).toMatchObject({ ...expected, notice: false })
})

const agent: doom.Author = { kind: "agent", id: "agent", run: "linked-run" }
const measure = doom.measureWith({})
const dataFor = (ids: string) => ({
  rows: [...ids].map((id) => ({ id, label: id.toUpperCase(), value: id === "a" ? 4 : 8 })),
})

async function suppressionReplay(graph: Graph, path: readonly Edge[]) {
  const shared = memoryDoomRemote(start)
  let offline = false
  let sending: Promise<void> | undefined
  let release: (() => void) | undefined
  let stale = 0
  const local: DoomRemote = {
    ...shared,
    async edit(body) {
      if (offline) throw new TypeError("offline")
      if (body.edit.runUndo !== undefined) await sending
      const answer = await shared.edit(body)
      if (!answer.ok && answer.refusal === "edit" && answer.refused === "stale") stale += 1
      return answer
    },
  }
  const opened = await createDoomDeck(local, "suppression-replay", { storage: memoryStorage() })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  const { deck } = opened
  const saved = async () => {
    const result = await shared.open({ deck: deck.deck })
    if (!result.ok) throw new Error(JSON.stringify(result))
    return result.fold
  }
  const send = async (edit: doom.Edit) => {
    const answer = await shared.edit({ deck: deck.deck, edit })
    if (!answer.ok) throw new Error(JSON.stringify(answer))
    return answer
  }
  const place = doom.placeComponent(await saved(), doom.columnDefinition, {
    frame,
    parent: { id: slide, at },
    box: { x: 20, y: 30, w: 1200, h: 600, flipH: false, flipV: false, rotation: 0 },
    data: dataFor("ab"),
    measure,
  })
  if (doom.isRefusal(place)) throw new Error(JSON.stringify(place))
  await send({ author: person, once: "place", readBase: deck.view().rev, writes: place })
  await deck.catchUp()
  for (const [i, edge] of path.entries()) {
    const before = graph.states.get(edge.from)!
    const after = graph.states.get(edge.to)!
    if (edge.action !== "Rebuild" && offline) {
      offline = false
      await deck.sync()
    }
    switch (edge.action) {
      case "Update":
      case "Rebuild": {
        const fold = await saved()
        const update = doom.regenerateComponent(fold, frame, { data: dataFor(String(after.rows)) }, measure)
        if (doom.isRefusal(update)) throw new Error(JSON.stringify(update))
        await send({ author: person, once: "data-" + i, writes: update.writes, readBase: fold.rev })
        if (edge.action === "Rebuild") {
          if (!offline || deck.pending().length !== 1) throw new Error("Expected one offline undo to rebuild")
          const previous = stale
          offline = false
          await deck.sync()
          expect(stale).toBe(previous + 1)
        } else {
          await deck.catchUp()
        }
        break
      }
      case "Delete": {
        const byPerson =
          before.person === 0 && typeof after.person === "number" && after.person <= 2 && after.person > 0
        const node = bar(deck.view(), (byPerson ? after.person : after.agent) === 1 ? "a" : "b")
        if (node === undefined) throw new Error("Missing bar to delete")
        const writes = [{ node, prop: "parent", value: null }] satisfies readonly doom.Write[]
        if (byPerson) {
          expect(deck.push(writes).ok).toBe(true)
          await deck.sync()
        } else {
          await send({ author: agent, once: "agent-delete", phase: "start", writes })
          await deck.catchUp()
        }
        break
      }
      case "PersonUndo":
        offline = after.queued === true
        expect(deck.undo().ok).toBe(after.queued)
        await deck.sync()
        break
      case "AgentUndo": {
        const fold = await saved()
        const log = await shared.run?.({ deck: deck.deck, run: agent.run! })
        if (log === undefined || !log.ok) throw new Error(JSON.stringify(log))
        const read = doom.readRunEdit(log.edits[0], log.replaced[0], fold)
        if (doom.isRefusal(read)) throw new Error(JSON.stringify(read))
        const undone = doom.invertRun(fold, [read])
        expect(undone.left).toEqual([])
        expect(undone.writes.length > 0).toBe(before.agent === 1 || before.agent === 2)
        if (undone.writes.length > 0) {
          await send({
            author: agent,
            once: "agent-undo",
            runUndo: { run: agent.run!, undone: true },
            writes: undone.writes,
            readBase: fold.rev,
          })
          await deck.catchUp()
        }
        break
      }
      case "ChangeInputs": {
        const patch = { data: dataFor(String(after.rows)) }
        if (before.mode === "person") {
          expect(deck.regenerate(frame, patch).ok).toBe(true)
          await deck.sync()
        } else {
          const fold = await saved()
          const update = doom.regenerateComponent(fold, frame, patch, measure)
          if (doom.isRefusal(update)) throw new Error(JSON.stringify(update))
          await send({ author: agent, once: "agent-update", phase: "start", writes: update.writes, readBase: fold.rev })
          await deck.catchUp()
        }
        break
      }
      case "SuppressBar": {
        const node = bar(await saved(), Number(after.hidden) - Number(before.hidden) === 1 ? "a" : "b")
        if (node === undefined) throw new Error("Missing bar to suppress")
        await send({ author: person, once: "suppress-" + i, writes: [{ node, prop: "parent", value: null }] })
        await deck.catchUp()
        break
      }
      case "OverwriteInputs": {
        const fold = await saved()
        const update = doom.regenerateComponent(fold, frame, { data: dataFor(String(after.rows)) }, measure)
        if (doom.isRefusal(update)) throw new Error(JSON.stringify(update))
        await send({ author: person, once: "overwrite", writes: update.writes, readBase: fold.rev })
        await deck.catchUp()
        break
      }
      case "UndoUpdate":
        expect(deck.undo().ok).toBe(before.rows === "ba")
        await deck.sync()
        break
      case "QueueUndoRun":
        sending = new Promise((resolve) => {
          release = resolve
        })
        expect((await deck.undoRun(agent.run!)).ok).toBe(true)
        break
      case "RaceRun":
        await send({ author: person, once: "rename", writes: [{ node: slide, prop: "name", value: "Raced" }] })
        break
      case "UndoRun": {
        release?.()
        const previous = stale
        await deck.sync()
        expect(stale - previous).toBe(before.raced || before.rows === "a" ? 1 : 0)
        expect((await saved()).runs.get(agent.run!)?.undone).toBe(before.rows === "ba")
        break
      }
      case "Redo":
        expect(deck.redo().ok).toBe(before.redo === 1 || before.redo === 2)
        await deck.sync()
        break
      default:
        throw new Error("Unknown action " + edge.action)
    }
    const fold = offline ? deck.view() : await saved()
    const current = instance(fold)
    expect(current?.data.rows?.map(({ id }) => id).join("")).toBe(after.rows)
    const suppressed = current?.suppressed.map(({ key }) => key.join("/")).sort()
    const mask = Number(after.hidden)
    expect(suppressed).toEqual([...(mask % 2 ? ["bar/a"] : []), ...(mask >= 2 ? ["bar/b"] : [])])
    expect(current?.parts.filter(({ key }) => key[0] === "bar").map(({ key }) => key[1])).toEqual(
      [...String(after.rows)].filter((id) => !suppressed?.includes("bar/" + id)),
    )
    expect(deck.notices()).toEqual([])
  }
  release?.()
  await deck.sync()
}

it("replays every reachable linked suppression transition through the device and remote", async () => {
  const topic = topics(process.cwd()).find((topic: { name: string }) => topic.name === "linked-instance")
  if (topic === undefined) throw new Error("no linked-instance spec")
  const [dump] = await dumpTopics([topic])
  if (dump === undefined) throw new Error("no graph")
  const graph = parseDot(dump.graph)
  const initial = [...graph.states].filter(
    ([, state]) =>
      state.rows === "ab" && state.person === 0 && state.agent === 0 && state.update === "none" && !state.rebuilt,
  )
  expect(initial).toHaveLength(3)
  const paths = new Map<string, Edge[]>(initial.map(([id]) => [id, []]))
  const outgoing = new Map<string, Edge[]>()
  for (const edge of graph.edges) {
    const edges = outgoing.get(edge.from) ?? []
    edges.push(edge)
    outgoing.set(edge.from, edges)
  }
  let checked = 0
  let rebuiltRedo = 0
  for (const [id, path] of paths) {
    for (const edge of outgoing.get(id) ?? []) {
      const route = [...path, edge]
      try {
        await suppressionReplay(graph, route)
      } catch (error) {
        const steps = route.map(({ action, to }) => action + " → " + view.state(graph.states.get(to)!))
        throw new Error(steps.join("\n"), { cause: error })
      }
      checked += 1
      if (edge.action === "Redo" && path.some(({ action }) => action === "Rebuild")) rebuiltRedo += 1
      if (!paths.has(edge.to)) paths.set(edge.to, route)
    }
  }
  expect(checked).toBe(graph.edges.length)
  expect(rebuiltRedo).toBeGreaterThan(0)
  expect(paths.size).toBe(graph.states.size)
  expect([...new Set(graph.edges.map(({ action }) => action))].sort()).toEqual([
    "AgentUndo",
    "ChangeInputs",
    "Delete",
    "OverwriteInputs",
    "PersonUndo",
    "QueueUndoRun",
    "RaceRun",
    "Rebuild",
    "Redo",
    "SuppressBar",
    "UndoRun",
    "UndoUpdate",
    "Update",
  ])
}, 180_000)
