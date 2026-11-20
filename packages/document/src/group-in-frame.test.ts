import { describe, expect, it } from "vitest"
import {
  decide,
  elementId,
  format,
  openRegister,
  planChange,
  readLayout,
  rebased,
  registerScope,
  shownPlace,
  type Box,
  type ElementId,
  type ElementPatch,
  type IndexElement,
  type Register,
  type SetChange,
} from "./index.js"

const free = elementId("256.20")
const freeBackdrop = elementId("256.21")
const held = elementId("256.22")
const leaf = elementId("256.23")
const beside = elementId("256.24")
const twin = elementId("256.25")
const auto = elementId("256.30")
const autoBackdrop = elementId("256.31")
const laid = elementId("256.32")
const laidLeaf = elementId("256.33")
const after = elementId("256.34")
const laidTwin = elementId("256.35")

const square = (x: number, y: number, side = 100): Box => ({ x, y, cx: side, cy: side })

function shape(node: ElementId, box: Box, parent: ElementId): IndexElement {
  return { node, kind: "shape", value: "", box, grouped: true, group: parent }
}

function framed(
  node: ElementId,
  backdrop: ElementId,
  box: Box,
  children: readonly ElementId[],
  flow: "none" | "horizontal",
) {
  return {
    node,
    kind: "group",
    value: null,
    box,
    grouped: false,
    frame: box,
    framing: { backdrop, children, layout: { flow, gap: 0, padding: [0, 0, 0, 0], align: "topLeft" } },
  } as const
}

const elements: readonly IndexElement[] = [
  framed(free, freeBackdrop, square(3000, 3000, 1000), [held, beside], "none"),
  shape(freeBackdrop, square(3000, 3000, 1000), free),
  {
    node: held,
    kind: "group",
    value: null,
    box: square(3100, 3100, 200),
    grouped: true,
    group: free,
    frame: square(0, 0),
  },
  shape(leaf, square(0, 0, 50), held),
  shape(twin, square(50, 50, 50), held),
  shape(beside, square(3500, 3000), free),
  framed(auto, autoBackdrop, { x: 5000, y: 0, cx: 300, cy: 200 }, [laid, after], "horizontal"),
  shape(autoBackdrop, { x: 5000, y: 0, cx: 300, cy: 200 }, auto),
  {
    node: laid,
    kind: "group",
    value: null,
    box: square(5000, 0, 200),
    grouped: true,
    group: auto,
    frame: square(0, 0, 200),
  },
  shape(laidLeaf, square(0, 0), laid),
  shape(laidTwin, square(100, 100), laid),
  shape(after, square(5200, 0), auto),
]

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    format: 2,
    total: elements.length,
    slides: [{ id: "256", position: 0, free: 40, animated: [] }],
    elements,
    pages: [],
  },
}

function landed(register: Register, node: ElementId, patch: ElementPatch): Register {
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
  const result = planChange(change, registerScope(register))
  if (!result.ok) throw new Error(JSON.stringify(result.refusals))
  return result.rows.reduce((current, { node, row }) => landed(current, node, row.patch), register)
}

const laidBox = (register: Register, frame: ElementId, node: ElementId) =>
  readLayout(register, frame)?.children.find((child) => child.node === node)?.box

describe("a layer inside a group inside a frame", () => {
  it("shows where it sits on the slide, through its group and the frame", () => {
    expect(shownPlace(indexed, leaf)?.box).toEqual(square(3100, 3100))
    expect(shownPlace(indexed, twin)?.box).toEqual(square(3200, 3200))
    expect(shownPlace(indexed, laidTwin)?.box).toEqual(square(5100, 100))
  })

  it("moves by its place on the slide, and in a frame without auto layout its group fits it where it was dropped", () => {
    const moved = planned({ target: { node: leaf }, box: { x: 3000 } })
    expect(shownPlace(moved, leaf)?.box).toEqual(square(3000, 3100))
    expect(shownPlace(moved, twin)?.box).toEqual(square(3200, 3200))
    expect(rebased(moved, held)?.frame).toEqual({ x: -50, y: 0, cx: 150, cy: 100 })
    expect(laidBox(moved, free, held)).toEqual({ x: 3000, y: 3100, cx: 300, cy: 200 })
    expect(laidBox(moved, free, beside)).toEqual(square(3500, 3000))
  })

  it("grows its group in an auto layout frame, which lays its layers out again", () => {
    const moved = planned({ target: { node: laidLeaf }, box: { x: 5300 } })
    expect(rebased(moved, laid)?.frame).toEqual({ x: 100, y: 0, cx: 300, cy: 200 })
    const group = laidBox(moved, auto, laid)
    expect(group).toEqual({ x: 5000, y: 0, cx: 300, cy: 200 })
    expect(laidBox(moved, auto, after)).toEqual(square(5300, 0))
    expect(shownPlace(moved, laidLeaf)?.box).toEqual(square(5200, 0))
    expect(shownPlace(moved, laidTwin)?.box).toEqual(square(5000, 100))
  })
})
