import { describe, expect, it } from "vitest"
import {
  cloneOf,
  decide,
  elementGone,
  elementId,
  elementStacks,
  elementsUndoable,
  format,
  nextElementId,
  openingElement,
  openRegister,
  readSlideState,
  slideId,
  undoOf,
  type IndexElement,
  type Register,
  type SlideCommand,
} from "./index.js"
import { newerSlideCommand } from "./slide-order.js"

const file = [slideId("256"), slideId("257")]
const box = { x: 100, y: 200, cx: 300, cy: 400 }
const title = elementId("256.2")
const copy = elementId("256.9")

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    total: 6,
    slides: [
      { id: "256", position: 0 },
      { id: "257", position: 1 },
    ],
    elements: [
      { node: title, kind: "shape", value: "Title", box, grouped: false, role: "title" },
      { node: elementId("256.3"), kind: "shape", value: "Body", box, grouped: false },
      { node: elementId("256.4"), kind: "group", value: null, box, grouped: false },
      { node: elementId("256.5"), kind: "shape", value: "Inside", box, grouped: true, group: elementId("256.4") },
      { node: elementId("256.6"), kind: "chart", value: null, box, grouped: false },
      { node: elementId("257.2"), kind: "shape", value: "Other", box, grouped: false },
    ],
    pages: [{ once: "page", offset: 0, count: 6 }],
  },
}

function applied(register: Register, edit: SlideCommand): Register {
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function painted(register: Register): Register {
  const added = decide(register, { command: "add", node: title, floor: "Title", route: "" })
  if (added.decision !== "apply") throw new Error(added.code)
  const typed = decide(added.register, { command: "person", value: "Edited", node: title })
  if (typed.decision !== "apply") throw new Error(typed.code)
  const filled = decide(typed.register, {
    command: "person",
    v: format,
    patch: { box: { rot: { set: 60000 }, flipH: { set: true } } },
    node: title,
  })
  if (filled.decision !== "apply") throw new Error(filled.code)
  return filled.register
}

describe("element clone", () => {
  it("copies a layer with its text and look into a box of its own, and leaves the source as it was", () => {
    const source = painted(indexed)
    const moved = { x: 500, y: 600, cx: 300, cy: 400 }
    const made = cloneOf(source, title, copy, moved)
    if (!made.ok) throw new Error(made.refusal)
    const command = made.command
    const cloned = applied(source, command)
    const row: IndexElement | undefined = openingElement(cloned, copy)
    expect(row).toMatchObject({ node: copy, kind: "shape", value: "Edited", box: moved, grouped: false, role: "title" })
    expect(row?.opening?.box?.rot).toEqual({ set: 60000 })
    expect(row?.opening?.box?.flipH).toEqual({ set: true })
    expect(row?.opening?.box?.x).toBeUndefined()
    expect(cloned.elements[title]).toEqual(source.elements[title])
    expect(nextElementId(cloned, file[0]!, 7)).toBe("256.10")
  })

  it("removes the copy with one undo and only the copy", () => {
    const made = cloneOf(indexed, title, copy, box)
    if (!made.ok) throw new Error(made.refusal)
    const command = made.command
    const undoable = elementsUndoable(indexed, file, [command])
    if (undoable === null) throw new Error("no undo")
    const cloned = applied(indexed, command)
    const undone = undoOf(cloned, undoable)
    if (!undone.ok) throw new Error("no undo")
    expect(undone.commands).toEqual([
      { command: "slide", file, edit: { slide: "element-remove", id: file[0], node: copy } },
    ])
    let register = cloned
    for (const each of undone.commands) {
      const decision = decide(register, each)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    expect(elementGone(register, copy)).toBe(true)
    expect(elementGone(register, title)).toBe(false)
  })

  it("puts the copy directly above its source in a stack a person reordered", () => {
    const among = [title, elementId("256.3"), elementId("256.6")]
    const ordered = applied(indexed, {
      slide: "element-order",
      id: file[0]!,
      node: elementId("256.6"),
      before: title,
      among,
    })
    const made = cloneOf(ordered, title, copy, box)
    if (!made.ok) throw new Error(made.refusal)
    const command = made.command
    expect(elementStacks(applied(ordered, command))).toEqual([
      { slide: file[0], ids: [elementId("256.6"), title, copy, elementId("256.3")] },
    ])
  })

  it("refuses a copy of a group or a layer whose group's own space is unknown, a chart, a gone layer or a used id", () => {
    const refused = (edit: SlideCommand) => decide(indexed, { command: "slide", file, edit }).decision
    const cloned = cloneOf(indexed, title, copy, box)
    if (!cloned.ok) throw new Error(cloned.refusal)
    const made = cloned.command
    expect(refused(made)).toBe("apply")
    expect(cloneOf(indexed, elementId("256.4"), copy, box)).toEqual({ ok: false, refusal: "kind" })
    expect(cloneOf(indexed, elementId("256.5"), copy, box)).toEqual({ ok: false, refusal: "group-box" })
    expect(cloneOf(indexed, elementId("256.6"), copy, box)).toEqual({ ok: false, refusal: "kind" })
    expect(refused({ ...made, source: elementId("256.4"), element: { ...made.element, kind: "group" } })).toBe("refuse")
    expect(refused({ ...made, source: elementId("256.5") })).toBe("refuse")
    expect(refused({ ...made, source: elementId("256.6"), element: { ...made.element, kind: "chart" } })).toBe("refuse")
    expect(refused({ ...made, element: { ...made.element, node: elementId("256.3") } })).toBe("refuse")
    expect(refused({ ...made, element: { ...made.element, node: elementId("257.9") } })).toBe("refuse")
    expect(refused({ ...made, element: { ...made.element, box: null } })).toBe("refuse")
    const gone = applied(indexed, { slide: "element-remove", id: file[0]!, node: title })
    expect(cloneOf(gone, title, copy, box)).toEqual({ ok: false, refusal: "dead" })
  })

  it("stores the command and reads it back", () => {
    const cloned = cloneOf(painted(indexed), title, copy, box)
    if (!cloned.ok) throw new Error(cloned.refusal)
    const made = cloned.command
    const stored = JSON.parse(JSON.stringify({ file, order: [made] })) as unknown
    expect(readSlideState(stored)?.order).toEqual([made])
    expect(newerSlideCommand(made)).toBe(false)
    expect(readSlideState({ file, order: [{ ...made, source: "257" }] })).toBeUndefined()
  })
})
