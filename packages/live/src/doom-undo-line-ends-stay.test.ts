import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const [deckNode, row, slide, later, shape, joint, home, line, group, knot, frameTwo] = [
  "g:1",
  "g:2",
  "g:3",
  "g:4",
  "g:5",
  "g:6",
  "g:7",
  "g:8",
  "g:9",
  "g:10",
  "g:11",
].map(id) as [
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
]
const first = orderKeyBetween(null, null)
const at = (parent: doom.NodeId) => ({ id: parent, at: first })
const boxAt = (x: number, y: number) => ({ x, y, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })
const lineOf = (start: unknown, end: unknown = { x: 10, y: 10 }) => ({
  kind: "line",
  start,
  end,
  route: "straight",
  arrows: ["none", "none"],
})
const words = { chars: "a long paragraph", spans: [], paras: [{}], style: "body", resize: "height", alignV: "top" }
const attached = { node: shape, site: "r" }

type Holder = "slide" | "group" | "knot"
const origin = (shapeIn: Holder, extra: readonly doom.Write[]): doom.Edit => ({
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckNode, prop: "type", value: "deck" },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deckNode) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    { node: later, prop: "type", value: "slide" },
    { node: later, prop: "parent", value: { id: row, at: orderKeyBetween(first, null) } },
    { node: group, prop: "type", value: "frame" },
    { node: group, prop: "parent", value: at(slide) },
    { node: group, prop: "box", value: boxAt(200, 200) },
    { node: knot, prop: "type", value: "frame" },
    { node: knot, prop: "parent", value: at(slide) },
    { node: knot, prop: "box", value: boxAt(250, 250) },
    { node: frameTwo, prop: "type", value: "frame" },
    { node: frameTwo, prop: "parent", value: at(later) },
    { node: frameTwo, prop: "box", value: boxAt(0, 0) },
    { node: shape, prop: "type", value: "shape" },
    { node: shape, prop: "parent", value: at({ slide, group, knot }[shapeIn]) },
    { node: shape, prop: "box", value: boxAt(300, 300) },
    { node: joint, prop: "type", value: "frame" },
    { node: joint, prop: "parent", value: at(slide) },
    { node: joint, prop: "box", value: boxAt(100, 100) },
    { node: home, prop: "type", value: "frame" },
    { node: home, prop: "parent", value: at(slide) },
    { node: home, prop: "box", value: boxAt(500, 0) },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: at(joint) },
    { node: line, prop: "box", value: boxAt(0, 0) },
    { node: line, prop: "geometry", value: lineOf(attached) },
    ...extra,
  ],
})

const geometryOf = (view: doom.Doom) => doom.propOf(view.nodes.get(line), "geometry")
const freeAt = (x: number, y: number): doom.Write[] => [
  { node: line, prop: "parent", value: at(home) },
  { node: line, prop: "geometry", value: lineOf({ x, y }) },
]
const deleted = (node: doom.NodeId): doom.Write => ({ node, prop: "parent", value: null })
const hidden = (node: doom.NodeId, value = true): doom.Write => ({ node, prop: "hidden", value })

async function openTabs(start: doom.Edit) {
  const remote = memoryDoomRemote(start)
  const join = async (client: string, how: "create" | "open") => {
    let next = 0
    const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "stay", {
      once: () => `${client}-${(next += 1)}`,
      client,
      storage: memoryStorage(),
      pause: () => Promise.resolve(),
    })
    if (!opened.ok) throw new Error(JSON.stringify(opened))
    return opened.deck
  }
  const mine = await join("a", "create")
  const theirs = await join("b", "open")
  const fromTheirs = async (writes: readonly doom.Write[]) => {
    await mine.sync()
    await theirs.catchUp()
    expect(theirs.push(writes).ok).toBe(true)
    await theirs.sync()
    await mine.catchUp()
  }
  return { remote, mine, theirs, fromTheirs }
}

async function undoneRun(start: doom.Edit, steps: readonly doom.Write[], then: readonly doom.Write[]) {
  const { remote, mine } = await openTabs(start)
  const author = { kind: "agent" as const, id: "aira", run: "run-1" }
  for (const edit of [
    { once: "r1", author, phase: "start" as const, writes: steps },
    { once: "r2", author, phase: "stop" as const, writes: [] },
  ])
    expect((await remote.edit({ deck: "stay", edit })).ok).toBe(true)
  await mine.catchUp()
  expect(mine.push([...then]).ok).toBe(true)
  const kept = geometryOf(mine.view())
  await mine.undoRun("run-1")
  return { kept, now: geometryOf(mine.view()) }
}

async function undoneStep(start: doom.Edit, steps: readonly doom.Write[], then: readonly doom.Write[]) {
  const { mine, fromTheirs } = await openTabs(start)
  expect(mine.push([...steps]).ok).toBe(true)
  await fromTheirs(then)
  const kept = geometryOf(mine.view())
  mine.undo()
  return { kept, now: geometryOf(mine.view()) }
}

const freed = (x = 60, y = 40) => freeAt(x, y)

describe("an undo that leaves a line in place keeps both of its ends where they are", () => {
  const byRun: readonly (readonly [
    string,
    Holder,
    readonly doom.Write[],
    readonly doom.Write[],
    readonly doom.Write[],
  ])[] = [
    ["R, a run frees the start; J and T deleted", "slide", [], freed(), [deleted(joint), deleted(shape)]],
    ["RH, T hidden", "slide", [], freed(), [deleted(joint), hidden(shape)]],
    [
      "RS, T on the next slide",
      "slide",
      [],
      freed(),
      [deleted(joint), { node: shape, prop: "parent", value: at(later) }],
    ],
    ["A, a run moves and frees; J and T deleted", "slide", [], freeAt(5, 5), [deleted(joint), deleted(shape)]],
    [
      "B, J deleted and T moved",
      "slide",
      [],
      freeAt(5, 5),
      [deleted(joint), { node: shape, prop: "box", value: boxAt(50, 400) }],
    ],
    ["X1, T hidden then shown", "slide", [], freed(), [deleted(joint), hidden(shape), hidden(shape, false)]],
    ["X2, T in a hidden group", "group", [], freed(), [deleted(joint), hidden(group)]],
    [
      "X3, T in a moved frame",
      "knot",
      [],
      freed(),
      [deleted(joint), { node: knot, prop: "box", value: boxAt(600, 400) }],
    ],
    [
      "X4, the line moved to the next slide",
      "slide",
      [],
      freed(),
      [deleted(joint), { node: line, prop: "parent", value: at(frameTwo) }],
    ],
    [
      "X5, T taken out of a group that is then hidden",
      "group",
      [],
      [{ node: shape, prop: "parent", value: at(slide) }, ...freed()],
      [deleted(joint), hidden(group)],
    ],
    [
      "X6, T taken out of a frame that then goes to the next slide",
      "knot",
      [],
      [{ node: shape, prop: "parent", value: at(slide) }, ...freed()],
      [deleted(joint), { node: knot, prop: "parent", value: at(later) }],
    ],
    ["X7, the run hides T", "slide", [], [hidden(shape), ...freed()], [deleted(joint)]],
    [
      "X8, the run moves the line to the next slide",
      "slide",
      [],
      [
        { node: line, prop: "parent", value: at(frameTwo) },
        { node: line, prop: "geometry", value: lineOf({ x: 60, y: 40 }) },
      ],
      [deleted(joint)],
    ],
    [
      "M1, T is sized by its words",
      "slide",
      [{ node: shape, prop: "text", value: words }],
      freeAt(-100, 325),
      [deleted(joint)],
    ],
  ]
  for (const [name, shapeIn, extra, steps, then] of byRun)
    it(`${name}: Undo on the run`, async () => {
      const { kept, now } = await undoneRun(origin(shapeIn, extra), steps, then)
      expect(now).toEqual(kept)
    })

  const byStep: readonly (readonly [string, readonly doom.Write[], readonly doom.Write[]])[] = [
    ["AH, J deleted and T hidden", freeAt(5, 5), [deleted(joint), hidden(shape)]],
    [
      "AS, J deleted and T on the next slide",
      freeAt(5, 5),
      [deleted(joint), { node: shape, prop: "parent", value: at(later) }],
    ],
    [
      "C, the line moved by someone else and T deleted",
      [{ node: line, prop: "geometry", value: lineOf({ x: 5, y: 5 }) }],
      [{ node: line, prop: "parent", value: at(home) }, deleted(shape)],
    ],
  ]
  for (const [name, steps, then] of byStep)
    it(`${name}: Ctrl+Z`, async () => {
      const { kept, now } = await undoneStep(origin("slide", []), steps, then)
      expect(now).toEqual(kept)
    })

  it("A0, the line goes back into the frame it left, so it is not left in place and takes its attachment with it, as on main", async () => {
    const { now } = await undoneStep(origin("slide", []), freeAt(5, 5), [deleted(shape)])
    expect(now).toEqual(lineOf(attached))
  })

  it("X5P, Ctrl+Z after T was taken out of a group that is then hidden", async () => {
    const { kept, now } = await undoneStep(
      origin("group", []),
      [...freed(), { node: shape, prop: "parent", value: at(slide) }],
      [deleted(joint), hidden(group)],
    )
    expect(now).toEqual(kept)
  })

  it("H0, a line whose shape is hidden or on the next slide with no undo at all keeps its attachment", async () => {
    const { mine } = await openTabs(origin("slide", []))
    mine.push([hidden(shape)])
    mine.push([hidden(shape, false), { node: shape, prop: "parent", value: at(later) }])
    expect(geometryOf(mine.view())).toEqual(lineOf(attached))
  })
})
