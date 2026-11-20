import { describe, expect, it } from "vitest"
import {
  cloneOf,
  decide,
  elementGone,
  elementId,
  openRegister,
  redoOf,
  slideId,
  swapUndoable,
  undoOf,
  type Command,
  type Register,
  type SlideCommand,
} from "./index.js"

const file = [slideId("256")]
const box = { x: 100, y: 200, cx: 300, cy: 400 }
const kept = elementId("256.2")
const replaced = elementId("256.3")
const copy = elementId("256.9")

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    total: 2,
    slides: [{ id: "256", position: 0 }],
    elements: [
      { node: kept, kind: "shape", value: "Kept", box, grouped: false },
      { node: replaced, kind: "shape", value: "Replaced", box: { ...box, x: 900 }, grouped: false },
    ],
    pages: [{ once: "page", offset: 0, count: 2 }],
  },
}

function landed(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    return decision.register
  }, register)
}

describe("swap undo", () => {
  it("takes away a paste and brings back the layer it replaced in one undo, and redoes both", () => {
    const made = cloneOf(indexed, kept, copy, { ...box, x: 900 })
    if (!made.ok) throw new Error(made.refusal)
    const removal: SlideCommand = { slide: "element-remove", id: file[0]!, node: replaced }
    const undoable = swapUndoable(indexed, file, [made.command], [removal])
    if (undoable === null) throw new Error("no undo")
    const after = landed(
      indexed,
      [made.command, removal].map((edit) => ({ command: "slide", file, edit }) as const),
    )
    expect([elementGone(after, copy), elementGone(after, replaced)]).toEqual([false, true])
    const undone = undoOf(after, undoable)
    if (!undone.ok) throw new Error("no undo")
    const back = landed(after, undone.commands)
    expect([elementGone(back, copy), elementGone(back, replaced)]).toEqual([true, false])
    const redone = redoOf(back, undone.undoable)
    if (!redone.ok) throw new Error("no redo")
    const again = landed(back, redone.commands)
    expect([elementGone(again, copy), elementGone(again, replaced)]).toEqual([false, true])
  })
})
