import { describe, expect, it } from "vitest"
import {
  backgroundOf,
  decide,
  openRegister,
  readSlideState,
  redoOf,
  slideId,
  slideUndoable,
  undoOf,
  undoSlides,
  type Command,
  type Register,
  type SlideCommand,
} from "./index.js"

const file = [slideId("256"), slideId("257")]
const first = slideId("256")
const second = slideId("257")
const accent = { scheme: "accent1" } as const
const navy = { rgb: "0F2433" } as const

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function set(register: Register, edit: SlideCommand): Register {
  return landed(register, { command: "slide", file, edit })
}

describe("slide background", () => {
  it("keeps the file's background until a colour is set, and the last colour set wins", () => {
    const opened = openRegister("", "")
    expect(backgroundOf(opened, first)).toBeNull()
    const painted = set(opened, { slide: "background", id: first, color: accent })
    expect(backgroundOf(painted, first)).toEqual(accent)
    expect(backgroundOf(painted, second)).toBeNull()
    const repainted = set(painted, { slide: "background", id: first, color: navy })
    expect(backgroundOf(repainted, first)).toEqual(navy)
    expect(backgroundOf(set(repainted, { slide: "background", id: first, color: null }), first)).toBeNull()
  })

  it("refuses a colour on a slide that is gone or never was", () => {
    const removed = set(openRegister("", ""), { slide: "remove", id: second })
    const edit = (id: string): Command => ({
      command: "slide",
      file,
      edit: { slide: "background", id: slideId(id), color: accent },
    })
    expect(decide(removed, edit("257"))).toEqual({ decision: "refuse", code: "dead" })
    expect(decide(removed, edit("300"))).toEqual({ decision: "refuse", code: "dead" })
  })

  it("reads a theme colour, an RGB colour, their transforms and the file's background from the wire, and nothing else", () => {
    const read = (color: unknown) => readSlideState({ file, order: [{ slide: "background", id: "256", color }] })
    expect(read(accent)?.order).toEqual([{ slide: "background", id: first, color: accent }])
    expect(read(navy)?.order).toEqual([{ slide: "background", id: first, color: navy }])
    expect(read(null)?.order).toEqual([{ slide: "background", id: first, color: null }])
    const darker = { scheme: "hlink", transforms: [{ op: "lumMod", val: 75000 }] }
    expect(read(darker)?.order).toEqual([{ slide: "background", id: first, color: darker }])
    expect(read({ scheme: "phClr" })).toBeUndefined()
    expect(read({ scheme: "accent1", transforms: [] })).toBeUndefined()
    expect(read({ rgb: "0f2433" })).toBeUndefined()
    expect(read({ rgb: "0F2433", scheme: "dk1" })).toBeUndefined()
    expect(read("accent1")).toBeUndefined()
    expect(read(undefined)).toBeUndefined()
  })

  it("undoes a person's colour back to the file's background, and redoes it", () => {
    const opened = openRegister("", "")
    const edit: SlideCommand = { slide: "background", id: first, color: accent }
    const undoable = slideUndoable(opened, file, edit)
    expect(undoable).toEqual({ slide: first, file, background: { before: null, after: accent } })
    if (undoable === null) throw new Error("undoable")
    const painted = set(opened, edit)
    const undo = undoOf(painted, undoable)
    if (!undo.ok) throw new Error("changed")
    const undone = landed(painted, undo.command)
    expect(backgroundOf(undone, first)).toBeNull()
    const redo = redoOf(undone, undoable)
    if (!redo.ok) throw new Error("changed")
    expect(backgroundOf(landed(undone, redo.command), first)).toEqual(accent)
  })

  it("leaves a colour someone changed after the edit", () => {
    const opened = openRegister("", "")
    const edit: SlideCommand = { slide: "background", id: first, color: accent }
    const undoable = slideUndoable(opened, file, edit)
    if (undoable === null) throw new Error("undoable")
    const changed = set(set(opened, edit), { slide: "background", id: first, color: navy })
    expect(undoOf(changed, undoable)).toEqual({ ok: false })
  })

  it("takes back every colour a run set and leaves a person's colour on another slide", () => {
    const person = set(openRegister("", ""), { slide: "background", id: second, color: navy })
    const before = set(person, { slide: "background", id: first, color: navy })
    const runId = "run"
    const once = set(before, { slide: "background", id: first, color: accent, runId })
    const twice = set(once, { slide: "background", id: first, color: { scheme: "dk2" }, runId })
    const undone = undoSlides(twice, runId)
    if (undone === null) throw new Error("undo")
    expect(backgroundOf(undone, first)).toEqual(navy)
    expect(backgroundOf(undone, second)).toEqual(navy)
  })

  it("refuses to take back a run's colour a person changed since", () => {
    const runId = "run"
    const ran = set(openRegister("", ""), { slide: "background", id: first, color: accent, runId })
    const changed = set(ran, { slide: "background", id: first, color: navy })
    expect(undoSlides(changed, runId)).toBeNull()
  })
})
