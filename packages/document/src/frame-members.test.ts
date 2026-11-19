import { describe, expect, it } from "vitest"
import {
  changeLayout,
  decide,
  elementId,
  groupedNow,
  openRegister,
  readLayout,
  redoOf,
  slideId,
  slideUndoable,
  undoOf,
  placeOf,
  type Command,
  type ElementId,
  type ElementPatch,
  type IndexElement,
  type Register,
  type SlideCommand,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const a = elementId("256.2")
const b = elementId("256.3")
const c = elementId("256.4")
const frame = elementId("256.20")
const backdrop = elementId("256.21")

const d = elementId("256.5")

const elements: readonly IndexElement[] = [
  { node: d, kind: "shape", value: "", box: { x: 2000, y: 2000, cx: 300, cy: 120 }, grouped: false },
  { node: a, kind: "shape", value: "", box: { x: 100, y: 100, cx: 200, cy: 100 }, grouped: false },
  { node: b, kind: "shape", value: "", box: { x: 400, y: 120, cx: 100, cy: 100 }, grouped: false },
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

function applied(register: Register, edit: SlideCommand): Register {
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
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

function wrapCommand(register: Register, nodes: readonly ElementId[]) {
  const changed = changeLayout(register, { wrap: nodes, slide, node: frame, backdrop })
  if (changed === null || !("slide" in changed)) throw new Error("wrap")
  return changed.slide
}

function wrapped(register: Register = indexed): Register {
  return applied(register, wrapCommand(register, [c, a, b]))
}

function set(register: Register, node: ElementId, patch: ElementPatch) {
  return ran(register, [{ command: "person", v: 13, patch, node }])
}

function turned(register: Register, place: ElementId, box: { x: number; y: number; cx: number; cy: number }) {
  const changed = changeLayout(register, { place, box, file })
  if (changed === null || !("turn" in changed)) throw new Error("place")
  return { after: ran(register, changed.turn), turn: changed.turn }
}

function order(register: Register): readonly ElementId[] {
  return readLayout(register, frame)?.children.map((child) => child.node) ?? []
}

describe("frame members", () => {
  it("drops a layer into an auto layout frame between two children, and Undo and Redo move it out and in", () => {
    const before = set(wrapped(), frame, { layout: { gap: { set: 50 } } })
    const { after, turn } = turned(before, d, { x: 220, y: 100, cx: 300, cy: 120 })
    expect(turn[0]).toMatchObject({ command: "slide", edit: { slide: "element-join", frame, before: b } })
    expect(order(after)).toEqual([a, d, b, c])
    expect(readLayout(after, frame)?.children[1]?.box).toEqual({ x: 350, y: 100, cx: 300, cy: 120 })
    const head = turn[0]
    if (head?.command !== "slide") throw new Error("slide")
    const undoable = slideUndoable(before, file, head.edit)
    if (undoable === null) throw new Error("undoable")
    const undone = undoOf(after, undoable)
    if (!undone.ok) throw new Error("undo")
    const back = ran(after, undone.commands)
    expect(order(back)).toEqual([a, b, c])
    expect(groupedNow(back, d)).toBe(false)
    expect(placeOf(back, d)?.box).toEqual({ x: 2000, y: 2000, cx: 300, cy: 120 })
    const redone = redoOf(back, undoable)
    if (!redone.ok) throw new Error("redo")
    expect(order(ran(back, redone.commands))).toEqual([a, d, b, c])
  })

  it("reorders a child dragged along its row, and leaves the frame where it was dropped outside it", () => {
    const before = set(wrapped(), frame, { layout: { gap: { set: 50 } } })
    const { after } = turned(before, a, { x: 450, y: 100, cx: 200, cy: 100 })
    expect(order(after)).toEqual([b, c, a])
    expect(changeLayout(after, { place: a, box: { x: 400, y: 100, cx: 200, cy: 100 }, file })).toEqual({ turn: [] })
    const out = turned(after, b, { x: 5000, y: 5000, cx: 100, cy: 100 }).after
    expect(order(out)).toEqual([c, a])
    expect(groupedNow(out, b)).toBe(false)
    expect(placeOf(out, b)?.box).toEqual({ x: 5000, y: 5000, cx: 100, cy: 100 })
  })

  it("keeps a layer dropped into a frame without auto layout where it was dropped, relative to the frame", () => {
    const before = set(wrapped(), frame, { layout: { gap: { set: 50 } } })
    const removed = changeLayout(before, { remove: frame })
    if (removed === null || !("rows" in removed)) throw new Error("remove")
    const free = ran(
      before,
      removed.rows.map((row): Command => ({ command: "person", v: 13, patch: row.patch, node: row.node })),
    )
    const { after } = turned(free, d, { x: 300, y: 150, cx: 300, cy: 120 })
    expect(readLayout(after, frame)?.children.find((child) => child.node === d)?.box).toEqual({
      x: 300,
      y: 150,
      cx: 300,
      cy: 120,
    })
    expect(changeLayout(after, { place: d, box: { x: 310, y: 150, cx: 300, cy: 120 }, file })).toBeNull()
  })

  it("deletes a child of a frame, which then lays out without it, and refuses the backdrop and a frame inside a frame", () => {
    const before = wrapped()
    const removed = ran(before, [{ command: "slide", file, edit: { slide: "element-remove", id: slide, node: b } }])
    expect(order(removed)).toEqual([a, c])
    expect(
      decide(before, { command: "slide", file, edit: { slide: "element-remove", id: slide, node: backdrop } }),
    ).toMatchObject({ decision: "refuse" })
    const second = changeLayout(removed, { wrap: [d], slide, node: elementId("256.30"), backdrop: elementId("256.31") })
    if (second === null || !("slide" in second)) throw new Error("wrap")
    const two = ran(removed, [{ command: "slide", file, edit: second.slide }])
    expect(
      changeLayout(two, { place: elementId("256.30"), box: { x: 100, y: 100, cx: 300, cy: 120 }, file }),
    ).toBeNull()
  })
})
