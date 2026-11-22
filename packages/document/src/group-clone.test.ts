import { describe, expect, it } from "vitest"
import {
  changeLayout,
  cloneOf,
  decide,
  elementGone,
  elementId,
  elementsUndoable,
  groupParent,
  nextElementId,
  openRegister,
  readLayout,
  readSlideState,
  rebased,
  shownPlace,
  slideId,
  undoOf,
  type Box,
  type ElementId,
  type IndexElement,
  type Place,
  type Register,
  type SlideCommand,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const scaled = elementId("256.4")
const first = elementId("256.5")
const second = elementId("256.6")
const outer = elementId("256.12")
const inner = elementId("256.13")
const leaf = elementId("256.14")
const twin = elementId("256.15")
const beside = elementId("256.16")
const loose = elementId("256.17")
const holder = elementId("256.18")
const keptFrame = elementId("256.19")
const square = (x: number, y: number, side = 100): Box => ({ x, y, cx: side, cy: side })

function shape(node: ElementId, box: Box, parent?: ElementId): IndexElement {
  return { node, kind: "shape", value: "", box, grouped: parent !== undefined, ...(parent ? { group: parent } : {}) }
}

function group(node: ElementId, box: Box, space: Box, parent?: ElementId, design?: IndexElement["design"]) {
  const placed = parent === undefined ? { grouped: false } : { grouped: true, group: parent }
  return { node, kind: "group", value: null, box, frame: space, ...placed, ...(design ? { design } : {}) } as const
}

const elements: readonly IndexElement[] = [
  group(scaled, { x: 1000, y: 1000, cx: 400, cy: 200 }, { x: 0, y: 0, cx: 200, cy: 100 }),
  shape(first, square(0, 0), scaled),
  shape(second, square(100, 0), scaled),
  group(outer, { x: 0, y: 2000, cx: 2000, cy: 1000 }, { x: 0, y: 0, cx: 1000, cy: 500 }, undefined, {
    "box.rot": [30],
  }),
  group(inner, { x: 500, y: 250, cx: 200, cy: 100 }, { x: 0, y: 0, cx: 100, cy: 50 }, outer, { "box.flipH": [true] }),
  shape(leaf, square(0, 0, 50), inner),
  shape(twin, square(50, 0, 50), inner),
  shape(beside, square(0, 0), outer),
  shape(loose, square(5000, 0)),
  group(holder, square(7000, 0, 200), square(7000, 0, 200)),
  { node: keptFrame, kind: "kept", value: null, box: square(7000, 0, 200), grouped: true, group: holder },
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

function applied(register: Register, edit: SlideCommand): Register {
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function near(place: Place | null, wanted: Place | null) {
  expect(place?.rot).toBe(wanted?.rot)
  expect([place?.flipH, place?.flipV]).toEqual([wanted?.flipH, wanted?.flipV])
  for (const side of ["x", "y", "cx", "cy"] as const)
    expect(Math.abs((place?.box[side] ?? Number.NaN) - (wanted?.box[side] ?? Number.NaN))).toBeLessThanOrEqual(1)
}

const moved = (place: Place | null, x: number, y: number): Place | null =>
  place === null ? null : { ...place, box: { ...place.box, x: place.box.x + x, y: place.box.y + y } }

function copiedTo(register: Register, source: ElementId, x: number, y: number) {
  const node = nextElementId(register, slide, 40)
  const shown = shownPlace(register, source)?.box ?? readLayout(register, source)?.box
  if (shown === undefined) throw new Error("shown")
  const made = cloneOf(register, source, node, { ...shown, x: shown.x + x, y: shown.y + y })
  if (!made.ok) throw new Error(made.refusal)
  return { node, command: made.command, after: applied(register, made.command) }
}

function copyOf(command: SlideCommand, source: ElementId): ElementId {
  if (command.slide !== "element-clone") throw new Error("clone")
  const layer = command.layers?.find((each) => each.source === source)
  if (layer === undefined) throw new Error(`no copy of ${source}`)
  return layer.element.node
}

describe("a copy of a group, a frame or a layer inside a group", () => {
  it("copies a group and its layers with new ids, offset on the slide by the distance it is given", () => {
    const { node, command, after } = copiedTo(indexed, scaled, 3000, 500)
    expect(command.slide === "element-clone" ? command.layers?.map((layer) => layer.source) : []).toEqual([
      first,
      second,
    ])
    for (const source of [first, second]) {
      const copy = copyOf(command, source)
      expect(groupParent(after, copy)).toBe(node)
      near(shownPlace(after, copy), moved(shownPlace(indexed, source), 3000, 500))
    }
    near(shownPlace(after, node), moved(shownPlace(indexed, scaled), 3000, 500))
    expect(nextElementId(after, slide, 40)).toBe(elementId("256.43"))
  })

  it("copies a turned group holding a flipped group, and every layer of the copy shows where its source does", () => {
    const { command, after } = copiedTo(indexed, outer, 0, 3000)
    for (const source of [inner, leaf, twin, beside])
      near(shownPlace(after, copyOf(command, source)), moved(shownPlace(indexed, source), 0, 3000))
  })

  it("copies a layer inside a group just above it in the same group, and the group fits the copy", () => {
    const { node, after } = copiedTo(indexed, leaf, 0, 600)
    expect(groupParent(after, node)).toBe(inner)
    near(shownPlace(after, node), moved(shownPlace(indexed, leaf), 0, 600))
    near(shownPlace(after, leaf), shownPlace(indexed, leaf))
    expect(rebased(after, inner)).not.toBeNull()
    expect(rebased(after, outer)).not.toBeNull()
  })

  it("copies a frame with its backdrop and layers, laid out where its own are, offset", () => {
    const framed = changeLayout(indexed, {
      wrap: [loose],
      slide,
      node: elementId("256.30"),
      backdrop: elementId("256.31"),
    })
    if (framed === null || !("slide" in framed)) throw new Error("wrap")
    const wrapped = applied(indexed, framed.slide)
    const frame = elementId("256.30")
    const { node, command, after } = copiedTo(wrapped, frame, 0, 1000)
    const source = readLayout(wrapped, frame)
    const copy = readLayout(after, node)
    expect(copy?.box).toEqual({ ...source?.box, y: (source?.box.y ?? 0) + 1000 })
    expect(copy?.flow).toBe(source?.flow)
    expect(copy?.backdrop).toBe(copyOf(command, elementId("256.31")))
    expect(copy?.children.map((child) => child.box)).toEqual(
      source?.children.map((child) => ({ ...child.box, y: child.box.y + 1000 })),
    )
  })

  it("removes the copy and every layer in it with one Undo, and keeps the source", () => {
    const { node, command, after } = copiedTo(indexed, scaled, 3000, 0)
    if (command.slide !== "element-clone") throw new Error("clone")
    const undoable = elementsUndoable(indexed, file, [command])
    if (undoable === null) throw new Error("undoable")
    const back = undoOf(after, undoable)
    if (!back.ok) throw new Error("undo")
    const undone = back.commands.reduce((register, each) => {
      const decision = decide(register, each)
      if (decision.decision !== "apply") throw new Error(decision.code)
      return decision.register
    }, after)
    for (const copy of [node, ...(command.layers ?? []).map((layer) => layer.element.node)])
      expect(elementGone(undone, copy)).toBe(true)
    expect(elementGone(undone, first)).toBe(false)
  })

  it("stores a group copy and reads it back", () => {
    const { command } = copiedTo(indexed, outer, 0, 3000)
    const stored = JSON.parse(JSON.stringify({ file, order: [command] })) as unknown
    expect(readSlideState(stored)?.order).toEqual([command])
  })

  it("refuses a group holding a kept frame, a copy that leaves a layer out, and a layer inside a frame", () => {
    expect(cloneOf(indexed, holder, elementId("256.40"), square(0, 0, 200))).toEqual({ ok: false, refusal: "kind" })
    const { command } = copiedTo(indexed, scaled, 3000, 0)
    if (command.slide !== "element-clone") throw new Error("clone")
    const partial = { ...command, layers: (command.layers ?? []).slice(0, 1) }
    expect(decide(indexed, { command: "slide", file, edit: partial }).decision).toBe("refuse")
    const framed = changeLayout(indexed, {
      wrap: [loose],
      slide,
      node: elementId("256.30"),
      backdrop: elementId("256.31"),
    })
    if (framed === null || !("slide" in framed)) throw new Error("wrap")
    const wrapped = applied(indexed, framed.slide)
    expect(cloneOf(wrapped, loose, elementId("256.40"), square(0, 0))).toEqual({ ok: false, refusal: "group-box" })
  })
})
