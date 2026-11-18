import { describe, expect, it } from "vitest"
import { currentValue, decide, landedPatch, openRegister, type Command, type Register } from "./decide.js"
import { elementId } from "./element-id.js"
import { format } from "./format.js"
import { redoOf, undoOf, type Undoable } from "./person-undo.js"

const node = elementId("256.2")

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function turned(register: Register, turn: ReturnType<typeof undoOf>): Register {
  if (!turn.ok) throw new Error("changed")
  return turn.commands.reduce(landed, register)
}

function edited(): Register {
  const opened = landed(openRegister("", ""), { command: "add", node, floor: "Old", route: "" })
  return landed(opened, { command: "person", value: "New", node })
}

describe("person undo writes a row where format 1 cannot", () => {
  it("turns a step back to the opening value with a row", () => {
    const step = { node, before: { text: { value: "opening" as const } }, after: { text: { value: { set: "New" } } } }
    const turn = undoOf(edited(), { steps: [step] })
    expect(turn.ok && turn.commands).toEqual([
      { command: "person", v: format, patch: { text: { value: "opening" } }, node },
    ])
    expect(currentValue(turned(edited(), turn).elements[node]!)).toBe("Old")
  })

  it("undoes a fill back to the opening fill with a row, and redoes it", () => {
    const after = { fills: { p0: { set: { solid: { scheme: "accent2" as const } } } } }
    const filled: Undoable = { steps: [{ node, before: { fills: { p0: "opening" } }, after }] }
    const fillOf = (register: Register) => landedPatch(register.elements[node]!, "text").fills
    const changed = landed(edited(), { command: "person", v: format, patch: after, node })
    const undone = turned(changed, undoOf(changed, filled))
    expect(fillOf(undone)).toEqual({ p0: "opening" })
    expect(fillOf(turned(undone, redoOf(undone, filled)))).toEqual(after.fills)
    expect(undoOf(undone, filled)).toEqual({ ok: false })
  })
})
