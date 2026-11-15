import { describe, expect, it } from "vitest"
import { decide, openRegister, type Command, type Register } from "./decide.js"
import { elementId, slideId, type ElementId } from "./element-id.js"
import { elementGone } from "./element-order.js"
import type { SlideCommand } from "./slide-order.js"
import { elementsUndoable, redoOf, slideUndoable, undoOf, type Undoable } from "./person-undo.js"

const file = [slideId("256"), slideId("257")] as const
const a = elementId("256.2")
const b = elementId("256.3")
const run = "r"

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function removal(node: ElementId): Extract<SlideCommand, { readonly slide: "element-remove" }> {
  return { slide: "element-remove", id: file[0], node }
}

function slid(register: Register, edit: SlideCommand): Register {
  return landed(register, { command: "slide", file, edit })
}

function opened(): Register {
  const first = landed(openRegister("", ""), { command: "add", node: a, floor: "First", route: "" })
  return landed(first, { command: "add", node: b, floor: "Second", route: "" })
}

function deleted(register: Register, nodes: readonly ElementId[]): { register: Register; undoable: Undoable } {
  const edits = nodes.map(removal)
  const undoable = elementsUndoable(register, file, edits)
  if (undoable === null) throw new Error("undoable")
  return { register: edits.reduce(slid, register), undoable }
}

function turned(register: Register, turn: ReturnType<typeof undoOf>): Register {
  if (!turn.ok) throw new Error("changed")
  return turn.commands.reduce(landed, register)
}

function gone(register: Register): readonly boolean[] {
  return [a, b].map((node) => elementGone(register, node))
}

function agentWrote(register: Register, at: ElementId, value: string): Register {
  const started = landed(register, { command: "start", runId: run, node: at })
  const readAt = started.elements[at]?.readAt ?? 0
  const wrote = landed(started, { command: "agent", runId: run, readAt, value, node: at })
  return landed(wrote, { command: "stop", runId: run, node: at })
}

describe("person undo of a delete of several elements", () => {
  it("deletes two elements as one step, brings both back with one undo, and takes both away with one redo", () => {
    const removed = deleted(opened(), [a, b])
    expect(removed.undoable).toMatchObject({
      elements: [{ node: a }, { node: b }],
      slide: file[0],
      before: true,
      after: false,
    })
    expect(gone(removed.register)).toEqual([true, true])
    const undo = undoOf(removed.register, removed.undoable)
    expect(undo.ok && undo.commands.length).toBe(2)
    const undone = turned(removed.register, undo)
    expect(gone(undone)).toEqual([false, false])
    expect(gone(turned(undone, redoOf(undone, removed.undoable)))).toEqual([true, true])
  })

  it("names only the elements whose delete lands", () => {
    const register = slid(opened(), removal(b))
    expect(elementsUndoable(register, file, [removal(a), removal(b)])).toMatchObject({ elements: [{ node: a }] })
    expect(elementsUndoable(slid(register, removal(a)), file, [removal(a), removal(b)])).toBeNull()
  })

  it("makes the same step for one element as a single delete does", () => {
    expect(elementsUndoable(opened(), file, [removal(a)])).toEqual(slideUndoable(opened(), file, removal(a)))
  })

  it("redoes the delete of what still shows, and the next undo leaves gone an element an agent deleted in between", () => {
    const removed = deleted(opened(), [a, b])
    const undone = turned(removed.register, undoOf(removed.register, removed.undoable))
    const agentGone = slid(undone, removal(a))
    const redo = redoOf(agentGone, removed.undoable)
    if (!redo.ok) throw new Error("changed")
    expect(redo.commands).toEqual([{ command: "slide", file, edit: removal(b) }])
    expect(redo.undoable).toMatchObject({ elements: [{ node: b }] })
    const redone = turned(agentGone, redo)
    expect(gone(redone)).toEqual([true, true])
    const again = turned(redone, undoOf(redone, redo.undoable))
    expect(gone(again)).toEqual([true, false])
  })

  it("refuses to redo the delete once an agent wrote in either element, and changes neither", () => {
    const removed = deleted(opened(), [a, b])
    const undone = turned(removed.register, undoOf(removed.register, removed.undoable))
    const wrote = agentWrote(undone, b, "Aira")
    expect(redoOf(wrote, removed.undoable)).toEqual({ ok: false })
    expect(gone(wrote)).toEqual([false, false])
  })

  it("redoes the delete of an element that held an agent's text before the person deleted it", () => {
    const removed = deleted(agentWrote(opened(), a, "Aira"), [a, b])
    const undone = turned(removed.register, undoOf(removed.register, removed.undoable))
    expect(gone(turned(undone, redoOf(undone, removed.undoable)))).toEqual([true, true])
  })

  it.fails("leaves gone an element an agent deleted after someone else brought it back", () => {
    const removed = deleted(opened(), [a, b])
    const restored = slid(removed.register, { slide: "element-restore", id: file[0], node: a })
    const agentGone = slid(restored, { ...removal(a), runId: run })
    expect(gone(turned(agentGone, undoOf(agentGone, removed.undoable)))).toEqual([true, false])
  })

  it("brings back what is still gone and skips an element someone else already brought back", () => {
    const removed = deleted(opened(), [a, b])
    const restored = slid(removed.register, { slide: "element-restore", id: file[0], node: a })
    const undo = undoOf(restored, removed.undoable)
    if (!undo.ok) throw new Error("changed")
    expect(undo.undoable).toMatchObject({ elements: [{ node: b }] })
    expect(gone(turned(restored, undo))).toEqual([false, false])
    const both = slid(restored, { slide: "element-restore", id: file[0], node: b })
    expect(undoOf(both, removed.undoable)).toEqual({ ok: false })
  })
})
