import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { decide, openRegister, type Register } from "./decide.js"
import { slideId, type SlideId } from "./element-id.js"
import { orderKeyBetween } from "./order-key.js"
import { slideUndoable, undoOf } from "./person-undo.js"
import { foldSections, type FileSection } from "./section-order.js"
import { orderKeyAfter, presentSlides, type SlideCommand } from "./slide-order.js"

const file = ["256", "257", "258", "259"].map(slideId)

type Pick = { readonly kind: "add" | "clone" | "move" | "remove" | "restore"; readonly at: number; readonly to: number }

function slideState(register: Register) {
  return { file, order: register.order }
}

function present(register: Register) {
  return presentSlides(slideState(register))
}

function commandOf(register: Register, pick: Pick, fresh: SlideId): SlideCommand | null {
  const shown = present(register)
  const chosen = shown[pick.at % shown.length]
  if (chosen === undefined) return null
  if (pick.kind === "add" || pick.kind === "clone") {
    const key = orderKeyAfter(shown, chosen.id)
    if (key === null) return null
    return pick.kind === "add"
      ? { slide: "add", id: fresh, after: chosen.id, key, layout: chosen.id }
      : { slide: "clone", id: fresh, source: chosen.id, key }
  }
  if (pick.kind === "remove") return shown.length > 1 ? { slide: "remove", id: chosen.id } : null
  if (pick.kind === "restore") {
    const gone = register.order.flatMap((row) => (row.slide === "remove" ? [row.id] : []))
    const back = gone.find((id) => !shown.some((spot) => spot.id === id))
    const last = shown.at(-1)
    if (back === undefined || last === undefined) return null
    return { slide: "restore", id: back, key: orderKeyBetween(last.key, null) }
  }
  const rest = shown.filter((spot) => spot.id !== chosen.id)
  const slot = pick.to % (rest.length + 1)
  const key = orderKeyBetween(rest[slot - 1]?.key ?? null, rest[slot]?.key ?? null)
  return { slide: "move", id: chosen.id, key }
}

function sectioned(register: Register, base: readonly FileSection[]) {
  return foldSections(slideState(register), base).map((section) => ({
    name: section.name,
    slides: [...section.slides],
  }))
}

function applied(register: Register, edit: SlideCommand): Register {
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

const bases = fc.integer({ min: 1, max: 3 }).map((split): FileSection[] => [
  { name: "Opening", slides: file.slice(0, split) },
  { name: "Numbers", slides: file.slice(split) },
])

const picks = fc.array(
  fc.record({
    kind: fc.constantFrom<Pick["kind"]>("add", "clone", "move", "remove", "restore"),
    at: fc.nat({ max: 7 }),
    to: fc.nat({ max: 7 }),
  }),
  { maxLength: 6 },
)

describe("foldSections over any slide command log", () => {
  it("puts every present slide in exactly one section, keeps sections as runs in slide order and keeps every name", () => {
    fc.assert(
      fc.property(bases, picks, (base, chosen) => {
        let register = openRegister("", "")
        for (const [index, pick] of chosen.entries()) {
          const edit = commandOf(register, pick, slideId(String(300 + index)))
          if (edit !== null) register = applied(register, edit)
          const sections = sectioned(register, base)
          expect(sections.map((section) => section.name)).toEqual(base.map((section) => section.name))
          expect(sections.flatMap((section) => section.slides)).toEqual(present(register).map((spot) => spot.id))
        }
      }),
      { numRuns: 300 },
    )
  })

  it("restores the sections a person's undo of an add, a duplicate, a move, a delete or a restore goes back to", () => {
    fc.assert(
      fc.property(bases, picks, (base, chosen) => {
        let register = openRegister("", "")
        for (const [index, pick] of chosen.entries()) {
          const edit = commandOf(register, pick, slideId(String(300 + index)))
          if (edit === null) continue
          const undoable = slideUndoable(register, file, edit)
          if (undoable === null) continue
          if (
            "slide" in undoable &&
            !("element" in undoable) &&
            undoable.before.present &&
            undoable.before.key === undoable.after.key
          )
            continue
          const before = sectioned(register, base)
          const after = applied(register, edit)
          const undone = undoOf(after, undoable)
          if (!undone.ok) throw new Error("undo")
          const back = decide(after, undone.command)
          if (back.decision !== "apply") throw new Error(back.code)
          expect(sectioned(back.register, base)).toEqual(before)
          register = after
        }
      }),
      { numRuns: 300 },
    )
  })
})

it("puts a moved slide back in its own section when a person undoes the move", () => {
  const base = [
    { name: "Opening", slides: ["256", "257"] },
    { name: "Numbers", slides: ["258", "259"] },
  ]
  const opened = openRegister("", "")
  const shown = present(opened)
  const last = shown.at(-1)
  if (last === undefined) throw new Error("slides")
  const move: SlideCommand = { slide: "move", id: slideId("258"), key: orderKeyBetween(last.key, null) }
  const undoable = slideUndoable(opened, file, move)
  if (undoable === null) throw new Error("undoable")
  const moved = applied(opened, move)
  const undone = undoOf(moved, undoable)
  if (!undone.ok) throw new Error("undo")
  const back = decide(moved, undone.command)
  if (back.decision !== "apply") throw new Error(back.code)
  expect(sectioned(back.register, base)).toEqual(sectioned(opened, base))
})
