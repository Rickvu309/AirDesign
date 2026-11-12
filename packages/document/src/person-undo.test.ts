import { describe, expect, it } from "vitest"
import { currentBox, currentValue, decide, openRegister, type Command, type Register } from "./decide.js"
import { elementId, slideId } from "./element-id.js"
import { orderKeyBetween } from "./order-key.js"
import { orderKeyAfter, presentSlides, type SlideCommand } from "./slide-order.js"
import { redoOf, slideUndoable, undoOf, type Undoable } from "./person-undo.js"

const file = [slideId("256"), slideId("257"), slideId("258")] as const
const node = elementId("256.2")
const run = "r"

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
  return landed(register, turn.command)
}

function slid(register: Register, edit: SlideCommand): { register: Register; undoable: Undoable } {
  const undoable = slideUndoable(register, file, edit)
  if (undoable === null) throw new Error("undoable")
  return { register: landed(register, { command: "slide", file, edit }), undoable }
}

function order(register: Register): readonly string[] {
  return presentSlides(register).map((spot) => spot.id)
}

const textEdit: Undoable = { node, floor: "Old", before: { value: "Old" }, after: { value: "New" } }
const from = { x: 0, y: 0, cx: 10, cy: 10 }
const to = { x: 5, y: 5, cx: 10, cy: 10 }
const boxEdit: Undoable = {
  node,
  floor: "Old",
  before: { property: "box", value: from },
  after: { property: "box", value: to },
}

describe("person undo", () => {
  it("undoes a text edit with a person edit back to the text before, and redoes it", () => {
    const edited = landed(opened(), { command: "person", value: "New", node })
    const undone = turned(edited, undoOf(edited, textEdit))
    expect(shownText(undone)).toBe("Old")
    const redone = turned(undone, redoOf(undone, textEdit))
    expect(shownText(redone)).toBe("New")
    expect(redone.elements[node]?.landed.map((row) => row.actor)).toEqual(["person", "person", "person"])
  })

  it("undoes a move back to the box before, and redoes it", () => {
    const moved = landed(opened(), { command: "person", property: "box", value: to, node })
    const undone = turned(moved, undoOf(moved, boxEdit))
    expect(shownBox(undone)).toEqual(from)
    expect(shownBox(turned(undone, redoOf(undone, boxEdit)))).toEqual(to)
  })

  it("leaves text an agent wrote after the person's edit and says nothing could be undone", () => {
    const edited = landed(opened(), { command: "person", value: "New", node })
    const started = landed(edited, { command: "start", runId: run, node })
    const body = started.elements[node]
    if (body === undefined) throw new Error("node")
    const agent = landed(started, { command: "agent", runId: run, readAt: body.readAt ?? 0, value: "Aira", node })
    expect(undoOf(agent, textEdit)).toEqual({ ok: false })
    expect(shownText(agent)).toBe("Aira")
  })

  it("undoes the person's edit again once the agent's run is undone", () => {
    const edited = landed(opened(), { command: "person", value: "New", node })
    const started = landed(edited, { command: "start", runId: run, node })
    const readAt = started.elements[node]?.readAt ?? 0
    const agent = landed(started, { command: "agent", runId: run, readAt, value: "Aira", node })
    const stopped = landed(agent, { command: "stop", runId: run, node })
    const runUndone = landed(stopped, { command: "undo", runId: run, node })
    expect(shownText(runUndone)).toBe("New")
    const undone = turned(runUndone, undoOf(runUndone, textEdit))
    expect(shownText(undone)).toBe("Old")
    expect(undone.elements[node]?.landed.filter((row) => row.actor === "agent").map((row) => row.visible)).toEqual([
      false,
    ])
  })

  it("refuses a redo when someone changed the text after the undo", () => {
    const edited = landed(opened(), { command: "person", value: "New", node })
    const undone = turned(edited, undoOf(edited, textEdit))
    const other = landed(undone, { command: "person", value: "Other", node })
    expect(redoOf(other, textEdit)).toEqual({ ok: false })
  })

  it("refuses to undo an edit on an element that is gone", () => {
    const edited = landed(opened(), { command: "person", value: "New", node })
    const removed = landed(edited, { command: "remove", node })
    expect(undoOf(removed, textEdit)).toEqual({ ok: false })
  })

  it("undoes a slide add by removing it, and redoes it by restoring it in place", () => {
    const opening = openRegister("", "")
    const key = orderKeyAfter(presentSlides({ file, order: [] }), file[0])
    if (key === null) throw new Error("key")
    const added = slid(opening, { slide: "add", id: slideId("259"), after: file[0], key, layout: file[0] })
    expect(order(added.register)).toEqual(["256", "259", "257", "258"])
    const undone = turned(added.register, undoOf(added.register, added.undoable))
    expect(order(undone)).toEqual(["256", "257", "258"])
    expect(order(turned(undone, redoOf(undone, added.undoable)))).toEqual(["256", "259", "257", "258"])
  })

  it("undoes a clone by removing the copy", () => {
    const key = orderKeyAfter(presentSlides({ file, order: [] }), file[1])
    if (key === null) throw new Error("key")
    const cloned = slid(openRegister("", ""), { slide: "clone", id: slideId("259"), source: file[1], key })
    expect(order(turned(cloned.register, undoOf(cloned.register, cloned.undoable)))).toEqual(["256", "257", "258"])
  })

  it("undoes a slide removal by restoring the slide where it was, and redoes it", () => {
    const removed = slid(openRegister("", ""), { slide: "remove", id: file[1] })
    const undone = turned(removed.register, undoOf(removed.register, removed.undoable))
    expect(order(undone)).toEqual(["256", "257", "258"])
    expect(order(turned(undone, redoOf(undone, removed.undoable)))).toEqual(["256", "258"])
  })

  it("undoes a slide move by moving it back, and refuses when someone moved it again", () => {
    const end = orderKeyBetween(presentSlides({ file, order: [] }).at(-1)?.key ?? null, null)
    const moved = slid(openRegister("", ""), { slide: "move", id: file[0], key: end })
    expect(order(moved.register)).toEqual(["257", "258", "256"])
    expect(order(turned(moved.register, undoOf(moved.register, moved.undoable)))).toEqual(["256", "257", "258"])
    const middle = orderKeyBetween(
      presentSlides(moved.register)[0]?.key ?? null,
      presentSlides(moved.register)[1]?.key ?? null,
    )
    const again = landed(moved.register, { command: "slide", file, edit: { slide: "move", id: file[0], key: middle } })
    expect(undoOf(again, moved.undoable)).toEqual({ ok: false })
  })

  it("refuses to undo a slide add once someone else removed that slide", () => {
    const key = orderKeyAfter(presentSlides({ file, order: [] }), file[0])
    if (key === null) throw new Error("key")
    const added = slid(openRegister("", ""), { slide: "add", id: slideId("259"), after: file[0], key, layout: file[0] })
    const gone = landed(added.register, { command: "slide", file, edit: { slide: "remove", id: slideId("259") } })
    expect(undoOf(gone, added.undoable)).toEqual({ ok: false })
  })

  it("gives no undoable for a slide edit the register refuses", () => {
    expect(slideUndoable(openRegister("", ""), file, { slide: "remove", id: slideId("300") })).toBeNull()
  })
})
