import { describe, expect, it } from "vitest"
import { currentBox, currentValue, decide, openRegister, type Command, type Register } from "./decide.js"
import { elementId, slideId } from "./element-id.js"
import { orderKeyBetween } from "./order-key.js"
import { elementGone } from "./element-order.js"
import { elementStacks } from "./element-stack.js"
import { orderKeyAfter, presentSlides, type SlideCommand } from "./slide-order.js"
import { redoOf, slideUndoable, undoOf, undoSlides, type Undoable } from "./person-undo.js"

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
  return turn.commands.reduce(landed, register)
}

function slid(register: Register, edit: SlideCommand): { register: Register; undoable: Undoable } {
  const undoable = slideUndoable(register, file, edit)
  if (undoable === null) throw new Error("undoable")
  return { register: landed(register, { command: "slide", file, edit }), undoable }
}

function order(register: Register): readonly string[] {
  return presentSlides(register).map((spot) => spot.id)
}

const textEdit: Undoable = {
  steps: [{ node, before: { text: { value: { set: "Old" } } }, after: { text: { value: { set: "New" } } } }],
}
const from = { x: 0, y: 0, cx: 10, cy: 10 }
const to = { x: 5, y: 5, cx: 10, cy: 10 }
const boxOf = (box: typeof from) => ({
  box: { x: { set: box.x }, y: { set: box.y }, w: { set: box.cx }, h: { set: box.cy } },
})
const boxEdit: Undoable = { steps: [{ node, before: boxOf(from), after: boxOf(to) }] }

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

  it("undoes a bring to front and redoes it, and refuses once that element was moved again", () => {
    const back = elementId("256.2")
    const front = elementId("256.4")
    const among = [back, front]
    const brought = slid(openRegister("", ""), {
      slide: "element-order",
      id: file[0],
      node: back,
      before: null,
      among,
    })
    expect(elementStacks(brought.register)).toEqual([{ slide: file[0], ids: [front, back] }])
    const undone = turned(brought.register, undoOf(brought.register, brought.undoable))
    expect(elementStacks(undone)).toEqual([{ slide: file[0], ids: among }])
    expect(elementStacks(turned(undone, redoOf(undone, brought.undoable)))).toEqual([
      { slide: file[0], ids: [front, back] },
    ])
    const again = landed(brought.register, {
      command: "slide",
      file,
      edit: { slide: "element-order", id: file[0], node: front, before: null, among: [front, back] },
    })
    expect(undoOf(again, brought.undoable)).toEqual({ ok: false })
  })

  it("undoes a speaker notes edit like a text edit", () => {
    const notes = elementId("256.notes")
    const opening = landed(openRegister("", ""), { command: "add", node: notes, floor: "Say hello", route: "" })
    const edited = landed(opening, { command: "person", value: "Say goodbye", node: notes })
    const undoable: Undoable = {
      steps: [
        {
          node: notes,
          before: { notes: { value: { set: "Say hello" } } },
          after: { notes: { value: { set: "Say goodbye" } } },
        },
      ],
    }
    expect(currentValue(turned(edited, undoOf(edited, undoable)).elements[notes]!)).toBe("Say hello")
  })

  it("undoes a table edit by the trait its step names, on a register that has no index", () => {
    const table = elementId("256.4")
    const cells = (text: string) =>
      JSON.stringify({ rows: [{ from: 0, cells: [[{ from: 0, runs: [{ from: -1, text }] }]] }] })
    const opening = landed(openRegister("", ""), { command: "add", node: table, floor: "", route: "" })
    const edited = landed(opening, { command: "person", value: cells("North"), node: table })
    const undoable: Undoable = {
      steps: [
        {
          node: table,
          before: { table: { value: { set: cells("") } } },
          after: { table: { value: { set: cells("North") } } },
        },
      ],
    }
    expect(currentValue(turned(edited, undoOf(edited, undoable)).elements[table]!)).toBe(cells(""))
  })

  it("gives no undoable for a slide edit the register refuses", () => {
    expect(slideUndoable(openRegister("", ""), file, { slide: "remove", id: slideId("300") })).toBeNull()
  })
})

describe("undoing a run's element commands", () => {
  const runId = "run-1"
  const slide = file[0]
  const added = elementId("256.9")
  const box = { x: 10, y: 20, cx: 300, cy: 40 }
  const textBox = { node: added, kind: "shape" as const, value: "", box, grouped: false }

  function indexed(): Register {
    return {
      ...openRegister("", ""),
      index: {
        total: 1,
        slides: [
          { id: "256", position: 0 },
          { id: "257", position: 1 },
          { id: "258", position: 2 },
        ],
        elements: [{ node, kind: "shape", value: "Title", box, grouped: false }],
        pages: [{ once: "page", offset: 0, count: 1 }],
      },
    }
  }

  function slideLanded(register: Register, edit: SlideCommand): Register {
    return landed(register, { command: "slide", file, edit: { ...edit, runId } })
  }

  it("takes back a box the run added", () => {
    const register = slideLanded(indexed(), { slide: "element-add", id: slide, element: textBox })
    const undone = undoSlides(register, runId)
    expect(undone).not.toBeNull()
    expect(undone !== null && elementGone(undone, added)).toBe(true)
  })

  it("brings back an element the run removed", () => {
    const register = slideLanded(indexed(), { slide: "element-remove", id: slide, node })
    expect(elementGone(register, node)).toBe(true)
    const undone = undoSlides(register, runId)
    expect(undone !== null && !elementGone(undone, node)).toBe(true)
  })

  it("takes back an add and a removal of the same box in one run", () => {
    const added1 = slideLanded(indexed(), { slide: "element-add", id: slide, element: textBox })
    const removed = slideLanded(added1, { slide: "element-remove", id: slide, node: added })
    const undone = undoSlides(removed, runId)
    expect(undone !== null && elementGone(undone, added)).toBe(true)
  })

  it("refuses the whole run when a person typed in the box it added", () => {
    const register = slideLanded(indexed(), { slide: "element-add", id: slide, element: textBox })
    const opened = landed(register, { command: "add", node: added, floor: "", route: "" })
    const typed = landed(opened, { command: "person", value: "Mine", node: added })
    expect(undoSlides(typed, runId)).toBeNull()
  })

  it("refuses when a person brought back the element the run removed", () => {
    const register = slideLanded(indexed(), { slide: "element-remove", id: slide, node })
    const restored = landed(register, { command: "slide", file, edit: { slide: "element-restore", id: slide, node } })
    expect(undoSlides(restored, runId)).toBeNull()
  })

  it("refuses when a person removed the box the run added", () => {
    const register = slideLanded(indexed(), { slide: "element-add", id: slide, element: textBox })
    const removed = landed(register, {
      command: "slide",
      file,
      edit: { slide: "element-remove", id: slide, node: added },
    })
    expect(undoSlides(removed, runId)).toBeNull()
  })
})

describe("person undo per trait field", () => {
  const other = elementId("256.3")
  const step = (at: typeof node) => ({
    node: at,
    before: { text: { value: { set: "Old" } } },
    after: { text: { value: { set: "New" } } },
  })

  function both(): Register {
    const added = landed(opened(), { command: "add", node: other, floor: "Old", route: "" })
    return landed(landed(added, { command: "person", value: "New", node }), {
      command: "person",
      value: "New",
      node: other,
    })
  }

  it("undoes the person's text while an agent's later move shows, and keeps the move", () => {
    const edited = landed(opened(), { command: "person", value: "New", node })
    const started = landed(edited, { command: "start", runId: run, node })
    const readAt = started.elements[node]?.readAt ?? 0
    const agent = landed(started, { command: "agent", runId: run, readAt, property: "box", value: to, node })
    const undone = turned(agent, undoOf(agent, textEdit))
    expect([shownText(undone), shownBox(undone)]).toEqual(["Old", to])
  })

  it("turns a step on two elements back on both, and forward again", () => {
    const steps = { steps: [step(node), step(other)] }
    const undone = turned(both(), undoOf(both(), steps))
    expect([shownText(undone), currentValue(undone.elements[other]!)]).toEqual(["Old", "Old"])
    const redone = turned(undone, redoOf(undone, steps))
    expect([shownText(redone), currentValue(redone.elements[other]!)]).toEqual(["New", "New"])
  })

  it("turns no element of a step back once one of them no longer shows the step", () => {
    const changed = landed(both(), { command: "person", value: "Other", node: other })
    expect(undoOf(changed, { steps: [step(node), step(other)] })).toEqual({ ok: false })
    expect(undoOf(changed, { steps: [step(other), step(node)] })).toEqual({ ok: false })
  })

  it("turns a move and a text edit of one element back in one step", () => {
    const moved = landed(landed(opened(), { command: "person", value: "New", node }), {
      command: "person",
      property: "box",
      value: to,
      node,
    })
    const both = {
      steps: [
        {
          node,
          before: { ...boxOf(from), text: { value: { set: "Old" } } },
          after: { ...boxOf(to), text: { value: { set: "New" } } },
        },
      ],
    }
    const undone = turned(moved, undoOf(moved, both))
    expect([shownText(undone), shownBox(undone)]).toEqual(["Old", from])
    const redone = turned(undone, redoOf(undone, both))
    expect([shownText(redone), shownBox(redone)]).toEqual(["New", to])
  })
})
