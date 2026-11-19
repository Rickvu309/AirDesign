import { expect, it } from "vitest"
import {
  decide,
  gridGroups,
  limits,
  openRegister,
  readSlideState,
  slideId,
  slideUndoable,
  undoOf,
  type Register,
  type SlideCommand,
} from "./index.js"

const opening = (...ids: number[]) => ids.map((id) => slideId(String(id)))
const file = opening(1, 2, 3, 4, 5, 6, 7)
const whole = [file.slice(0, 4), file.slice(4)]
const first = openRegister("slide", "")

function read(raw: object): SlideCommand {
  const edit = readSlideState({ file, order: [raw] })?.order[0]
  if (edit === undefined) throw new Error("unreadable slide command")
  return edit
}

function land(register: Register, edit: SlideCommand): Register {
  const applied = decide(register, { command: "slide", file, edit })
  if (applied.decision !== "apply") throw new Error(applied.code)
  return applied.register
}

function returnToOpening(edit: SlideCommand, landed: Register) {
  const undoable = slideUndoable(first, file, edit)
  if (undoable === null) throw new Error("missing undo")
  const turn = undoOf(landed, undoable)
  if (!turn.ok) throw new Error("refused undo")
  expect(turn.commands).toHaveLength(1)
  const command = turn.commands[0]!
  const undone = decide(landed, command)
  if (undone.decision !== "apply") throw new Error(undone.code)
  expect(gridGroups(undone.register)).toEqual(whole)
}

it("deletes slide group heads and the rest of a selected slide group in one reversible edit", () => {
  const edit = read({ slide: "remove-many", grid: 1, ids: opening(1, 5, 6, 7) })
  const landed = land(first, edit)
  expect(landed.order).toEqual([edit])
  expect(gridGroups(landed)).toEqual([opening(2, 3, 4)])
  returnToOpening(edit, landed)
})

it("duplicates a selection in presentation order after its last slide in one reversible edit", () => {
  const edit = read({
    slide: "clone-many",
    grid: 1,
    copies: [
      { id: "9", source: "6" },
      { id: "8", source: "2" },
    ],
  })
  const landed = land(first, edit)
  expect(landed.order).toEqual([edit])
  expect(gridGroups(landed)).toEqual([opening(1, 2, 3, 4), opening(5, 6, 8, 9, 7)])
  returnToOpening(edit, landed)
})

it("refuses to delete the whole deck or duplicate a set past the slide limit", () => {
  const remove = read({ slide: "remove-many", grid: 1, ids: file })
  expect(decide(first, { command: "slide", file, edit: remove })).toMatchObject({ decision: "refuse", code: "dead" })
  const almostFull = Array.from({ length: limits.slides - 1 }, (_, at) => slideId(String(at + 1)))
  const clone = read({
    slide: "clone-many",
    grid: 1,
    copies: [
      { id: "51", source: "1" },
      { id: "52", source: "2" },
    ],
  })
  expect(decide(first, { command: "slide", file: almostFull, edit: clone })).toMatchObject({
    decision: "refuse",
    code: "limit",
  })
})

it("refuses to undo the whole duplicate after another edit moves one copy", () => {
  const edit = read({
    slide: "clone-many",
    grid: 1,
    copies: [
      { id: "8", source: "2" },
      { id: "9", source: "6" },
    ],
  })
  const undoable = slideUndoable(first, file, edit)
  if (undoable === null) throw new Error("missing undo")
  const copied = land(first, edit)
  const moved = land(copied, read({ slide: "move", grid: 1, id: "8", after: null, row: "same" }))
  expect(undoOf(moved, undoable)).toMatchObject({ ok: false })
  expect(gridGroups(moved)).toEqual([opening(8, 1, 2, 3, 4), opening(5, 6, 9, 7)])
})
