import { describe, expect, it } from "vitest"
import { currentBox, currentValue, decide, openRegister, type Command, type Register } from "./decide.js"
import { elementId, slideId, type ElementId } from "./element-id.js"
import { elementGone } from "./element-order.js"
import type { SlideCommand } from "./slide-order.js"
import { redoOf, slideUndoable, undoOf, type Undoable } from "./person-undo.js"

const file = [slideId("256"), slideId("257"), slideId("258")] as const
const node = elementId("256.2")
const run = "r"
const from = { x: 0, y: 0, cx: 10, cy: 10 }
const to = { x: 5, y: 5, cx: 10, cy: 10 }
const boxOf = (box: typeof from) => ({
  box: { x: { set: box.x }, y: { set: box.y }, w: { set: box.cx }, h: { set: box.cy } },
})

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function opened(): Register {
  return landed(openRegister("", ""), { command: "add", node, floor: "Old", route: "" })
}

function shownText(register: Register): string {
  const body = register.elements[node]
  if (body === undefined) throw new Error("node")
  return currentValue(body)
}

function shownBox(register: Register) {
  const body = register.elements[node]
  if (body === undefined) throw new Error("node")
  return currentBox(body)
}

function turned(register: Register, turn: ReturnType<typeof undoOf>): Register {
  if (!turn.ok) throw new Error("changed")
  return turn.commands.reduce(landed, register)
}

function slid(register: Register, edit: SlideCommand): { register: Register; undoable: Undoable } {
  const undoable = slideUndoable(register, file, edit)
  if (undoable === null) throw new Error("undoable")
  return { register: landed(register, { command: "slide", file, edit }), undoable }
}

function agentWrote(register: Register, at: ElementId, runId: string, value: string): Register {
  const started = landed(register, { command: "start", runId, node: at })
  const readAt = started.elements[at]?.readAt ?? 0
  const wrote = landed(started, { command: "agent", runId, readAt, value, node: at })
  return landed(wrote, { command: "stop", runId, node: at })
}

describe("person undo of an added or removed element", () => {
  it("undoes an added text box by removing it, redoes it, and refuses the undo while it shows text typed since", () => {
    const box = { node: elementId("256.9"), kind: "shape" as const, value: "", box: from, grouped: false }
    const added = slid(openRegister("", ""), { slide: "element-add", id: file[0], element: box })
    const opening = landed(added.register, { command: "add", node: box.node, floor: "", route: "" })
    const undone = turned(opening, undoOf(opening, added.undoable))
    expect(elementGone(undone, box.node)).toBe(true)
    const redone = turned(undone, redoOf(undone, added.undoable))
    expect(elementGone(redone, box.node)).toBe(false)
    const typed = landed(redone, { command: "person", value: "Typed", node: box.node })
    expect(undoOf(typed, added.undoable)).toEqual({ ok: false })
    expect(currentValue(typed.elements[box.node]!)).toBe("Typed")
  })

  it("undoes an added ellipse once its move is undone, and redoes it with its geometry", () => {
    const shape = { node: elementId("256.9"), kind: "shape" as const, value: null, box: from, grouped: false }
    const added = slid(openRegister("", ""), { slide: "element-add", id: file[0], element: shape, geometry: "ellipse" })
    const moved = landed(landed(added.register, { command: "add", node: shape.node, floor: "", route: "" }), {
      command: "person",
      node: shape.node,
      property: "box",
      value: to,
    })
    const moving: Undoable = { steps: [{ node: shape.node, before: boxOf(from), after: boxOf(to) }] }
    expect(undoOf(moved, added.undoable)).toEqual({ ok: false })
    const unmoved = turned(moved, undoOf(moved, moving))
    const undone = turned(unmoved, undoOf(unmoved, added.undoable))
    expect(elementGone(undone, shape.node)).toBe(true)
    const redone = turned(undone, redoOf(undone, added.undoable))
    expect(elementGone(redone, shape.node)).toBe(false)
    expect(currentBox(redone.elements[shape.node]!)).toEqual(from)
    expect(redone.order.find((each) => each.slide === "element-add")).toMatchObject({ geometry: "ellipse" })
  })

  it("undoes a deleted element by bringing it back with its text and box as they were, and redoes the delete", () => {
    const moved = landed(landed(opened(), { command: "person", value: "New", node }), {
      command: "person",
      property: "box",
      value: to,
      node,
    })
    const removed = slid(moved, { slide: "element-remove", id: file[0], node })
    expect(elementGone(removed.register, node)).toBe(true)
    const undone = turned(removed.register, undoOf(removed.register, removed.undoable))
    expect(elementGone(undone, node)).toBe(false)
    expect(shownText(undone)).toBe("New")
    expect(shownBox(undone)).toEqual(to)
    expect(elementGone(turned(undone, redoOf(undone, removed.undoable)), node)).toBe(true)
  })

  it("refuses to undo an element edit once someone else changed whether it shows", () => {
    const removed = slid(opened(), { slide: "element-remove", id: file[0], node })
    const restored = landed(removed.register, {
      command: "slide",
      file,
      edit: { slide: "element-restore", id: file[0], node },
    })
    expect(undoOf(restored, removed.undoable)).toEqual({ ok: false })
    const box = { node: elementId("256.9"), kind: "shape" as const, value: "", box: from, grouped: false }
    const added = slid(openRegister("", ""), { slide: "element-add", id: file[0], element: box })
    const gone = landed(added.register, {
      command: "slide",
      file,
      edit: { slide: "element-remove", id: file[0], node: box.node },
    })
    expect(undoOf(gone, added.undoable)).toEqual({ ok: false })
  })

  it("refuses to undo an added text box once an agent wrote in it", () => {
    const box = { node: elementId("256.9"), kind: "shape" as const, value: "", box: from, grouped: false }
    const added = slid(openRegister("", ""), { slide: "element-add", id: file[0], element: box })
    const opening = landed(added.register, { command: "add", node: box.node, floor: "", route: "" })
    const wrote = agentWrote(opening, box.node, run, "Aira")
    expect(undoOf(wrote, added.undoable)).toEqual({ ok: false })
    const typed = landed(wrote, { command: "person", value: "Mine", node: box.node })
    expect(undoOf(typed, added.undoable)).toEqual({ ok: false })
  })

  it("refuses to undo an added text box whose text changed in the tab's copy, which lands every row as a person's", () => {
    const box = { node: elementId("256.9"), kind: "shape" as const, value: "", box: from, grouped: false }
    const added = slid(openRegister("", ""), { slide: "element-add", id: file[0], element: box })
    const opening = landed(added.register, { command: "add", node: box.node, floor: "", route: "" })
    const copied = landed(opening, { command: "person", value: "Aira", node: box.node })
    expect(undoOf(copied, added.undoable)).toEqual({ ok: false })
  })

  it("undoes an added text box once the person's own typing and move in it are undone", () => {
    const box = { node: elementId("256.9"), kind: "shape" as const, value: "", box: from, grouped: false }
    const added = slid(openRegister("", ""), { slide: "element-add", id: file[0], element: box })
    const empty = '[{"from":0,"runs":[{"from":0,"text":""}]}]'
    const typing: Undoable = {
      steps: [
        { node: box.node, before: { text: { value: { set: empty } } }, after: { text: { value: { set: "Mine" } } } },
      ],
    }
    const moving: Undoable = { steps: [{ node: box.node, before: boxOf(from), after: boxOf(to) }] }
    const opening = landed(added.register, { command: "add", node: box.node, floor: "", route: "" })
    const typed = landed(opening, { command: "person", value: "Mine", node: box.node })
    const moved = landed(typed, { command: "person", property: "box", value: to, node: box.node })
    const unmoved = turned(moved, undoOf(moved, moving))
    const untyped = turned(unmoved, undoOf(unmoved, typing))
    expect(elementGone(turned(untyped, undoOf(untyped, added.undoable)), box.node)).toBe(true)
  })

  it("undoes an added text box again once the agent's run that wrote in it is undone", () => {
    const box = { node: elementId("256.9"), kind: "shape" as const, value: "", box: from, grouped: false }
    const added = slid(openRegister("", ""), { slide: "element-add", id: file[0], element: box })
    const opening = landed(added.register, { command: "add", node: box.node, floor: "", route: "" })
    const runUndone = landed(agentWrote(opening, box.node, run, "Aira"), {
      command: "undo",
      runId: run,
      node: box.node,
    })
    expect(elementGone(turned(runUndone, undoOf(runUndone, added.undoable)), box.node)).toBe(true)
  })

  it("refuses to redo a delete once an agent wrote in the element its undo brought back", () => {
    const removed = slid(opened(), { slide: "element-remove", id: file[0], node })
    const undone = turned(removed.register, undoOf(removed.register, removed.undoable))
    const wrote = agentWrote(undone, node, run, "Aira")
    expect(redoOf(wrote, removed.undoable)).toEqual({ ok: false })
    expect(shownText(wrote)).toBe("Aira")
  })

  it("redoes a delete of an element that held an agent's text before the person deleted it", () => {
    const removed = slid(agentWrote(opened(), node, run, "Aira"), { slide: "element-remove", id: file[0], node })
    const undone = turned(removed.register, undoOf(removed.register, removed.undoable))
    expect(shownText(undone)).toBe("Aira")
    expect(elementGone(turned(undone, redoOf(undone, removed.undoable)), node)).toBe(true)
  })
})
