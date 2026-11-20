import { describe, expect, it } from "vitest"
import {
  changeLayout,
  decide,
  elementGone,
  elementId,
  groupedNow,
  layoutNodes,
  openRegister,
  plainFrameTurn,
  readLayout,
  redoOf,
  slideId,
  slideUndoable,
  undoOf,
  ungroupTurn,
  type Command,
  type ElementId,
  type ElementPatch,
  type IndexElement,
  type Register,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const a = elementId("256.2")
const b = elementId("256.3")
const c = elementId("256.4")
const frame = elementId("256.20")
const backdrop = elementId("256.21")

const elements: readonly IndexElement[] = [
  { node: a, kind: "shape", value: "", box: { x: 100, y: 100, cx: 200, cy: 100 }, grouped: false },
  { node: b, kind: "shape", value: "", box: { x: 400, y: 180, cx: 100, cy: 120 }, grouped: false },
  { node: c, kind: "shape", value: "", box: { x: 700, y: 100, cx: 100, cy: 150 }, grouped: false },
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

function set(register: Register, node: ElementId, patch: ElementPatch) {
  return ran(register, [{ command: "person", v: 13, patch, node }])
}

describe("plain frame", () => {
  it("wraps one or more layers in a plain frame without reordering or reflowing them", () => {
    const turn = plainFrameTurn(indexed, file, slide, frame, backdrop, [b, a])
    if (turn === null) throw new Error("plain frame")
    expect(turn).toHaveLength(1)
    const after = ran(indexed, turn)
    const view = readLayout(after, frame)
    expect(view?.flow).toBe("none")
    expect(view?.backdrop).toBe(backdrop)
    expect(view?.box).toEqual({ x: 100, y: 100, cx: 400, cy: 200 })
    expect(view?.children).toEqual([
      { node: b, box: { x: 400, y: 180, cx: 100, cy: 120 } },
      { node: a, box: { x: 100, y: 100, cx: 200, cy: 100 } },
    ])
    expect(layoutNodes(after)).toEqual([frame])
  })

  it("wraps a single layer and keeps previously moved children at their exact slide positions", () => {
    const moved = set(set(indexed, a, { box: { x: { set: 500 }, y: { set: 240 } } }), c, { box: { x: { set: 760 } } })
    const turn = plainFrameTurn(moved, file, slide, frame, backdrop, [a, c])
    if (turn === null) throw new Error("plain frame")
    const head = turn[0]
    if (head?.command !== "slide") throw new Error("slide")
    const undoable = slideUndoable(moved, file, head.edit)
    if (undoable === null) throw new Error("undoable")
    const after = ran(moved, turn)
    expect(readLayout(after, frame)?.children).toEqual([
      { node: a, box: { x: 500, y: 240, cx: 200, cy: 100 } },
      { node: c, box: { x: 760, y: 100, cx: 100, cy: 150 } },
    ])
    const undone = undoOf(after, undoable)
    if (!undone.ok) throw new Error("undo")
    const back = ran(after, undone.commands)
    expect(elementGone(back, backdrop)).toBe(true)
    expect(groupedNow(back, a)).toBe(false)
    expect(readLayout(back, frame)).toBeNull()
    const redone = redoOf(back, undoable)
    if (!redone.ok) throw new Error("redo")
    const again = ran(back, redone.commands)
    expect(readLayout(again, frame)?.children).toEqual([
      { node: a, box: { x: 500, y: 240, cx: 200, cy: 100 } },
      { node: c, box: { x: 760, y: 100, cx: 100, cy: 150 } },
    ])
  })

  it("lets a plain frame take auto layout later, move children freely, and ungroup cleanly", () => {
    const turn = plainFrameTurn(indexed, file, slide, frame, backdrop, [a])
    if (turn === null) throw new Error("plain frame")
    const after = ran(indexed, turn)
    const moved = set(after, a, { box: { x: { set: 40 }, y: { set: 20 } } })
    expect(readLayout(moved, frame)?.children).toEqual([{ node: a, box: { x: 140, y: 120, cx: 200, cy: 100 } }])
    const reflowed = changeLayout(moved, { reflow: frame })
    expect(reflowed).not.toBeNull()
    const ungrouped = ungroupTurn(moved, file, slide, frame)
    if (ungrouped === null) throw new Error("ungroup")
    const loose = ran(moved, ungrouped)
    expect(readLayout(loose, frame)).toBeNull()
    expect(groupedNow(loose, a)).toBe(false)
  })

  it("refuses empty selection, an existing frame, or a layer already inside a group", () => {
    expect(plainFrameTurn(indexed, file, slide, frame, backdrop, [])).toBeNull()
    const turn = plainFrameTurn(indexed, file, slide, frame, backdrop, [a, b])
    if (turn === null) throw new Error("plain frame")
    const after = ran(indexed, turn)
    expect(plainFrameTurn(after, file, slide, elementId("256.30"), elementId("256.31"), [frame])).toBeNull()
    expect(plainFrameTurn(after, file, slide, elementId("256.30"), elementId("256.31"), [a])).toBeNull()
  })
})
