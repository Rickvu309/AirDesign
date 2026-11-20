import { describe, expect, it } from "vitest"
import {
  decide,
  elementId,
  format,
  openRegister,
  planChange,
  registerScope,
  slideId,
  groupOf,
  slideUndoable,
  throughGroup,
  undoSlides,
  undoOf,
  ungroupTurn,
  type Box,
  type ElementPatch,
  type IndexElement,
  type Place,
  type Register,
  type Command,
  type SetChange,
} from "./index.js"
import { joinTurn } from "./group-join.js"
import { intoGroup, rebased, shownPlace, storedPlace } from "./group-space.js"

const group = elementId("256.4")
const first = elementId("256.5")
const second = elementId("256.6")
const outer = elementId("256.10")
const inner = elementId("256.11")
const leaf = elementId("256.12")
const twin = elementId("256.13")
const beside = elementId("256.14")
const frame = elementId("256.20")
const backdrop = elementId("256.21")
const framedGroup = elementId("256.22")
const framedLeaf = elementId("256.23")
const lost = elementId("256.30")
const left = elementId("256.50")
const right = elementId("256.51")

const square = (x: number, y: number, side = 100): Box => ({ x, y, cx: side, cy: side })

function shape(node: typeof group, box: Box, parent?: typeof group): IndexElement {
  return { node, kind: "shape", value: "", box, grouped: parent !== undefined, ...(parent ? { group: parent } : {}) }
}

const elements: readonly IndexElement[] = [
  {
    node: group,
    kind: "group",
    value: null,
    box: { x: 1000, y: 1000, cx: 400, cy: 200 },
    grouped: false,
    frame: { x: 0, y: 0, cx: 200, cy: 100 },
  },
  shape(first, square(0, 0), group),
  shape(second, square(100, 0), group),
  {
    node: outer,
    kind: "group",
    value: null,
    box: { x: 0, y: 0, cx: 2000, cy: 1000 },
    grouped: false,
    frame: { x: 0, y: 0, cx: 1000, cy: 500 },
  },
  {
    node: inner,
    kind: "group",
    value: null,
    box: { x: 500, y: 250, cx: 200, cy: 100 },
    grouped: true,
    group: outer,
    frame: { x: 0, y: 0, cx: 100, cy: 50 },
  },
  shape(leaf, square(0, 0, 50), inner),
  shape(twin, square(50, 0, 50), inner),
  shape(beside, square(0, 0, 100), outer),
  {
    node: frame,
    kind: "group",
    value: null,
    box: square(3000, 3000, 1000),
    grouped: false,
    frame: square(3000, 3000, 1000),
    framing: {
      backdrop,
      children: [framedGroup],
      layout: { flow: "none", gap: 0, padding: [0, 0, 0, 0], align: "topLeft" },
    },
  },
  shape(backdrop, square(3000, 3000, 1000), frame),
  {
    node: framedGroup,
    kind: "group",
    value: null,
    box: square(3100, 3100, 200),
    grouped: true,
    group: frame,
    frame: square(3100, 3100, 200),
  },
  shape(framedLeaf, square(3100, 3100), framedGroup),
  { node: lost, kind: "shape", value: "", box: square(0, 0), grouped: true },
  shape(left, square(5000, 5000)),
  shape(right, square(5200, 5000)),
]

const indexed: Register = {
  ...openRegister("", "deck"),
  index: {
    format: 2,
    total: elements.length,
    slides: [{ id: "256", position: 0, free: 40, animated: [] }],
    elements,
    pages: [],
  },
}

function plan(change: SetChange, register: Register = indexed) {
  return planChange(change, registerScope(register))
}

function landed(register: Register, node: typeof group, patch: ElementPatch): Register {
  let current = register
  if (!current.nodes.includes(node)) {
    const opened = decide(current, { command: "add", node, floor: "", route: "" })
    if (opened.decision !== "apply") throw new Error(opened.code)
    current = opened.register
  }
  const decision = decide(current, { command: "person", node, v: format, patch })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function planned(change: SetChange, register: Register = indexed): Register {
  const result = plan(change, register)
  if (!result.ok) throw new Error(JSON.stringify(result.refusals))
  return result.rows.reduce((current, { node, row }) => landed(current, node, row.patch), register)
}

function ran(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    if (command.command === "person" && command.v !== undefined && command.node !== undefined)
      return landed(current, command.node, command.patch)
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    return decision.register
  }, register)
}

function near(place: Place | null, wanted: Place) {
  expect(place?.rot).toBe(wanted.rot)
  expect(place?.flipH).toBe(wanted.flipH)
  expect(place?.flipV).toBe(wanted.flipV)
  for (const side of ["x", "y", "cx", "cy"] as const)
    expect(Math.abs((place?.box[side] ?? Number.NaN) - wanted.box[side])).toBeLessThanOrEqual(1)
}

const flat = (box: Box): Place => ({ box, rot: 0, flipH: false, flipV: false })

describe("a layer inside a group", () => {
  it("turns a place on the slide back into its group's child space", () => {
    const turnedGroup: Place = {
      box: { x: 1000, y: 1000, cx: 400, cy: 200 },
      rot: 1_800_000,
      flipH: true,
      flipV: false,
    }
    const child: Place = { box: { x: 40, y: 20, cx: 50, cy: 30 }, rot: 600_000, flipH: false, flipV: true }
    const space = { x: 0, y: 0, cx: 200, cy: 100 }
    near(intoGroup(throughGroup(child, turnedGroup, space), turnedGroup, space), child)
  })

  it("shows a grouped layer where it sits on the slide, through a scaled group", () => {
    expect(shownPlace(indexed, first)).toEqual(flat({ x: 1000, y: 1000, cx: 200, cy: 200 }))
    expect(registerScope(indexed).view(first)?.box).toEqual({ x: 1000, y: 1000, cx: 200, cy: 200 })
    expect(shownPlace(indexed, leaf)).toEqual(flat({ x: 1000, y: 500, cx: 200, cy: 200 }))
  })

  it("moves a grouped layer by its place on the slide and stores the move in the group's child space", () => {
    expect(plan({ target: { node: first }, box: { x: 1100 } })).toEqual({
      ok: true,
      rows: [
        {
          node: first,
          row: { v: format, patch: { box: { x: { set: 50 }, y: { set: 0 }, w: { set: 100 }, h: { set: 100 } } } },
        },
      ],
    })
    const moved = planned({ target: { node: first }, box: { x: 1100 } })
    expect(shownPlace(moved, first)?.box).toEqual({ x: 1100, y: 1000, cx: 200, cy: 200 })
    expect(registerScope(moved).view(first)?.box).toEqual({ x: 1100, y: 1000, cx: 200, cy: 200 })
  })

  it("fits the group's bounds to its layers and keeps every other layer in place", () => {
    expect(rebased(indexed, group)).toBeNull()
    const moved = planned({ target: { node: first }, box: { x: 1600 } })
    expect(rebased(moved, group)).toEqual({
      frame: { x: 100, y: 0, cx: 300, cy: 100 },
      place: flat({ x: 1200, y: 1000, cx: 600, cy: 200 }),
    })
    expect(shownPlace(moved, group)?.box).toEqual({ x: 1200, y: 1000, cx: 600, cy: 200 })
    expect(shownPlace(moved, second)).toEqual(shownPlace(indexed, second))
  })

  it("follows up every group above a moved layer, and leaves the layers beside it where they were", () => {
    const moved = planned({ target: { node: leaf }, box: { x: 3000, y: 3000 } })
    expect(shownPlace(moved, leaf)?.box).toEqual({ x: 3000, y: 3000, cx: 200, cy: 200 })
    expect(rebased(moved, inner)).not.toBeNull()
    expect(rebased(moved, outer)).not.toBeNull()
    expect(shownPlace(moved, twin)).toEqual(shownPlace(indexed, twin))
    expect(shownPlace(moved, beside)).toEqual(shownPlace(indexed, beside))
    const bounds = shownPlace(moved, outer)?.box
    expect(bounds).toEqual({ x: 0, y: 0, cx: 3200, cy: 3200 })
  })

  it("moves a group whose bounds follow its layers by its shown box, and its layers move with it", () => {
    const moved = planned({ target: { node: first }, box: { x: 1600 } })
    const before = shownPlace(moved, group)
    const shifted = planned({ target: { node: group }, box: { x: (before?.box.x ?? 0) + 500 } }, moved)
    expect(shownPlace(shifted, group)?.box).toEqual({ ...before?.box, x: (before?.box.x ?? 0) + 500 })
    expect(shownPlace(shifted, second)?.box.x).toBe((shownPlace(moved, second)?.box.x ?? 0) + 500)
  })

  it("turns a grouped layer by its angle on the slide", () => {
    const turnedGroup = landed(indexed, group, { box: { rot: { set: 1_800_000 } } })
    expect(shownPlace(turnedGroup, first)?.rot).toBe(1_800_000)
    const turned = planned({ target: { node: first }, box: { rot: 2_700_000 } }, turnedGroup)
    expect(shownPlace(turned, first)?.rot).toBe(2_700_000)
    near(storedPlace(turned, first, shownPlace(turned, first)!), { ...flat(square(0, 0)), rot: 900_000 })
  })

  it("refuses a box change where the group's place is unknown, and moves a layer whose group a frame holds", () => {
    const refused = (node: typeof group) => plan({ target: { node }, box: { x: 1 } })
    expect(refused(lost)).toEqual({ ok: false, refusals: [{ node: lost, trait: "box", code: "group-box" }] })
    expect(shownPlace(planned({ target: { node: framedLeaf }, box: { x: 3000 } }), framedLeaf)?.box.x).toBe(3000)
  })

  it("ungroups a moved layer where it shows, and puts it back inside its group on undo", () => {
    const moved = planned({ target: { node: first }, box: { x: 1600 } })
    const file = [slideId("256")]
    const edit = { slide: "element-ungroup", id: slideId("256"), node: group } as const
    const after = ran(moved, ungroupTurn(moved, file, slideId("256"), group) ?? [])
    expect(shownPlace(after, first)).toEqual(shownPlace(moved, first))
    const undone = undoOf(after, slideUndoable(moved, file, edit)!)
    if (!undone.ok) throw new Error("undo")
    const back = ran(after, undone.commands)
    near(shownPlace(back, first), shownPlace(moved, first)!)
    expect(shownPlace(back, second)).toEqual(shownPlace(moved, second))
    const untouched = ran(indexed, ungroupTurn(indexed, file, slideId("256"), group) ?? [])
    const home = undoOf(untouched, slideUndoable(indexed, file, edit)!)
    if (!home.ok) throw new Error("undo")
    expect(rebased(ran(untouched, home.commands), group)).toBeNull()
  })

  it("keeps an agent's group when its run is undone after the person moved a layer inside it", () => {
    const made = elementId("256.40")
    const command = groupOf(indexed, slideId("256"), made, [left, right])
    if (command === null) throw new Error("group")
    const grouped = ran(indexed, [{ command: "slide", file: [slideId("256")], edit: { ...command, runId: "run" } }])
    expect(undoSlides(grouped, "run")).not.toBeNull()
    const shown = shownPlace(grouped, left)
    const moved = planned({ target: { node: left }, box: { x: (shown?.box.x ?? 0) + 1000 } }, grouped)
    expect(undoSlides(moved, "run")).toBeNull()
  })

  it("fits the bounds to a turned layer as it shows in a group scaled more one way than the other", () => {
    const tall = elementId("256.60")
    const leaf = elementId("256.61")
    const other = elementId("256.62")
    const space = { x: 0, y: 0, cx: 1000, cy: 1000 }
    const wide: IndexElement = {
      node: tall,
      kind: "group",
      value: null,
      box: { x: 0, y: 0, cx: 500, cy: 2000 },
      grouped: false,
      frame: space,
    }
    const register: Register = {
      ...indexed,
      index: {
        ...indexed.index!,
        total: elements.length + 3,
        elements: [...elements, wide, shape(leaf, square(0, 0, 200), tall), shape(other, square(800, 800, 200), tall)],
      },
    }
    const moved = planned({ target: { node: leaf }, box: { rot: 2_700_000 } }, register)
    const shown = [shownPlace(moved, leaf)!, shownPlace(moved, other)!]
    const reach = shown.map(({ box, rot }) => {
      const radians = (rot / 60_000) * (Math.PI / 180)
      const halfX = (box.cx * Math.abs(Math.cos(radians)) + box.cy * Math.abs(Math.sin(radians))) / 2
      const halfY = (box.cx * Math.abs(Math.sin(radians)) + box.cy * Math.abs(Math.cos(radians))) / 2
      return [
        box.x + box.cx / 2 - halfX,
        box.y + box.cy / 2 - halfY,
        box.x + box.cx / 2 + halfX,
        box.y + box.cy / 2 + halfY,
      ]
    })
    const fitted = shownPlace(moved, tall)!.box
    expect(Math.abs(fitted.x - Math.min(...reach.map((side) => side[0]!)))).toBeLessThanOrEqual(2)
    expect(Math.abs(fitted.y - Math.min(...reach.map((side) => side[1]!)))).toBeLessThanOrEqual(2)
    expect(Math.abs(fitted.x + fitted.cx - Math.max(...reach.map((side) => side[2]!)))).toBeLessThanOrEqual(2)
    expect(Math.abs(fitted.y + fitted.cy - Math.max(...reach.map((side) => side[3]!)))).toBeLessThanOrEqual(2)
  })

  it("keeps a layer moved on the slide where it was dropped when it joins a scaled group", () => {
    const moved = landed(indexed, left, {
      box: { x: { set: 1200 }, y: { set: 1300 }, w: { set: 100 }, h: { set: 100 } },
    })
    const spot = { frame: group, before: null, box: { x: 1200, y: 1300, cx: 100, cy: 100 } }
    const joined = ran(moved, joinTurn(moved, [slideId("256")], left, spot) ?? [])
    near(shownPlace(joined, left), flat(spot.box))
    expect(shownPlace(joined, first)).toEqual(shownPlace(moved, first))
  })
})
