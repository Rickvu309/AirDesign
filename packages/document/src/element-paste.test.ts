import { describe, expect, it } from "vitest"
import {
  cloneOf,
  decide,
  elementGone,
  elementId,
  elementsUndoable,
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

const file = [slideId("256"), slideId("257")]
const box = { x: 100, y: 200, cx: 300, cy: 400 }
const title = elementId("256.2")
const group = elementId("256.4")
const inside = elementId("256.5")
const pasted = elementId("257.9")

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    total: 6,
    slides: [
      { id: "256", position: 0 },
      { id: "257", position: 1 },
    ],
    elements: [
      { node: title, kind: "shape", value: "Title", box, grouped: false },
      { node: elementId("256.3"), kind: "shape", value: "Body", box, grouped: false },
      { node: group, kind: "group", value: null, box, frame: box, grouped: false },
      { node: inside, kind: "shape", value: "Inside", box, grouped: true, group },
      { node: elementId("256.6"), kind: "connector", value: null, box, grouped: false },
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

function typed(register: Register, value: string): Register {
  const added = register.nodes.includes(title)
    ? register
    : decide(register, { command: "add", node: title, floor: "Title", route: "" })
  if ("decision" in added && added.decision !== "apply") throw new Error(added.code)
  const opened = "decision" in added ? added.register : added
  const edited = decide(opened, { command: "person", value, node: title })
  if (edited.decision !== "apply") throw new Error(edited.code)
  return edited.register
}

describe("element paste", () => {
  it("pastes a layer onto another slide with its text, at the box it is given", () => {
    const source = typed(indexed, "Edited")
    const at = { x: 900, y: 50, cx: 300, cy: 400 }
    const made = cloneOf(source, title, pasted, at)
    if (!made.ok) throw new Error(made.refusal)
    expect(made.command).toMatchObject({ slide: "element-clone", id: "257", source: title })
    const after = applied(source, made.command)
    const row: IndexElement | undefined = openingElement(after, pasted)
    expect(row).toMatchObject({ node: pasted, kind: "shape", value: "Edited", box: at, grouped: false })
    expect(row?.group).toBeUndefined()
    expect(after.elements[title]).toEqual(source.elements[title])
    expect(nextElementId(after, file[1]!, 3)).toBe("257.10")
  })

  it("pastes the text a layer had when it was copied, after it changed", () => {
    const copied = typed(indexed, "Copied")
    const snapshot = cloneOf(copied, title, pasted, box)
    if (!snapshot.ok) throw new Error(snapshot.refusal)
    const changed = typed(copied, "Changed later")
    const rows = new Map([[title, snapshot.command.element]])
    const made = cloneOf(changed, title, pasted, box, rows)
    if (!made.ok) throw new Error(made.refusal)
    expect(openingElement(applied(changed, made.command), pasted)?.value).toBe("Copied")
  })

  it("pastes a group onto another slide with a new id for every layer in it, at the slide's level", () => {
    const made = cloneOf(indexed, group, pasted, { ...box, x: 40 })
    if (!made.ok) throw new Error(made.refusal)
    const { element, layers } = made.command
    expect(element).toMatchObject({ node: pasted, kind: "group", grouped: false })
    expect(layers).toEqual([
      { source: inside, element: expect.objectContaining({ node: "257.10", grouped: true, group: pasted }) },
    ])
    const after = applied(indexed, made.command)
    expect(openingElement(after, elementId("257.10"))?.value).toBe("Inside")
  })

  it("pastes a layer inside a group onto another slide at the slide's level", () => {
    const made = cloneOf(indexed, inside, pasted, box)
    if (!made.ok) throw new Error(made.refusal)
    expect(made.command.element).toMatchObject({ node: pasted, grouped: false })
    expect(made.command.element.group).toBeUndefined()
    expect(decide(indexed, { command: "slide", file, edit: made.command }).decision).toBe("apply")
  })

  it("pastes a line onto another slide without the ends it had on its own slide", () => {
    const line = elementId("256.6")
    const ends = { start: { set: { shape: { node: title, site: 1 } } } }
    const connector: IndexElement = { node: line, kind: "connector", value: null, box, grouped: false }
    const ended: IndexElement = {
      ...connector,
      opening: { connection: ends },
      design: { "connection.start": ["256.2"] },
    }
    const rows = new Map([[line, ended]])
    const made = cloneOf(indexed, line, pasted, box, rows)
    if (!made.ok) throw new Error(made.refusal)
    expect(made.command.element.opening).toBeUndefined()
    expect(made.command.element.design).toBeUndefined()
    const kept = cloneOf(indexed, line, elementId("256.9"), box, rows)
    if (!kept.ok) throw new Error(kept.refusal)
    expect(kept.command.element.opening).toEqual({ connection: ends })
  })

  it("pastes a layer that was cut after it was copied", () => {
    const snapshot = cloneOf(indexed, title, pasted, box)
    if (!snapshot.ok) throw new Error(snapshot.refusal)
    const cut = applied(indexed, { slide: "element-remove", id: file[0]!, node: title })
    expect(cloneOf(cut, title, pasted, box)).toEqual({ ok: false, refusal: "dead" })
    const made = cloneOf(cut, title, pasted, box, new Map([[title, snapshot.command.element]]))
    if (!made.ok) throw new Error(made.refusal)
    const after = applied(cut, made.command)
    expect(elementGone(after, pasted)).toBe(false)
    expect(elementGone(after, title)).toBe(true)
  })

  it("pastes a layer from a slide deleted after the copy", () => {
    const made = cloneOf(indexed, title, pasted, box)
    if (!made.ok) throw new Error(made.refusal)
    const removed = applied(indexed, { slide: "remove", id: file[0]! })
    expect(openingElement(applied(removed, made.command), pasted)?.value).toBe("Title")
  })

  it("removes the pasted layer with one undo", () => {
    const made = cloneOf(indexed, title, pasted, box)
    if (!made.ok) throw new Error(made.refusal)
    const undoable = elementsUndoable(indexed, file, [made.command])
    if (undoable === null) throw new Error("no undo")
    const undone = undoOf(applied(indexed, made.command), undoable)
    if (!undone.ok) throw new Error("no undo")
    expect(undone.commands).toEqual([
      { command: "slide", file, edit: { slide: "element-remove", id: file[1], node: pasted } },
    ])
  })

  it("stores a paste onto another slide and reads it back", () => {
    const made = cloneOf(indexed, group, pasted, box)
    if (!made.ok) throw new Error(made.refusal)
    const stored = JSON.parse(JSON.stringify({ file, order: [made.command] })) as unknown
    expect(readSlideState(stored)?.order).toEqual([made.command])
    const astray = { ...made.command, layers: [{ ...made.command.layers![0]!, source: "257.2" }] }
    expect(readSlideState({ file, order: [astray] })).toBeUndefined()
  })
})
