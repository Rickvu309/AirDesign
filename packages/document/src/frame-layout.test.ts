import { describe, expect, it } from "vitest"
import {
  beforeOf,
  changeLayout,
  decide,
  elementGone,
  elementId,
  groupedNow,
  layoutNodes,
  nextElementId,
  openingElement,
  openRegister,
  readLayout,
  redoOf,
  slideId,
  slideUndoable,
  takes,
  undoOf,
  ungroupTurn,
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

const elements: readonly IndexElement[] = [
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

describe("auto layout frame", () => {
  it("wraps layers in a horizontal row in left to right order, guessing the gap from their spacing", () => {
    const command = wrapCommand(indexed, [c, a, b])
    expect(command.members.map((member) => member.node)).toEqual([a, b, c])
    expect(command.backdrop).toEqual({
      node: backdrop,
      kind: "shape",
      value: null,
      box: { x: 100, y: 100, cx: 700, cy: 150 },
      grouped: false,
    })
    expect(command.element.opening).toEqual({
      layout: {
        flow: { set: "horizontal" },
        gap: { set: 0 },
        padding: { set: { left: 0, top: 0, right: 0, bottom: 0 } },
        align: { set: "topLeft" },
      },
    })
  })

  it("lays the children out side by side from the frame's corner and hugs them", () => {
    const after = set(wrapped(), frame, { layout: { gap: { set: 50 } } })
    const view = readLayout(after, frame)
    expect(view?.backdrop).toBe(backdrop)
    expect(view?.children).toEqual([
      { node: a, box: { x: 100, y: 100, cx: 200, cy: 100 } },
      { node: b, box: { x: 350, y: 100, cx: 100, cy: 100 } },
      { node: c, box: { x: 500, y: 100, cx: 100, cy: 150 } },
    ])
    expect(view?.box).toEqual({ x: 100, y: 100, cx: 500, cy: 150 })
  })

  it("stacks a column, pads it, aligns across the flow and leaves a hidden child out of the flow", () => {
    const after = set(wrapped(), frame, {
      layout: {
        flow: { set: "vertical" },
        gap: { set: 10 },
        padding: { set: { left: 5, top: 6, right: 7, bottom: 8 } },
        align: { set: "right" },
      },
    })
    const hidden = set(after, b, { identity: { hidden: { set: true } } })
    const view = readLayout(hidden, frame)
    expect(view?.children.filter((child) => child.node !== b)).toEqual([
      { node: a, box: { x: 105, y: 106, cx: 200, cy: 100 } },
      { node: c, box: { x: 205, y: 216, cx: 100, cy: 150 } },
    ])
    expect(view?.box).toEqual({ x: 100, y: 100, cx: 212, cy: 274 })
  })

  it("moves with the frame's own box and ignores a size the frame was dragged to", () => {
    const after = set(wrapped(), frame, { box: { x: { set: 1000 }, y: { set: 2000 }, w: { set: 9 }, h: { set: 9 } } })
    const view = readLayout(after, frame)
    expect(view?.box.x).toBe(1000)
    expect(view?.children[0]?.box).toEqual({ x: 1000, y: 2000, cx: 200, cy: 100 })
    expect(view?.box.cx).toBeGreaterThan(9)
  })

  it("is not a frame when it is a plain group or once ungrouped", () => {
    const after = wrapped()
    expect(layoutNodes(after)).toEqual([frame])
    expect(readLayout(after, a)).toBeNull()
    const commands = ungroupTurn(after, file, slide, frame)
    if (commands === null) throw new Error("ungroup")
    const freed = ran(after, commands)
    expect(readLayout(freed, frame)).toBeNull()
    expect(layoutNodes(freed)).toEqual([])
    expect(elementGone(freed, backdrop)).toBe(true)
    expect(groupedNow(freed, a)).toBe(false)
  })

  it("keeps the backdrop inside the frame, gives it the next shape id and lets the frame take layout fields", () => {
    const after = wrapped()
    expect(groupedNow(after, backdrop)).toBe(true)
    expect(openingElement(after, backdrop)?.kind).toBe("shape")
    expect(nextElementId(after, slide, 3)).toBe(elementId("256.22"))
    expect(readLayout(set(after, frame, { layout: { gap: { set: 7 } } }), frame)?.gap).toBe(7)
    expect(takes({ kind: "group", text: false, grouped: false, animated: false })).not.toContain("layout.gap")
    expect(takes({ kind: "group", text: false, grouped: false, animated: false, frame: "free" })).toContain(
      "layout.gap",
    )
  })

  it("refuses moving a child of an auto layout frame on its own", () => {
    const after = ran(wrapped(), [{ command: "add", node: a, floor: "", route: "" }])
    expect(decide(after, { command: "person", v: 13, patch: { box: { x: { set: 5 } } }, node: a })).toEqual({
      decision: "refuse",
      code: "group-box",
    })
  })

  it("removes auto layout by freezing every child where it sits, relative to the frame", () => {
    const before = set(wrapped(), frame, { layout: { gap: { set: 50 } } })
    const laid = readLayout(before, frame)
    const changed = changeLayout(before, { remove: frame })
    if (changed === null || !("rows" in changed)) throw new Error("remove")
    const after = ran(
      before,
      changed.rows.map((row): Command => ({ command: "person", v: 13, patch: row.patch, node: row.node })),
    )
    const view = readLayout(after, frame)
    expect(view?.flow).toBe("none")
    expect(view?.children).toEqual(laid?.children)
    expect(view?.box).toEqual(laid?.box)
    const moved = set(after, a, { box: { x: { set: 0 }, y: { set: 400 } } })
    expect(readLayout(moved, frame)?.children[0]?.box).toEqual({ x: 100, y: 500, cx: 200, cy: 100 })
    expect(changeLayout(after, { remove: frame })).toBeNull()
  })

  it("puts every layer back where it was when the wrap is undone", () => {
    const command = wrapCommand(indexed, [a, b, c])
    const undoable = slideUndoable(indexed, file, command)
    const after = applied(indexed, command)
    if (undoable === null) throw new Error("undoable")
    const undone = undoOf(after, undoable)
    if (!undone.ok) throw new Error("undo")
    const back = ran(after, undone.commands)
    expect(elementGone(back, backdrop)).toBe(true)
    expect(groupedNow(back, b)).toBe(false)
    expect(back.elements[b]).toBeUndefined()
    const redone = redoOf(back, undoable)
    if (!redone.ok) throw new Error("redo")
    const again = ran(back, redone.commands)
    expect(elementGone(again, backdrop)).toBe(false)
    expect(readLayout(again, frame)?.children).toEqual(readLayout(after, frame)?.children)
  })

  it("refuses a wrap that names a layer already in a group, or no layer", () => {
    const after = wrapped()
    expect(
      changeLayout(after, { wrap: [a], slide, node: elementId("256.30"), backdrop: elementId("256.31") }),
    ).toBeNull()
    expect(changeLayout(indexed, { wrap: [], slide, node: frame, backdrop })).toBeNull()
  })

  it("refuses a backdrop that is not a fresh blank shape at the frame's box", () => {
    const command = wrapCommand(indexed, [a, b])
    const stale = { ...command, backdrop: { ...command.backdrop, node: a } } as SlideCommand
    expect(decide(indexed, { command: "slide", file, edit: stale })).toMatchObject({ decision: "refuse" })
    const filled = { ...command, backdrop: { ...command.backdrop, value: "" } } as SlideCommand
    expect(decide(indexed, { command: "slide", file, edit: filled })).toMatchObject({ decision: "refuse" })
  })
})

describe("auto layout frame undo", () => {
  it("undoes and redoes Remove auto layout as one step, children first on the way back", () => {
    const before = set(wrapped(), frame, { layout: { gap: { set: 50 } } })
    const changed = changeLayout(before, { remove: frame })
    if (changed === null || !("rows" in changed)) throw new Error("remove")
    const steps = changed.rows.map((row) => ({ node: row.node, before: beforeOf({}, row.patch), after: row.patch }))
    const after = ran(
      before,
      changed.rows.map((row): Command => ({ command: "person", v: 13, patch: row.patch, node: row.node })),
    )
    const undone = undoOf(after, { steps })
    if (!undone.ok) throw new Error("undo")
    const back = ran(after, undone.commands)
    expect(readLayout(back, frame)?.flow).toBe("horizontal")
    expect(readLayout(back, frame)?.children).toEqual(readLayout(before, frame)?.children)
    const redone = redoOf(back, { steps })
    if (!redone.ok) throw new Error("redo")
    expect(readLayout(ran(back, redone.commands), frame)?.flow).toBe("none")
  })
})

describe("frame without auto layout", () => {
  it("keeps every child in place when it is ungrouped and the ungroup is undone", () => {
    const before = set(wrapped(), frame, { layout: { gap: { set: 50 } } })
    const changed = changeLayout(before, { remove: frame })
    if (changed === null || !("rows" in changed)) throw new Error("remove")
    const free = ran(
      before,
      changed.rows.map((row): Command => ({ command: "person", v: 13, patch: row.patch, node: row.node })),
    )
    const laid = readLayout(free, frame)?.children
    const turn = ungroupTurn(free, file, slide, frame)
    if (turn === null) throw new Error("ungroup")
    const ungroupEdit = turn[0]
    if (ungroupEdit?.command !== "slide") throw new Error("slide")
    const undoable = slideUndoable(free, file, ungroupEdit.edit)
    if (undoable === null) throw new Error("undoable")
    const loose = ran(free, turn)
    const undone = undoOf(loose, undoable)
    if (!undone.ok) throw new Error("undo")
    const back = ran(loose, undone.commands)
    expect(readLayout(back, frame)?.flow).toBe("none")
    expect(readLayout(back, frame)?.children).toEqual(laid)
  })
})
