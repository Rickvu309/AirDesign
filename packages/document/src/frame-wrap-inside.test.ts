import { describe, expect, it } from "vitest"
import {
  changeLayout,
  decide,
  elementId,
  groupedNow,
  groupParent,
  openRegister,
  readLayout,
  slideId,
  slideUndoable,
  redoOf,
  undoOf,
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
const loose = elementId("256.5")
const outer = elementId("256.20")
const outerBackdrop = elementId("256.21")
const inner = elementId("256.22")
const innerBackdrop = elementId("256.23")
const point = 12_700

const elements: readonly IndexElement[] = [
  { node: a, kind: "shape", value: "", box: { x: 0, y: 0, cx: 20 * point, cy: 10 * point }, grouped: false },
  { node: b, kind: "shape", value: "", box: { x: 30 * point, y: 0, cx: 10 * point, cy: 10 * point }, grouped: false },
  { node: c, kind: "shape", value: "", box: { x: 60 * point, y: 0, cx: 10 * point, cy: 15 * point }, grouped: false },
  {
    node: loose,
    kind: "shape",
    value: "",
    box: { x: 0, y: 400 * point, cx: 10 * point, cy: 10 * point },
    grouped: false,
  },
]

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    total: elements.length,
    slides: [{ id: "256", position: 0, free: 30, animated: [] }],
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

function wrapCommand(register: Register, nodes: readonly ElementId[], node: ElementId, backdrop: ElementId) {
  const changed = changeLayout(register, { wrap: nodes, slide, node, backdrop })
  if (changed === null || !("slide" in changed)) throw new Error("wrap")
  return changed.slide
}

function set(register: Register, node: ElementId, patch: ElementPatch): Register {
  return ran(register, [{ command: "person", v: 13, patch, node }])
}

function row(): Register {
  const framed = ran(indexed, [{ command: "slide", file, edit: wrapCommand(indexed, [a, b, c], outer, outerBackdrop) }])
  return set(framed, outer, { layout: { gap: { set: 10 * point } } })
}

const boxes = (register: Register, frame: ElementId) =>
  readLayout(register, frame)?.children.map((child) => [child.node, child.box])

describe("Shift+A on children of an auto layout frame", () => {
  it("wraps them in a new auto layout frame at their place in the row, and every layer keeps its place", () => {
    const before = row()
    const laid = new Map(readLayout(before, outer)?.children.map((child) => [child.node, child.box]))
    const command = wrapCommand(before, [c, b], inner, innerBackdrop)
    expect(command.members.map((member) => member.node)).toEqual([b, c])
    const after = ran(before, [{ command: "slide", file, edit: command }])
    expect(groupParent(after, inner)).toBe(outer)
    expect(readLayout(after, outer)?.children.map((child) => child.node)).toEqual([a, inner])
    expect(readLayout(after, inner)?.flow).toBe("horizontal")
    expect(readLayout(after, inner)?.gap).toBe(10 * point)
    expect(boxes(after, inner)).toEqual([
      [b, laid.get(b)],
      [c, laid.get(c)],
    ])
    expect(readLayout(after, outer)?.box).toEqual(readLayout(before, outer)?.box)
  })

  it("turns the new frame into a column, which moves the outer frame's flow and keeps a in place", () => {
    const before = row()
    const after = ran(before, [{ command: "slide", file, edit: wrapCommand(before, [b, c], inner, innerBackdrop) }])
    const column = set(after, inner, { layout: { flow: { set: "vertical" } } })
    expect(boxes(column, inner)).toEqual([
      [b, { x: 30 * point, y: 0, cx: 10 * point, cy: 10 * point }],
      [c, { x: 30 * point, y: 20 * point, cx: 10 * point, cy: 15 * point }],
    ])
    expect(boxes(column, outer)?.[0]).toEqual([a, { x: 0, y: 0, cx: 20 * point, cy: 10 * point }])
  })

  it("puts the children back in the outer frame's row where they were when the wrap is undone, and Redo wraps them again", () => {
    const before = row()
    const command = wrapCommand(before, [b, c], inner, innerBackdrop)
    const undoable = slideUndoable(before, file, command)
    if (undoable === null) throw new Error("undoable")
    const after = ran(before, [{ command: "slide", file, edit: command }])
    const undone = undoOf(after, undoable)
    if (!undone.ok) throw new Error("undo")
    const back = ran(after, undone.commands)
    expect(readLayout(back, outer)?.children).toEqual(readLayout(before, outer)?.children)
    expect(groupParent(back, b)).toBe(outer)
    const redone = redoOf(back, undoable)
    if (!redone.ok) throw new Error("redo")
    const again = ran(back, redone.commands)
    expect(readLayout(again, outer)?.children.map((child) => child.node)).toEqual([a, inner])
    expect(readLayout(again, inner)?.children).toEqual(readLayout(after, inner)?.children)
  })

  it("wraps children of a frame without auto layout where they sit, and the new frame moves with its frame", () => {
    const free = set(row(), outer, { layout: { flow: { set: "none" } } })
    const frozen = ran(
      free,
      [b, c].map((node): Command => ({
        command: "person",
        v: 13,
        patch: { box: { x: { set: (node === b ? 30 : 50) * point }, y: { set: 5 * point } } },
        node,
      })),
    )
    const shifted = set(frozen, outer, { box: { y: { set: 40 * point } } })
    const sitting = new Map(readLayout(shifted, outer)?.children.map((child) => [child.node, child.box]))
    const changed = changeLayout(shifted, { wrap: [b, c], slide, node: inner, backdrop: innerBackdrop })
    if (changed === null || !("slide" in changed)) throw new Error("wrap")
    expect(changed.rows).toEqual([{ node: inner, patch: { box: { x: { set: 30 * point }, y: { set: 5 * point } } } }])
    const after = ran(shifted, [
      { command: "slide", file, edit: changed.slide },
      ...changed.rows.map((each): Command => ({ command: "person", v: 13, patch: each.patch, node: each.node })),
    ])
    expect(boxes(after, inner)).toEqual([
      [b, sitting.get(b)],
      [c, sitting.get(c)],
    ])
    const moved = set(after, outer, { box: { x: { set: 100 * point } } })
    expect(boxes(moved, inner)?.[0]?.[1]).toMatchObject({ x: sitting.get(b)!.x + 100 * point })
  })

  it("refuses children of two frames, a child with a layer outside its frame, and the frame with its own child", () => {
    const before = row()
    expect(changeLayout(before, { wrap: [b, loose], slide, node: inner, backdrop: innerBackdrop })).toBeNull()
    expect(changeLayout(before, { wrap: [outer, b], slide, node: inner, backdrop: innerBackdrop })).toBeNull()
    expect(groupedNow(before, b)).toBe(true)
  })
})
