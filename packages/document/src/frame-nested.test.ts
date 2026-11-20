import { describe, expect, it } from "vitest"
import {
  changeLayout,
  decide,
  elementId,
  groupedNow,
  groupParent,
  openRegister,
  placeOf,
  readLayout,
  slideId,
  slideUndoable,
  undoOf,
  ungroupTurn,
  type Box,
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
const d = elementId("256.5")
const inner = elementId("256.20")
const innerBackdrop = elementId("256.21")
const outer = elementId("256.22")
const outerBackdrop = elementId("256.23")

const elements: readonly IndexElement[] = [
  { node: a, kind: "shape", value: "", box: { x: 100, y: 100, cx: 200, cy: 100 }, grouped: false },
  { node: b, kind: "shape", value: "", box: { x: 400, y: 100, cx: 100, cy: 100 }, grouped: false },
  { node: c, kind: "shape", value: "", box: { x: 100, y: 1000, cx: 100, cy: 150 }, grouped: false },
  { node: d, kind: "shape", value: "", box: { x: 5000, y: 5000, cx: 80, cy: 80 }, grouped: false },
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

function wrap(register: Register, nodes: readonly ElementId[], node: ElementId, backdrop: ElementId): Register {
  return ran(register, [{ command: "slide", file, edit: wrapCommand(register, nodes, node, backdrop) }])
}

function set(register: Register, node: ElementId, patch: ElementPatch): Register {
  return ran(register, [{ command: "person", v: 13, patch, node }])
}

function rows(register: Register, intent: { readonly remove: ElementId }): Register {
  const changed = changeLayout(register, intent)
  if (changed === null || !("rows" in changed)) throw new Error("rows")
  return ran(
    register,
    changed.rows.map((row): Command => ({ command: "person", v: 13, patch: row.patch, node: row.node })),
  )
}

function dropped(register: Register, place: ElementId, box: Box) {
  const changed = changeLayout(register, { place, box, file })
  if (changed === null || !("turn" in changed)) throw new Error("place")
  return { after: ran(register, changed.turn), turn: changed.turn }
}

function boxIn(register: Register, frame: ElementId, node: ElementId): Box | undefined {
  return readLayout(register, frame)?.children.find((child) => child.node === node)?.box
}

const row = (register: Register) =>
  set(wrap(register, [a, b], inner, innerBackdrop), inner, { layout: { gap: { set: 50 } } })

function nested(): Register {
  return set(wrap(row(indexed), [inner, c], outer, outerBackdrop), outer, {
    layout: { gap: { set: 20 }, padding: { set: { left: 10, top: 10, right: 10, bottom: 10 } } },
  })
}

describe("a frame inside an auto layout frame", () => {
  it("wraps a frame and a layer in a new auto layout frame, which lays the inner frame out at its hugged size", () => {
    const command = wrapCommand(row(indexed), [inner, c], outer, outerBackdrop)
    expect(command.members.map((member) => member.node)).toEqual([inner, c])
    expect(command.members[0]?.box).toEqual({ x: 100, y: 100, cx: 350, cy: 100 })
    expect(command.element.opening?.layout?.flow).toEqual({ set: "vertical" })
    const after = nested()
    expect(groupParent(after, inner)).toBe(outer)
    expect(readLayout(after, outer)?.children).toEqual([
      { node: inner, box: { x: 110, y: 110, cx: 350, cy: 100 } },
      { node: c, box: { x: 110, y: 230, cx: 100, cy: 150 } },
    ])
    expect(readLayout(after, outer)?.box).toEqual({ x: 100, y: 100, cx: 370, cy: 290 })
  })

  it("lays the inner frame's children out where the outer frame puts it, and follows the outer frame's move", () => {
    const after = set(nested(), outer, { box: { x: { set: 1000 }, y: { set: 2000 } } })
    const view = readLayout(after, inner)
    expect(view?.box).toEqual({ x: 1010, y: 2010, cx: 350, cy: 100 })
    expect(view?.children).toEqual([
      { node: a, box: { x: 1010, y: 2010, cx: 200, cy: 100 } },
      { node: b, box: { x: 1260, y: 2010, cx: 100, cy: 100 } },
    ])
  })

  it("grows the outer frame and moves the next child when the inner frame's gap or a child grows", () => {
    const wider = set(nested(), inner, { layout: { gap: { set: 150 }, flow: { set: "vertical" } } })
    expect(boxIn(wider, outer, inner)).toEqual({ x: 110, y: 110, cx: 200, cy: 350 })
    expect(boxIn(wider, outer, c)?.y).toBe(480)
    const taller = set(nested(), b, { box: { h: { set: 400 } } })
    expect(boxIn(taller, outer, inner)?.cy).toBe(400)
    expect(boxIn(taller, outer, c)?.y).toBe(530)
  })

  it("refuses moving the inner frame on its own, and lets it change its own layout", () => {
    const after = nested()
    expect(decide(after, { command: "person", v: 13, patch: { box: { x: { set: 5 } } }, node: inner })).toEqual({
      decision: "refuse",
      code: "group-box",
    })
    expect(readLayout(set(after, inner, { layout: { align: { set: "center" } } }), inner)?.align).toBe("center")
  })

  it("removes auto layout from the inner frame and keeps every layer where it shows", () => {
    const before = nested()
    const after = rows(before, { remove: inner })
    expect(readLayout(after, inner)?.flow).toBe("none")
    expect(readLayout(after, inner)?.children).toEqual(readLayout(before, inner)?.children)
    expect(readLayout(after, outer)?.children).toEqual(readLayout(before, outer)?.children)
  })

  it("removes auto layout from the outer frame and keeps the inner frame and its children where they show", () => {
    const before = nested()
    const after = rows(before, { remove: outer })
    expect(readLayout(after, outer)?.children).toEqual(readLayout(before, outer)?.children)
    expect(readLayout(after, inner)?.children).toEqual(readLayout(before, inner)?.children)
    const moved = set(after, outer, { box: { x: { set: 3000 } } })
    expect(readLayout(moved, inner)?.children[0]?.box).toEqual({ x: 3010, y: 110, cx: 200, cy: 100 })
  })

  it("ungroups the outer frame and leaves the inner frame on the slide where it showed", () => {
    const before = nested()
    const turn = ungroupTurn(before, file, slide, outer)
    if (turn === null) throw new Error("ungroup")
    const after = ran(before, turn)
    expect(groupedNow(after, inner)).toBe(false)
    expect(readLayout(after, inner)?.children).toEqual(readLayout(before, inner)?.children)
  })
})

describe("a frame dragged into or out of an auto layout frame", () => {
  it("joins a frame dropped on an auto layout frame at its place in the row, and Undo takes it back out", () => {
    const solo = wrap(row(indexed), [c], outer, outerBackdrop)
    const { after, turn } = dropped(solo, inner, { x: -55, y: 1000, cx: 350, cy: 100 })
    expect(turn[0]).toMatchObject({ command: "slide", edit: { slide: "element-join", frame: outer, before: c } })
    expect(readLayout(after, outer)?.children.map((child) => child.node)).toEqual([inner, c])
    expect(readLayout(after, inner)?.children[0]?.box).toEqual({ x: 100, y: 1000, cx: 200, cy: 100 })
    const head = turn[0]
    if (head?.command !== "slide") throw new Error("slide")
    const undoable = slideUndoable(solo, file, head.edit)
    if (undoable === null) throw new Error("undoable")
    const undone = undoOf(after, undoable)
    if (!undone.ok) throw new Error("undo")
    const back = ran(after, undone.commands)
    expect(groupedNow(back, inner)).toBe(false)
    expect(readLayout(back, inner)?.children).toEqual(readLayout(solo, inner)?.children)
  })

  it("drops a layer on the inner frame into the inner frame, not the outer one", () => {
    const { after } = dropped(nested(), d, { x: 330, y: 120, cx: 80, cy: 80 })
    expect(groupParent(after, d)).toBe(inner)
    expect(readLayout(after, inner)?.children.map((child) => child.node)).toEqual([a, d, b])
  })

  it("leaves the outer frame when the inner frame is dropped on the slide, at the place it was dropped", () => {
    const { after } = dropped(nested(), inner, { x: 4000, y: 4000, cx: 350, cy: 100 })
    expect(groupedNow(after, inner)).toBe(false)
    expect(readLayout(after, outer)?.children.map((child) => child.node)).toEqual([c])
    expect(readLayout(after, inner)?.children[0]?.box).toEqual({ x: 4000, y: 4000, cx: 200, cy: 100 })
    expect(placeOf(after, inner)?.box.x).toBe(4000)
  })

  it("refuses a frame joining itself or a frame inside it", () => {
    const before = nested()
    expect(changeLayout(before, { move: outer, frame: inner, before: null, file })).toBeNull()
    expect(changeLayout(before, { move: outer, frame: outer, before: null, file })).toBeNull()
    expect(
      decide(before, {
        command: "slide",
        file,
        edit: {
          slide: "element-join",
          id: slide,
          member: { node: outer, box: { x: 0, y: 0, cx: 1, cy: 1 } },
          frame: inner,
          before: null,
        } satisfies SlideCommand,
      }),
    ).toMatchObject({ decision: "refuse" })
  })
})
