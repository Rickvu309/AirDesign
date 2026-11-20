import { describe, expect, it } from "vitest"
import {
  beforeOf,
  changeLayout,
  decide,
  elementId,
  fitFrameRows,
  fitFramesRows,
  format,
  landedPatch,
  openRegister,
  plainFrameTurn,
  readLayout,
  redoOf,
  slideId,
  undoOf,
  ungroupTurn,
  type Command,
  type ElementId,
  type ElementPatch,
  type IndexElement,
  type NodeStep,
  type PlacedRow,
  type Register,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const a = elementId("256.2")
const b = elementId("256.3")
const c = elementId("256.4")
const d = elementId("256.5")
const frame = elementId("256.20")
const backdrop = elementId("256.21")
const otherFrame = elementId("256.30")
const otherBackdrop = elementId("256.31")

const elements: readonly IndexElement[] = [
  { node: a, kind: "shape", value: "", box: { x: 100, y: 100, cx: 200, cy: 100 }, grouped: false },
  { node: b, kind: "shape", value: "", box: { x: 400, y: 180, cx: 100, cy: 120 }, grouped: false },
  { node: c, kind: "shape", value: "", box: { x: 700, y: 100, cx: 100, cy: 150 }, grouped: false },
  { node: d, kind: "shape", value: "", box: { x: 900, y: 200, cx: 80, cy: 80 }, grouped: false },
]

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    total: elements.length,
    slides: [{ id: "256", position: 0, free: 20, animated: [] }],
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

function set(register: Register, node: ElementId, patch: ElementPatch): Register {
  return ran(register, [{ command: "person", v: format, patch, node }])
}

function applyRows(register: Register, rows: readonly PlacedRow[]): { register: Register; steps: readonly NodeStep[] } {
  const steps: NodeStep[] = []
  let current = register
  for (const { node, patch } of rows) {
    const body = current.nodes.includes(node) ? current.elements[node] : undefined
    const before = beforeOf(body === undefined ? {} : landedPatch(body, "text"), patch)
    current = set(current, node, patch)
    steps.push({ node, before, after: patch })
  }
  return { register: current, steps }
}

function plainFramed(register: Register, node: ElementId, back: ElementId, members: readonly ElementId[]): Register {
  const turn = plainFrameTurn(register, file, slide, node, back, members)
  if (turn === null) throw new Error("plain frame")
  return ran(register, turn)
}

describe("resize frame to fit", () => {
  it("shrinks an oversized plain frame around its children, keeps children in place, and undoes in one step", () => {
    const framed = plainFramed(indexed, frame, backdrop, [a, b])
    const enlarged = set(
      set(set(framed, frame, { box: { x: { set: 40 }, y: { set: 30 }, w: { set: 700 }, h: { set: 480 } } }), a, {
        box: { x: { set: 60 }, y: { set: 70 } },
      }),
      b,
      { box: { x: { set: 360 }, y: { set: 150 } } },
    )
    expect(readLayout(enlarged, frame)?.box).toEqual({ x: 40, y: 30, cx: 700, cy: 480 })
    expect(readLayout(enlarged, frame)?.children).toEqual([
      { node: a, box: { x: 100, y: 100, cx: 200, cy: 100 } },
      { node: b, box: { x: 400, y: 180, cx: 100, cy: 120 } },
    ])

    const rows = fitFrameRows(enlarged, frame)
    if (rows === null) throw new Error("expected fit rows")
    const { register: fitted, steps } = applyRows(enlarged, rows)
    expect(readLayout(fitted, frame)?.box).toEqual({ x: 100, y: 100, cx: 400, cy: 200 })
    expect(readLayout(fitted, frame)?.children).toEqual([
      { node: a, box: { x: 100, y: 100, cx: 200, cy: 100 } },
      { node: b, box: { x: 400, y: 180, cx: 100, cy: 120 } },
    ])
    expect(fitFrameRows(fitted, frame)).toBeNull()

    const undone = undoOf(fitted, { steps })
    if (!undone.ok) throw new Error("undo")
    const back = ran(fitted, undone.commands)
    expect(readLayout(back, frame)?.box).toEqual({ x: 40, y: 30, cx: 700, cy: 480 })
    expect(readLayout(back, frame)?.children).toEqual([
      { node: a, box: { x: 100, y: 100, cx: 200, cy: 100 } },
      { node: b, box: { x: 400, y: 180, cx: 100, cy: 120 } },
    ])

    const redone = redoOf(back, { steps })
    if (!redone.ok) throw new Error("redo")
    const again = ran(back, redone.commands)
    expect(readLayout(again, frame)?.box).toEqual({ x: 100, y: 100, cx: 400, cy: 200 })
    expect(readLayout(again, frame)?.children).toEqual([
      { node: a, box: { x: 100, y: 100, cx: 200, cy: 100 } },
      { node: b, box: { x: 400, y: 180, cx: 100, cy: 120 } },
    ])
  })

  it("grows an undersized plain frame when a child sits outside its bounds", () => {
    const framed = plainFramed(indexed, frame, backdrop, [a, b])
    const moved = set(framed, b, { box: { x: { set: 520 }, y: { set: -40 } } })
    expect(readLayout(moved, frame)?.box).toEqual({ x: 100, y: 100, cx: 400, cy: 200 })
    expect(readLayout(moved, frame)?.children).toEqual([
      { node: a, box: { x: 100, y: 100, cx: 200, cy: 100 } },
      { node: b, box: { x: 620, y: 60, cx: 100, cy: 120 } },
    ])

    const rows = fitFrameRows(moved, frame)
    if (rows === null) throw new Error("expected fit rows")
    const { register: fitted } = applyRows(moved, rows)
    expect(readLayout(fitted, frame)?.box).toEqual({ x: 100, y: 60, cx: 620, cy: 140 })
    expect(readLayout(fitted, frame)?.children).toEqual([
      { node: a, box: { x: 100, y: 100, cx: 200, cy: 100 } },
      { node: b, box: { x: 620, y: 60, cx: 100, cy: 120 } },
    ])
  })

  it("uses rotated children's visual bounds when fitting a plain frame", () => {
    const rotated = set(indexed, a, { box: { rot: { set: 5_400_000 } } })
    const framed = plainFramed(rotated, frame, backdrop, [a])
    expect(readLayout(framed, frame)?.box).toEqual({ x: 150, y: 50, cx: 100, cy: 200 })
    const enlarged = set(framed, frame, { box: { x: { set: 100 }, y: { set: 20 }, w: { set: 360 }, h: { set: 360 } } })
    const shifted = set(enlarged, a, { box: { x: { set: 0 }, y: { set: 80 } } })
    expect(readLayout(shifted, frame)?.children).toEqual([{ node: a, box: { x: 100, y: 100, cx: 200, cy: 100 } }])
    const rows = fitFrameRows(shifted, frame)
    if (rows === null) throw new Error("expected fit rows")
    const { register: fitted } = applyRows(shifted, rows)
    expect(readLayout(fitted, frame)?.box).toEqual({ x: 150, y: 50, cx: 100, cy: 200 })
    expect(readLayout(fitted, frame)?.children).toEqual([{ node: a, box: { x: 100, y: 100, cx: 200, cy: 100 } }])
  })

  it("fits visible children without moving hidden children, and falls back to all children when all are hidden", () => {
    const framed = plainFramed(indexed, frame, backdrop, [a, b])
    const hidB = set(framed, b, { identity: { hidden: { set: true } } })
    const rows = fitFrameRows(hidB, frame)
    if (rows === null) throw new Error("expected fit rows")
    const { register: fitted } = applyRows(hidB, rows)
    expect(readLayout(fitted, frame)?.box).toEqual({ x: 100, y: 100, cx: 200, cy: 100 })
    expect(readLayout(fitted, frame)?.children).toEqual([
      { node: a, box: { x: 100, y: 100, cx: 200, cy: 100 } },
      { node: b, box: { x: 400, y: 180, cx: 100, cy: 120 } },
    ])

    const allHidden = set(fitted, a, { identity: { hidden: { set: true } } })
    const fallbackRows = fitFrameRows(allHidden, frame)
    if (fallbackRows === null) throw new Error("expected fallback fit rows")
    const { register: expanded } = applyRows(allHidden, fallbackRows)
    expect(readLayout(expanded, frame)?.box).toEqual({ x: 100, y: 100, cx: 400, cy: 200 })
  })

  it("returns null for non-frames, auto layout frames, ungrouped frames, and already-fitted frames", () => {
    expect(fitFrameRows(indexed, a)).toBeNull()
    const framed = plainFramed(indexed, frame, backdrop, [a, b])
    expect(fitFrameRows(framed, frame)).toBeNull()

    const wrapped = changeLayout(indexed, { wrap: [a, b], slide, node: frame, backdrop })
    if (wrapped === null || !("slide" in wrapped)) throw new Error("wrap")
    const auto = ran(indexed, [{ command: "slide", file, edit: wrapped.slide }])
    expect(fitFrameRows(auto, frame)).toBeNull()

    const ungrouped = ungroupTurn(framed, file, slide, frame)
    if (ungrouped === null) throw new Error("ungroup")
    expect(fitFrameRows(ran(framed, ungrouped), frame)).toBeNull()
  })

  it("fits multiple selected plain frames together and ignores non-fitting nodes", () => {
    const first = plainFramed(indexed, frame, backdrop, [a, b])
    const both = plainFramed(first, otherFrame, otherBackdrop, [c])
    const loose = set(set(both, frame, { box: { w: { set: 600 }, h: { set: 320 } } }), otherFrame, {
      box: { w: { set: 260 }, h: { set: 240 } },
    })
    const rows = fitFramesRows(loose, [frame, d, otherFrame])
    if (rows === null) throw new Error("expected multi-frame fit rows")
    const { register: fitted } = applyRows(loose, rows)
    expect(readLayout(fitted, frame)?.box).toEqual({ x: 100, y: 100, cx: 400, cy: 200 })
    expect(readLayout(fitted, otherFrame)?.box).toEqual({ x: 700, y: 100, cx: 100, cy: 150 })
    expect(fitFramesRows(fitted, [frame, otherFrame])).toBeNull()
  })
})
