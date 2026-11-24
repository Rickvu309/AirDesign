import { describe, expect, it } from "vitest"
import { compiled, minter } from "./agent-fixtures.js"
import {
  type Author,
  type Doom,
  type Landed,
  type NodeId,
  type RunEdit,
  type Undone,
  type Write,
  applyEdit,
  invertRun,
  isRefusal,
  nodeId,
  replacedBy,
  rev,
} from "./index.js"
import {
  box,
  create,
  hex,
  ids,
  once,
  person,
  place,
  revOf,
  sampleDeck,
  textOf,
  theme,
  tryLand,
  valuesOf,
} from "./sample-deck.js"

const runA: Author = { kind: "agent", id: "aira", run: "a" }
const runB: Author = { kind: "agent", id: "claude", run: "b" }

type World = { readonly doom: Doom; readonly log: readonly RunEdit[]; readonly starts: ReadonlyMap<string, Doom> }

const opened = (doom: Doom = sampleDeck()): World => ({ doom, log: [], starts: new Map() })

function by(world: World, author: Author, writes: readonly Write[], phase?: "start" | "stop"): World {
  const edit: Landed = {
    once: once(),
    author,
    writes,
    ...(phase === undefined ? {} : { phase }),
    rev: rev(world.doom.rev + 1),
  }
  const after = applyEdit(world.doom, edit)
  if (isRefusal(after)) throw new Error(`refused ${JSON.stringify(after)}`)
  const starts =
    phase === "start" && author.run !== undefined ? new Map(world.starts).set(author.run, world.doom) : world.starts
  return { doom: after, log: [...world.log, { ...edit, replaced: replacedBy(world.doom, edit) }], starts }
}

const run = (world: World, author: Author, writes: readonly Write[]) =>
  by(world, author, writes, world.starts.has(author.run!) ? undefined : "start")

const undoRun = (world: World, name: string): Undone =>
  invertRun(
    world.doom,
    world.log.filter((edit) => edit.author.run === name),
  )

function undo(world: World, name = "a"): { readonly world: World; readonly kept: readonly NodeId[] } {
  const undone = undoRun(world, name)
  if (undone.writes.length === 0) return { world, kept: undone.kept }
  return { world: by(world, person, undone.writes), kept: undone.kept }
}

const nodeOf = (world: World, id: NodeId) => world.doom.nodes.get(id) as unknown as Record<string, unknown>

describe("undoing a run, edit by edit from the values each write replaced", () => {
  it("puts back run b's write that run a wrote over, not the value from when run a started (T7)", () => {
    let world = run(opened(), runA, [{ node: ids.card, prop: "opacity", value: 0.5 }])
    world = run(world, runB, [{ node: ids.card, prop: "opacity", value: 0.3 }])
    world = run(world, runA, [{ node: ids.card, prop: "opacity", value: 0.7 }])
    const { world: undone } = undo(world)
    expect(nodeOf(undone, ids.card).opacity).toBe(0.3)
  })

  it("keeps a group the person moved after the run made it, with the layers in it (T8)", () => {
    let world = run(opened(), runA, compiled(sampleDeck(), { op: "wrap", nodes: [ids.card, ids.side] }, minter("g")))
    const group = nodeId("g:1")
    world = run(world, runA, [{ node: ids.slide, prop: "name", value: "Agent's name" }])
    const moved = { ...(nodeOf(world, group).box as object), x: 900 }
    world = by(world, person, [{ node: group, prop: "box", value: moved }])
    const { world: undone, kept } = undo(world)
    expect(kept).toEqual([group])
    expect(nodeOf(undone, ids.slide).name).toBe("Slide 1")
    expect(nodeOf(undone, group)).toMatchObject({ box: moved, parent: { id: ids.slide } })
    expect(undone.doom.children.get(group)).toEqual([ids.card, ids.side])
  })

  it("keeps a text layer the run added when the person typed in it since", () => {
    const made = nodeId("a:1")
    let world = run(opened(), runA, [
      ...create(made, "shape", ids.slide, { node: made, prop: "box", value: box(10) }),
      { node: made, prop: "text", value: textOf("Agent") },
      { node: ids.card, prop: "box", value: box(700) },
    ])
    world = by(world, person, [{ node: made, prop: "text", value: textOf("Mine"), base: world.doom.rev }])
    const { world: undone, kept } = undo(world)
    expect(kept).toEqual([made])
    expect(nodeOf(undone, made)).toMatchObject({ text: { chars: "Mine" }, parent: { id: ids.slide } })
    expect(nodeOf(undone, ids.card).box).toEqual(box(100))
  })

  it("keeps a frame the run added when the person moved their own layer into it", () => {
    const frame = nodeId("a:1")
    let world = run(opened(), runA, create(frame, "frame", ids.slide, { node: frame, prop: "box", value: box(10) }))
    world = by(world, person, [{ node: ids.side, prop: "parent", value: place(frame) }])
    const { world: undone, kept } = undo(world)
    expect(kept).toEqual([frame])
    expect(nodeOf(undone, ids.side).parent).toMatchObject({ id: frame })
  })

  it("keeps a frame the run added when another agent changed what is in it, so the note cannot say the person did", () => {
    const frame = nodeId("a:1")
    let world = run(opened(), runA, create(frame, "frame", ids.slide, { node: frame, prop: "box", value: box(10) }))
    world = run(world, runB, [{ node: ids.side, prop: "parent", value: place(frame) }])
    const undone = undoRun(world, "a")
    expect(undone.kept).toEqual([frame])
    expect(undone.left).toEqual([])
  })

  it("leaves a layer where it is when the frame it came from now sits inside it", () => {
    const inner = nodeId("t:10")
    let world = by(opened(), person, create(inner, "frame", ids.card))
    world = run(world, runA, [{ node: inner, prop: "parent", value: place(ids.slide) }])
    world = by(world, person, [{ node: ids.card, prop: "parent", value: place(inner) }])
    const undone = undoRun(world, "a")
    expect(undone.writes).toEqual([])
    expect(undone.left).toEqual([inner])
    expect(undone.waiting).toEqual([])
  })

  it("leaves a layer where it is, not waiting, when only a frame above its old frame was deleted", () => {
    const inner = nodeId("t:10")
    let world = by(opened(), person, [
      ...create(inner, "frame", ids.card),
      { node: ids.title, prop: "parent", value: place(inner) },
    ])
    world = run(world, runA, [{ node: ids.title, prop: "parent", value: place(ids.slide) }])
    world = by(world, person, [{ node: ids.card, prop: "parent", value: null }])
    const undone = undoRun(world, "a")
    expect(undone.writes).toEqual([])
    expect(undone.left).toEqual([ids.title])
    expect(undone.waiting).toEqual([])
  })

  it("leaves a layer where it is when the frame it came from, or a frame above that, was deleted since", () => {
    const inner = nodeId("t:10")
    let world = by(opened(), person, create(inner, "frame", ids.card))
    world = run(world, runA, [
      { node: ids.card, prop: "opacity", value: 0.5 },
      { node: ids.title, prop: "parent", value: place(ids.slide) },
      { node: inner, prop: "parent", value: place(ids.side) },
    ])
    world = by(world, person, [{ node: ids.card, prop: "parent", value: null }])
    const undone = undoRun(world, "a")
    expect(undone.writes).toEqual([])
    world = by(world, person, [{ node: ids.card, prop: "parent", value: place(ids.side) }])
    world = by(world, person, [{ node: ids.side, prop: "parent", value: null }])
    const { world: after } = undo(world)
    expect(nodeOf(after, ids.title).parent).toMatchObject({ id: ids.slide })
    expect(nodeOf(after, ids.card).opacity).toBeUndefined()
  })

  it("keeps the frame a run made while a layer it moved in stays there because the person deleted the frame it came from", () => {
    const wrap = nodeId("a:1")
    let world = run(opened(), runA, create(wrap, "frame", ids.slide, { node: wrap, prop: "box", value: box(10) }))
    world = run(world, runA, [{ node: ids.title, prop: "parent", value: place(wrap) }])
    world = by(world, person, [{ node: ids.card, prop: "parent", value: null }])
    expect(undoRun(world, "a").writes).toEqual([])
    expect(nodeOf(world, ids.title).parent).toMatchObject({ id: wrap })
  })

  it("puts back the colour and words of a layer a run moved, though the frame it came from was deleted since", () => {
    const red = [{ kind: "solid", color: hex(0xff0000) }]
    for (const edits of [
      [
        [
          { node: ids.title, prop: "parent", value: place(ids.side) },
          { node: ids.title, prop: "fills", value: red },
          { node: ids.title, prop: "text", value: textOf("ai"), base: revOf(sampleDeck(), ids.title, "text")! },
        ],
      ],
      [[{ node: ids.title, prop: "fills", value: red }], [{ node: ids.title, prop: "parent", value: place(ids.side) }]],
    ] as const) {
      let world = opened()
      for (const writes of edits) world = run(world, runA, writes as readonly Write[])
      world = by(world, person, [{ node: ids.card, prop: "parent", value: null }])
      expect(undoRun(world, "a").left).toEqual([ids.title])
      const { world: after } = undo(world)
      expect(nodeOf(after, ids.title).parent).toMatchObject({ id: ids.side })
      expect(nodeOf(after, ids.title).fills).toBeUndefined()
      expect(nodeOf(after, ids.title).text).toEqual(textOf("Revenue"))
    }
  })

  it("puts back a layer a run deleted from a frame deleted since, so it comes back with that frame", () => {
    let world = run(opened(), runA, [{ node: ids.title, prop: "parent", value: null }])
    const slot = (sampleDeck().nodes.get(ids.card) as { parent: unknown }).parent
    world = by(world, person, [{ node: ids.card, prop: "parent", value: null }])
    const { world: after } = undo(world)
    expect(nodeOf(after, ids.title).parent).toMatchObject({ id: ids.card })
    const back = by(after, person, [{ node: ids.card, prop: "parent", value: slot }])
    expect(back.doom.children.get(ids.card)).toEqual([ids.title])
  })

  it("names a layer a run deleted apart from the layers it leaves in place, while the frame it was in is deleted", () => {
    let world = run(opened(), runA, [
      { node: ids.title, prop: "parent", value: null },
      { node: ids.caption, prop: "parent", value: place(ids.slide) },
    ])
    world = by(world, person, [
      { node: ids.card, prop: "parent", value: null },
      { node: ids.side, prop: "parent", value: null },
    ])
    expect(undoRun(world, "a")).toMatchObject({ left: [ids.caption], waiting: [ids.title] })
  })

  it("takes back the whole run when nobody else touched it, and a second undo finds nothing", () => {
    const made = nodeId("a:1")
    let world = run(opened(), runA, create(made, "shape", ids.slide, { node: made, prop: "box", value: box(10) }))
    world = run(world, runA, [
      { node: ids.card, prop: "box", value: box(700) },
      { node: ids.title, prop: "parent", value: place(ids.slide) },
      { node: ids.card, prop: "parent", value: null },
    ])
    const { world: undone, kept } = undo(world)
    expect(kept).toEqual([])
    expect(valuesOf(undone.doom)).toEqual({ ...valuesOf(sampleDeck()), [made]: valuesOf(undone.doom)[made] })
    expect(nodeOf(undone, made).parent).toBeNull()
    expect(undoRun(undone, "a").writes).toEqual([])
  })

  it("restores theme variables one by one, keeping another run's later colour", () => {
    let world = run(opened(), runA, [
      { node: ids.deck, prop: "theme.colors.accent1", value: hex(0x111111) },
      { node: ids.deck, prop: "theme.colors.accent2", value: hex(0x222222) },
    ])
    world = run(world, runB, [{ node: ids.deck, prop: "theme.colors.accent2", value: hex(0x333333) }])
    world = run(world, runA, [{ node: ids.deck, prop: "theme.colors.accent2", value: hex(0x444444) }])
    const { world: undone } = undo(world)
    expect(nodeOf(undone, ids.deck).theme).toMatchObject({
      colors: { accent1: theme().colors.accent1, accent2: hex(0x333333) },
    })
  })

  it("bases each write on the rev it found, so a write that lands in between makes the undo stale", () => {
    let world = run(opened(), runA, [{ node: ids.card, prop: "opacity", value: 0.5 }])
    const writes = undoRun(world, "a").writes
    world = run(world, runB, [{ node: ids.card, prop: "opacity", value: 0.9 }])
    expect(tryLand(world.doom, writes)).toMatchObject({ refused: "stale" })
  })
})
