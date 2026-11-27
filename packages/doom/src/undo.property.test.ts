import fc from "fast-check"
import { expect, it } from "vitest"
import { applyEdit } from "./apply-edit.js"
import type { Author, Doom, Edit, Landed, Write } from "./doom.js"
import { doomFromTree } from "./doom-tree.js"
import { parentOf, propOf } from "./doom-walk.js"
import { foldToJson } from "./fold-json.js"
import { freeLineEnds } from "./freed-line-ends.js"
import { type NodeId, type Rev, nodeId, rev } from "./ids.js"
import { invert } from "./invert.js"
import { type RunEdit, invertRun, replacedBy } from "./invert-run.js"
import { lineEndsBack } from "./line-ends-back.js"
import { orderKeyBetween } from "./order-key.js"
import { type Refusal, isRefusal } from "./refusal.js"
import { onStandingLayers } from "./standing-layers.js"
import { measure, plainTheme, spot, words } from "./testing/doom-fixtures-art.js"
import { attached } from "./testing/line-end-fixtures.js"
import { type Pressed, type UndoBy, type Undoing, undo } from "./undo.js"
import { onTop } from "./view-of.js"

const tab: Author = { kind: "person", id: "tab" }
const other: Author = { kind: "person", id: "other" }
const agent: Author = { kind: "agent", id: "aira", run: "a" }

type Composed = { readonly after: Doom; readonly writes: readonly Write[]; readonly stays?: object } | Refusal

const envelope = (by: UndoBy, writes: readonly Write[]): Edit => ({
  once: by.once,
  author: by.author,
  writes,
  ...(by.readBase === undefined ? {} : { readBase: by.readBase }),
  ...(by.runUndo === undefined ? {} : { runUndo: by.runUndo }),
})

const shownOn = (fold: Doom, edit: Edit) => applyEdit(fold, { ...onTop(fold, edit), rev: rev(fold.rev + 1) })

function sentTo(fold: Doom, edit: Edit) {
  const stamped = onTop(fold, edit).writes
  const writes = edit.writes.map((write, at) => (write.base === undefined ? stamped[at]! : write))
  return applyEdit(fold, { ...edit, writes, rev: rev(fold.rev + 1) })
}

function stepBefore(fold: Doom, before: Doom, step: Landed, by: UndoBy): Composed {
  const writes = invert(before, fold, step, by.owned)
  if (writes.length === 0) return { after: fold, writes }
  const freed = freeLineEnds(fold, writes, by.measure, fold, before)
  const after = shownOn(fold, envelope(by, freed))
  return isRefusal(after) ? after : { after, writes: freed }
}

function runBefore(fold: Doom, edits: readonly RunEdit[], started: Doom | undefined, by: UndoBy): Composed {
  const { writes, ...stays } = invertRun(fold, edits, by.owned, started)
  if (writes.length === 0) return { after: fold, writes, stays }
  const freed = freeLineEnds(fold, writes, by.measure)
  const after = shownOn(fold, envelope(by, freed))
  return isRefusal(after) ? after : { after, writes: freed, stays }
}

function pressedBefore(server: Doom, turn: readonly Write[], pressed: Omit<Pressed, "writes">, by: UndoBy): Composed {
  const kept = turn.flatMap((write) => {
    const at = server.revs.get(write.node)?.get(write.prop)
    const theirs = at !== undefined && at > pressed.since && !by.owned.has(at) && (write.base ?? 0) < at
    if (!theirs) return [write]
    if (write.prop !== "geometry") return []
    const now = propOf(server.nodes.get(write.node), "geometry")
    const ends = lineEndsBack(write.value, now, pressed.lines.get(write.node))
    return ends === undefined ? [] : [{ ...write, value: ends, base: at }]
  })
  const writes = freeLineEnds(
    server,
    onStandingLayers(server, kept, pressed.since, pressed.since, pressed.measuredIn),
    by.measure,
  )
  if (writes.length === 0) return { after: server, writes }
  const after = sentTo(server, envelope(by, writes))
  return isRefusal(after) ? after : { after, writes }
}

function sameAs(composed: Composed, undone: Undoing | Refusal, stays = false) {
  if (isRefusal(composed) || isRefusal(undone)) {
    expect(undone).toEqual(composed)
    return
  }
  expect(undone.edit.writes).toEqual(composed.writes)
  expect(foldToJson(undone.after)).toEqual(foldToJson(composed.after))
  if (stays) expect({ kept: undone.kept, left: undone.left, waiting: undone.waiting }).toEqual(composed.stays)
}

const grown = doomFromTree({
  theme: plainTheme,
  name: "Board pack",
  slides: [
    {
      children: [
        { type: "shape", name: "title", props: { role: "title", box: spot(80, 60, 900, 120), text: words("Plan") } },
        { type: "shape", name: "t", props: { box: spot(300, 300, 100, 50) } },
        { type: "shape", name: "u", props: { box: spot(600, 400, 100, 50) } },
        {
          type: "frame",
          name: "j",
          props: { box: spot(100, 100, 400, 200) },
          children: [{ type: "shape", name: "l", props: attached }],
        },
        { type: "frame", name: "k", props: { box: spot(900, 300, 300, 200) } },
      ],
    },
    { name: "two", children: [{ type: "shape", name: "v", props: { box: spot(80, 60, 200, 100) } }] },
  ],
})

const node = (name: string) => grown.ids[name]!
const [first, second] = grown.slides as [NodeId, NodeId]
const into = (parent: NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const write = (id: NodeId, prop: string, value: unknown): Write => ({ node: id, prop: prop as never, value })
const line = (start: unknown, x: number) => ({
  kind: "line" as const,
  start,
  end: { x, y: 10 },
  route: "straight" as const,
  arrows: ["none", "none"] as const,
})

const added = fc.nat(5).map((at) => nodeId(`r:${String(at)}`))
const row = parentOf(grown.doom.nodes.get(first))!.id

const oneWrite: fc.Arbitrary<readonly Write[]> = fc.oneof(
  fc
    .tuple(fc.constantFrom("t", "u", "j", "k", "v"), fc.integer({ min: 0, max: 1500 }))
    .map(([name, x]) => [write(node(name), "box", spot(x, 300, 100, 50))]),
  fc.constantFrom("t", "u", "j", "k", "l", "v", "title").map((name) => [write(node(name), "parent", null)]),
  fc
    .tuple(fc.constantFrom("t", "u", "l", "v"), fc.constantFrom("j", "k"))
    .map(([name, frame]) => [write(node(name), "parent", into(node(frame)))]),
  fc.constantFrom("t", "u").map((name) => [write(node(name), "parent", into(second))]),
  fc.constantFrom("t", "u").map((name) => [write(node(name), "parent", into(first))]),
  fc.constantFrom("Plan", "Q3 board update", "").map((chars) => [write(node("title"), "text", words(chars))]),
  fc.constantFrom("Board pack", "Plan").map((name) => [write(grown.edit.writes[0]!.node, "name", name)]),
  fc
    .tuple(fc.constantFrom({ node: node("t"), site: "r" }, { node: node("u"), site: "l" }, { x: 5, y: 5 }), fc.nat(300))
    .map(([start, x]) => [write(node("l"), "geometry", line(start, x))]),
  fc.constantFrom(first, second).map((slide) => [write(slide, "parent", null)]),
  added.map((id) => [write(id, "type", "slide"), write(id, "parent", into(row))]),
  fc
    .tuple(added, fc.integer({ min: 0, max: 900 }), fc.constantFrom(first, node("j"), node("k")))
    .map(([id, x, parent]) => [
      write(id, "type", "shape"),
      write(id, "parent", into(parent)),
      write(id, "box", spot(x, 200, 80, 40)),
    ]),
)

type Act =
  | { readonly by: "tab" | "turn" | "other" | "run"; readonly writes: readonly Write[] }
  | { readonly press: true }

const acts: fc.Arbitrary<readonly Act[]> = fc.array(
  fc.oneof(
    {
      weight: 6,
      arbitrary: fc
        .tuple(
          fc.constantFrom("tab", "turn", "other", "run" as const),
          fc.array(oneWrite, { minLength: 1, maxLength: 3 }),
        )
        .map(([by, batch]): Act => ({ by, writes: batch.flat() })),
    },
    { weight: 1, arbitrary: fc.constant<Act>({ press: true }) },
  ),
  { minLength: 2, maxLength: 9 },
)

type Step = { readonly before: Doom; readonly edit: Landed }
type Press = { readonly turn: readonly Write[]; readonly pressed: Omit<Pressed, "writes"> }

type World = {
  fold: Doom
  readonly steps: Step[]
  readonly runLog: RunEdit[]
  started: Doom | undefined
  readonly turns: Set<Rev>
  readonly presses: Press[]
}

function press(world: World, stripped: boolean) {
  const step = world.steps.at(-1)
  if (step === undefined) return
  const writes = invert(step.before, world.fold, step.edit, world.turns)
  const turn = stripped ? writes.map(({ base: _base, ...rest }) => rest) : writes
  world.presses.push({
    turn,
    pressed: {
      since: world.fold.rev,
      measuredIn: new Map(turn.map(({ node }) => [node, parentOf(world.fold.nodes.get(node))?.id ?? null])),
      lines: new Map(
        turn.flatMap(({ node, prop }) =>
          prop === "geometry" ? [[node, propOf(world.fold.nodes.get(node), "geometry")]] : [],
        ),
      ),
    },
  })
}

function act(world: World, each: Act, index: number, stripped: boolean) {
  if ("press" in each) return press(world, stripped)
  const author = each.by === "run" ? agent : each.by === "other" ? other : tab
  const phase = each.by === "run" && world.started === undefined ? ({ phase: "start" } as const) : {}
  const edit: Landed = {
    once: `o-${String(index)}`,
    author,
    writes: each.writes,
    ...phase,
    rev: rev(world.fold.rev + 1),
  }
  const landed = { ...(each.by === "run" ? edit : onTop(world.fold, edit)), rev: edit.rev }
  const after = applyEdit(world.fold, landed)
  if (isRefusal(after)) return
  if (each.by === "tab") world.steps.push({ before: world.fold, edit: landed })
  if (each.by === "turn") world.turns.add(landed.rev)
  if (each.by === "run") {
    if (world.started === undefined) world.started = world.fold
    world.runLog.push({ ...landed, replaced: replacedBy(world.fold, landed) })
  }
  world.fold = after
}

const seen = { steps: 0, runs: 0, presses: 0, freed: 0, refused: 0, stays: 0, ends: 0, trimmed: 0 }

it("takes back a step, a run or a pressed turn exactly as the editor, the agent and the replay composed it", () => {
  fc.assert(
    fc.property(acts, fc.boolean(), fc.nat(9), (list, stripped, pick) => {
      const world: World = {
        fold: grown.doom,
        steps: [],
        runLog: [],
        started: undefined,
        turns: new Set(),
        presses: [],
      }
      list.forEach((each, index) => act(world, each, index, stripped))
      const { fold } = world
      const by: UndoBy = { author: tab, once: "undo", measure, owned: world.turns }
      const step = world.steps[pick % Math.max(1, world.steps.length)]
      if (step !== undefined) {
        const undone = undo(fold, { step: step.edit, before: step.before }, { ...by, readBase: fold.rev })
        sameAs(stepBefore(fold, step.before, step.edit, { ...by, readBase: fold.rev }), undone)
        seen.steps += 1
        if (isRefusal(undone)) seen.refused += 1
        if (!isRefusal(undone) && undone.edit.writes.length > invert(step.before, fold, step.edit, by.owned).length)
          seen.freed += 1
      }
      if (world.runLog.length > 0) {
        const runBy = { ...by, runUndo: { run: "a", undone: true } }
        const undone = undo(fold, { run: world.runLog, started: world.started }, runBy)
        sameAs(runBefore(fold, world.runLog, world.started, runBy), undone, true)
        seen.runs += 1
        if (isRefusal(undone)) seen.refused += 1
        if (!isRefusal(undone) && undone.kept.length + undone.left.length + undone.waiting.length > 0) seen.stays += 1
      }
      for (const { turn, pressed } of world.presses) {
        const undone = undo(fold, { pressed: { ...pressed, writes: turn } }, by)
        sameAs(pressedBefore(fold, turn, pressed, by), undone)
        seen.presses += 1
        if (isRefusal(undone)) seen.refused += 1
        if (!isRefusal(undone) && undone.edit.writes.length < turn.length) seen.trimmed += 1
        if (!isRefusal(undone) && undone.edit.writes.some((each) => each.prop === "geometry" && !turn.includes(each)))
          seen.ends += 1
      }
    }),
    { numRuns: 1500 },
  )
  expect(seen.steps).toBeGreaterThan(0)
  expect(seen.runs).toBeGreaterThan(0)
  expect(seen.presses).toBeGreaterThan(0)
  expect(seen.freed).toBeGreaterThan(0)
  expect(seen.refused).toBeGreaterThan(0)
  expect(seen.stays).toBeGreaterThan(0)
  expect(seen.ends).toBeGreaterThan(0)
  expect(seen.trimmed).toBeGreaterThan(0)
})
