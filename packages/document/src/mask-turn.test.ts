import { describe, expect, it } from "vitest"
import {
  decide,
  landedPatch,
  elementId,
  groupedNow,
  groupFormed,
  maskTurn,
  openRegister,
  redoOf,
  slideId,
  undoOf,
  type Command,
  type IndexElement,
  type Register,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const a = elementId("256.2")
const b = elementId("256.3")
const g = elementId("256.4")
const first = elementId("256.5")
const second = elementId("256.6")
const title = elementId("256.7")
const made = elementId("256.20")

const elements: readonly IndexElement[] = [
  { node: a, kind: "shape", value: "", box: { x: 100, y: 100, cx: 200, cy: 100 }, grouped: false },
  { node: b, kind: "shape", value: "", box: { x: 400, y: 300, cx: 100, cy: 100 }, grouped: false },
  {
    node: g,
    kind: "group",
    value: null,
    box: { x: 1000, y: 1000, cx: 400, cy: 200 },
    grouped: false,
    frame: { x: 0, y: 0, cx: 200, cy: 100 },
  },
  { node: first, kind: "shape", value: "", box: { x: 0, y: 0, cx: 100, cy: 100 }, grouped: true, group: g },
  { node: second, kind: "shape", value: "", box: { x: 100, y: 0, cx: 100, cy: 100 }, grouped: true, group: g },
  { node: title, kind: "shape", value: "Title", box: { x: 0, y: 0, cx: 900, cy: 100 }, grouped: false, role: "title" },
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

const masked = (register: Register) => {
  const body = register.elements[a]
  const field = body === undefined ? undefined : landedPatch(body, "text").identity?.mask
  return typeof field === "object" ? field.set : undefined
}

describe("Use as mask groups the layers and makes the back one the mask, as one undo", () => {
  it("groups the two layers as a mask group and marks the back layer a mask", () => {
    const turn = maskTurn(indexed, file, slide, made, [b, a], a)!
    const after = ran(indexed, turn.commands)
    expect(groupFormed(after, made)).toBe(true)
    expect(groupedNow(after, a)).toBe(true)
    expect(masked(after)).toBe(true)
  })

  it("takes back the mask and the group with one undo, and puts both back with one redo", () => {
    const turn = maskTurn(indexed, file, slide, made, [a, b], a)!
    const after = ran(indexed, turn.commands)
    const undone = undoOf(after, turn.undoable)
    if (!undone.ok) throw new Error("undo")
    const back = ran(after, undone.commands)
    expect(groupFormed(back, made)).toBe(false)
    expect(masked(back)).not.toBe(true)
    const redone = redoOf(back, turn.undoable)
    if (!redone.ok) throw new Error("redo")
    const again = ran(back, redone.commands)
    expect(groupFormed(again, made)).toBe(true)
    expect(masked(again)).toBe(true)
  })

  it("makes no mask of one layer or of layers on another slide", () => {
    expect(maskTurn(indexed, file, slide, made, [a], a)).toBeNull()
    expect(maskTurn(indexed, file, slide, made, [a, elementId("257.2")], a)).toBeNull()
    expect(maskTurn(indexed, file, slide, made, [a, b], title)).toBeNull()
  })
})
