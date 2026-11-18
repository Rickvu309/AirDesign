import { describe, expect, it } from "vitest"
import {
  beforeOf,
  changeFills,
  decide,
  elementId,
  format,
  landedPatch,
  openRegister,
  redoOf,
  slideId,
  undoOf,
  type Command,
  type ElementPatch,
  type Register,
} from "./index.js"

const file = [slideId("256"), slideId("257")]
const node = elementId("256.slide")
const accent: ElementPatch = { fills: changeFills({ paint: { solid: { scheme: "accent1" } } }) }
const navy: ElementPatch = { fills: changeFills({ paint: { solid: { rgb: "0F2433" } } }) }

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function opened(): Register {
  return landed(openRegister("", ""), { command: "add", node, floor: "", route: "" })
}

function painted(register: Register, patch: ElementPatch): Register {
  return landed(register, { command: "person", node, v: format, patch })
}

function shown(register: Register) {
  const body = register.elements[node]
  return body === undefined ? undefined : landedPatch(body, "text").fills?.p0
}

describe("a slide's background is a fills row on the slide's own node", () => {
  it("keeps the opening background until a fill is set, and the last fill set wins", () => {
    expect(shown(opened())).toBeUndefined()
    expect(shown(painted(opened(), accent))).toEqual({ set: { solid: { scheme: "accent1" } } })
    expect(shown(painted(painted(opened(), accent), navy))).toEqual({ set: { solid: { rgb: "0F2433" } } })
  })

  it("refuses a fill on a slide that is gone", () => {
    const removed = landed(opened(), { command: "slide", file, edit: { slide: "remove", id: slideId("256") } })
    expect(decide(removed, { command: "person", node, v: format, patch: accent })).toEqual({
      decision: "refuse",
      code: "dead",
    })
  })

  it("undoes a person's fill back to the opening background, and redoes it", () => {
    const step = { node, before: beforeOf({}, accent), after: accent }
    expect(step.before).toEqual({ fills: { p0: "opening", p1: "opening", p2: "opening", p3: "opening" } })
    const filled = painted(opened(), accent)
    const undo = undoOf(filled, { steps: [step] })
    if (!undo.ok) throw new Error("changed")
    const undone = undo.commands.reduce(landed, filled)
    expect(shown(undone)).toBe("opening")
    const redo = redoOf(undone, { steps: [step] })
    if (!redo.ok) throw new Error("changed")
    expect(shown(redo.commands.reduce(landed, undone))).toEqual({ set: { solid: { scheme: "accent1" } } })
  })

  it("leaves a fill someone changed after the edit", () => {
    const step = { node, before: beforeOf({}, accent), after: accent }
    expect(undoOf(painted(painted(opened(), accent), navy), { steps: [step] })).toEqual({ ok: false })
  })
})
