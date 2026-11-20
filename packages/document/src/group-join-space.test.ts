import { describe, expect, it } from "vitest"
import {
  changeLayout,
  decide,
  elementGone,
  elementId,
  groupedNow,
  groupParent,
  openRegister,
  placeOf,
  readLayout,
  rebased,
  redoOf,
  shownPlace,
  slideId,
  spotNow,
  undoOf,
  type Box,
  type Command,
  type ElementId,
  type IndexElement,
  type Place,
  type Register,
  type Undoable,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const loose = elementId("256.2")
const scaled = elementId("256.4")
const first = elementId("256.5")
const second = elementId("256.6")
const turned = elementId("256.8")
const inTurned = elementId("256.9")
const flipped = elementId("256.10")
const inFlipped = elementId("256.11")
const outer = elementId("256.12")
const inner = elementId("256.13")
const leaf = elementId("256.14")
const twin = elementId("256.15")
const beside = elementId("256.16")
const made = elementId("256.20")
const madeLeft = elementId("256.21")
const madeRight = elementId("256.22")
const frame = elementId("256.30")
const backdrop = elementId("256.31")
const framed = elementId("256.32")

const square = (x: number, y: number, side = 100): Box => ({ x, y, cx: side, cy: side })

function shape(node: ElementId, box: Box, parent?: ElementId): IndexElement {
  return { node, kind: "shape", value: "", box, grouped: parent !== undefined, ...(parent ? { group: parent } : {}) }
}

function group(node: ElementId, box: Box, space: Box, parent?: ElementId, design?: IndexElement["design"]) {
  const placed = parent === undefined ? { grouped: false } : { grouped: true, group: parent }
  return { node, kind: "group", value: null, box, frame: space, ...placed, ...(design ? { design } : {}) } as const
}

const elements: readonly IndexElement[] = [
  shape(loose, { x: 100, y: 100, cx: 200, cy: 100 }),
  group(scaled, { x: 1000, y: 1000, cx: 400, cy: 200 }, { x: 0, y: 0, cx: 200, cy: 100 }),
  shape(first, square(0, 0), scaled),
  shape(second, square(100, 0), scaled),
  group(turned, square(3000, 0), square(0, 0), undefined, { "box.rot": [90] }),
  shape(inTurned, square(0, 0), turned),
  group(flipped, { x: 4000, y: 0, cx: 200, cy: 100 }, { x: 0, y: 0, cx: 200, cy: 100 }, undefined, {
    "box.flipH": [true],
  }),
  shape(inFlipped, square(0, 0), flipped),
  group(outer, { x: 0, y: 2000, cx: 2000, cy: 1000 }, { x: 0, y: 0, cx: 1000, cy: 500 }),
  group(inner, { x: 500, y: 250, cx: 200, cy: 100 }, { x: 0, y: 0, cx: 100, cy: 50 }, outer),
  shape(leaf, square(0, 0, 50), inner),
  shape(twin, square(50, 0, 50), inner),
  shape(beside, square(0, 0), outer),
  group(made, { x: 6000, y: 0, cx: 300, cy: 100 }, { x: 6000, y: 0, cx: 300, cy: 100 }),
  shape(madeLeft, square(6000, 0), made),
  shape(madeRight, square(6200, 0), made),
  {
    ...group(frame, square(8000, 0, 400), square(8000, 0, 400)),
    framing: {
      backdrop,
      children: [framed],
      layout: { flow: "none", gap: 0, padding: [0, 0, 0, 0], align: "topLeft" },
    },
  },
  shape(backdrop, square(8000, 0, 400), frame),
  shape(framed, square(8100, 100), frame),
]

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    total: elements.length,
    slides: [{ id: "256", position: 0, free: 40, animated: [] }],
    elements,
    pages: [{ once: "page", offset: 0, count: elements.length }],
  },
}

function ran(register: Register, commands: readonly Command[]): Register {
  let current = register
  for (const command of commands) {
    const node = command.command === "person" ? command.node : undefined
    if (node !== undefined && !current.nodes.includes(node)) {
      const opened = decide(current, { command: "add", node, floor: "", route: "" })
      if (opened.decision !== "apply") throw new Error(opened.code)
      current = opened.register
    }
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    current = decision.register
  }
  return current
}

function moved(register: Register, node: ElementId, into: ElementId | null): readonly Command[] | null {
  const changed = changeLayout(register, { move: node, frame: into, before: null, file })
  return changed === null || !("turn" in changed) ? null : changed.turn
}

type Step = { readonly after: Register; readonly undoable: Undoable }

function dragged(register: Register, node: ElementId, into: ElementId | null): Step {
  const was = spotNow(register, node)
  const turn = moved(register, node, into)
  if (was === null || turn === null) throw new Error(`${node} does not move into ${into ?? "the slide"}`)
  const undoable: Undoable = { joined: node, slide, file, before: was, after: { ...was, frame: into, before: null } }
  return { after: ran(register, turn), undoable }
}

function undone(step: Step): Register {
  const back = undoOf(step.after, step.undoable)
  if (!back.ok) throw new Error("undo")
  return ran(step.after, back.commands)
}

function near(place: Place | null, wanted: Place | null) {
  expect(place?.rot).toBe(wanted?.rot)
  expect(place?.flipH).toBe(wanted?.flipH)
  expect(place?.flipV).toBe(wanted?.flipV)
  for (const side of ["x", "y", "cx", "cy"] as const)
    expect(Math.abs((place?.box[side] ?? Number.NaN) - (wanted?.box[side] ?? Number.NaN))).toBeLessThanOrEqual(1)
}

describe("a group that loses its last layer", () => {
  it("deletes itself when its last layer is dragged out, and the layer stays where it shows", () => {
    const one = dragged(indexed, first, null).after
    const shown = shownPlace(one, second)
    const two = dragged(one, second, null).after
    expect(elementGone(two, scaled)).toBe(true)
    expect(groupedNow(two, second)).toBe(false)
    near(shownPlace(two, second), shown)
  })

  it("puts the group and its layer back with one Undo, and the Redo deletes it again", () => {
    const one = dragged(indexed, first, null).after
    const step = dragged(one, second, null)
    const back = undone(step)
    expect(elementGone(back, scaled)).toBe(false)
    expect(groupParent(back, second)).toBe(scaled)
    expect(placeOf(back, second)?.box).toEqual(square(100, 0))
    near(shownPlace(back, second), shownPlace(one, second))
    near(shownPlace(back, scaled), shownPlace(one, scaled))
    const again = redoOf(back, step.undoable)
    if (!again.ok) throw new Error("redo")
    expect(elementGone(ran(back, again.commands), scaled)).toBe(true)
  })

  it("deletes a nested group it empties, and the group above fits the layers it still holds", () => {
    const one = dragged(indexed, leaf, null).after
    const two = dragged(one, twin, null).after
    expect(elementGone(two, inner)).toBe(true)
    expect(elementGone(two, outer)).toBe(false)
    near(shownPlace(two, outer), shownPlace(indexed, beside))
    near(shownPlace(two, beside), shownPlace(indexed, beside))
  })

  it("deletes every group above that the drag leaves empty", () => {
    const one = dragged(indexed, beside, null).after
    const two = dragged(one, leaf, null).after
    const three = dragged(two, twin, null).after
    expect(elementGone(three, inner)).toBe(true)
    expect(elementGone(three, outer)).toBe(true)
  })
})

describe("a layer dragged into or out of a turned, flipped or nested group", () => {
  it("keeps its place on the slide when it joins a turned group, which fits it", () => {
    const shown = shownPlace(indexed, loose)
    const after = dragged(indexed, loose, turned).after
    expect(groupParent(after, loose)).toBe(turned)
    expect(placeOf(after, loose)?.rot).toBe(16_200_000)
    near(shownPlace(after, loose), shown)
    near(shownPlace(after, inTurned), shownPlace(indexed, inTurned))
    expect(shownPlace(after, turned)?.rot).toBe(5_400_000)
  })

  it("keeps its place on the slide when it joins a flipped group", () => {
    const shown = shownPlace(indexed, loose)
    const after = dragged(indexed, loose, flipped).after
    expect(placeOf(after, loose)?.flipH).toBe(true)
    near(shownPlace(after, loose), shown)
    near(shownPlace(after, inFlipped), shownPlace(indexed, inFlipped))
  })

  it("keeps its turn on the slide when it leaves a turned group", () => {
    const shown = shownPlace(indexed, inTurned)
    const step = dragged(indexed, inTurned, null)
    expect(groupParent(step.after, inTurned)).toBeNull()
    near(shownPlace(step.after, inTurned), shown)
    near(placeOf(undone(step), inTurned), placeOf(indexed, inTurned))
  })

  it("joins a group two levels down, and both groups fit their layers", () => {
    const shown = shownPlace(indexed, loose)
    const after = dragged(indexed, loose, inner).after
    expect(groupParent(after, loose)).toBe(inner)
    near(shownPlace(after, loose), shown)
    for (const kept of [leaf, twin, beside]) near(shownPlace(after, kept), shownPlace(indexed, kept))
    const bounds = shownPlace(after, outer)?.box
    expect(bounds).toEqual({ x: 0, y: 100, cx: 1400, cy: 2600 })
    expect(rebased(after, outer)).not.toBeNull()
  })

  it("leaves a group two levels down for the slide, and both groups shrink to the layers left", () => {
    const shown = shownPlace(indexed, leaf)
    const step = dragged(indexed, leaf, null)
    near(shownPlace(step.after, leaf), shown)
    near(shownPlace(step.after, inner), shownPlace(indexed, twin))
    near(shownPlace(step.after, twin), shownPlace(indexed, twin))
    near(shownPlace(undone(step), leaf), shown)
  })

  it("moves a layer from one nested group to another and keeps it in place", () => {
    const shown = shownPlace(indexed, first)
    const after = dragged(indexed, first, inner).after
    near(shownPlace(after, first), shown)
    near(shownPlace(after, second), shownPlace(indexed, second))
  })
})

describe("a frame dragged into a group", () => {
  it("joins a group whose space is the slide's, and keeps itself and its layers in place", () => {
    const step = dragged(indexed, frame, made)
    expect(groupParent(step.after, frame)).toBe(made)
    expect(placeOf(step.after, frame)?.box).toEqual(square(8000, 0, 400))
    expect(shownPlace(step.after, made)?.box).toEqual({ x: 6000, y: 0, cx: 2400, cy: 400 })
    expect(readLayout(step.after, frame)?.children.find((child) => child.node === framed)?.box).toEqual(
      square(8100, 100),
    )
    expect(groupParent(undone(step), frame)).toBeNull()
  })

  it("refuses a group that scales, turns or flips its layers, where a frame cannot keep its look", () => {
    expect(moved(indexed, frame, scaled)).toBeNull()
    expect(moved(indexed, frame, turned)).toBeNull()
    expect(moved(indexed, frame, flipped)).toBeNull()
  })
})
