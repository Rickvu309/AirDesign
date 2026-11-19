import fc from "fast-check"
import { expect, it } from "vitest"
import { decide, openRegister, type Register } from "./decide.js"
import { slideId, type SlideId } from "./element-id.js"
import { gridGroups } from "./grid-order.js"
import { foldSections } from "./section-order.js"
import { orderKeyAfter, presentSlides, foldSlides, type SlideCommand } from "./slide-order.js"
import { slideGroups } from "./slide-groups.js"
import { slideUndoable, undoOf } from "./person-undo.js"

const sizes = fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 0, maxLength: 5 })

function sectionedDeck(lengths: readonly number[], extra: number) {
  const total = lengths.reduce((sum, size) => sum + size, 0) + extra
  const file = Array.from({ length: Math.max(1, total) }, (_, index) => slideId(String(256 + index)))
  const runs: SlideId[][] = []
  let offset = 0
  for (const size of lengths) {
    if (offset >= file.length) break
    runs.push(file.slice(offset, offset + size))
    offset += size
  }
  const last = runs.at(-1)
  if (last !== undefined) last.push(...file.slice(offset))
  return { file, starts: runs.map((run) => run[0]!), runs }
}

it("reads an untouched deck as exactly the file's sections", () => {
  fc.assert(
    fc.property(sizes, fc.nat(4), (lengths, extra) => {
      const { file, starts, runs } = sectionedDeck(lengths, extra)
      const groups = slideGroups({ file, order: [], sectionStarts: starts })
      const expected = runs.length === 0 ? [file] : runs
      expect(groups.map((group) => group.slides)).toEqual(expected)
      expect(groups.map((group) => group.key)).toEqual(expected.map((_, k) => `f${String(k)}`))
    }),
  )
})

const step = fc.record({
  kind: fc.constantFrom("add", "clone", "remove", "move", "move-many", "remove-many", "keep", "undo"),
  version: fc.constantFrom(0, 1, 2, 3, 3),
  at: fc.nat(100),
  target: fc.nat(100),
  row: fc.constantFrom("same", "new", "before"),
})

type Step = typeof step extends fc.Arbitrary<infer Value> ? Value : never

function edit(register: Register, operation: Step, next: SlideId): SlideCommand | null {
  const present = presentSlides(register)
  const source = present[operation.at % present.length]!
  const anchor = present[operation.target % present.length]!
  const others = present.filter((spot) => spot.id !== anchor.id)
  const group = others.filter((_, index) => index % 3 === operation.at % 3).map((spot) => spot.id)
  const first = group[0] ?? source.id
  if (operation.version === 0) {
    const key = orderKeyAfter(present, anchor.id)
    if (operation.kind === "remove") return { slide: "remove", id: source.id }
    if (operation.kind === "add" && key !== null)
      return { slide: "add", id: next, after: anchor.id, key, layout: anchor.id }
    if (operation.kind === "clone" && key !== null) return { slide: "clone", id: next, source: anchor.id, key }
    if (key === null || anchor.id === source.id) return null
    const gone = foldSlides(register).find((spot) => !spot.present)
    if (operation.kind === "undo" && gone !== undefined) return { slide: "restore", id: gone.id, key }
    return { slide: "move", id: source.id, key }
  }
  const grid = operation.version as 1 | 2 | 3
  const row = operation.row === "before" ? "same" : operation.row
  if (operation.kind === "add") return { slide: "add", grid, row, id: next, after: anchor.id, layout: anchor.id }
  if (operation.kind === "clone") return { slide: "clone", grid, id: next, source: source.id }
  if (operation.kind === "remove") return { slide: "remove", grid, id: source.id }
  if (operation.kind === "remove-many") return { slide: "remove-many", grid, ids: [first, ...group.slice(1)] }
  if (operation.kind === "keep") {
    const whole = gridGroups(register, grid)[operation.at % gridGroups(register, grid).length]!
    const after = operation.target % 2 === 0 || whole.includes(anchor.id) ? null : anchor.id
    return { slide: "move-many", grid, ids: whole, after, row: "keep" }
  }
  if (operation.kind === "move" && anchor.id !== source.id)
    return { slide: "move", grid, id: source.id, after: anchor.id, row: "same" }
  if (operation.row === "before")
    return { slide: "move-many", grid, ids: [first, ...group.slice(1)], before: anchor.id, row: "before" }
  return { slide: "move-many", grid, ids: [first, ...group.slice(1)], after: anchor.id, row }
}

it("keeps every trace a partition with unique keys, and lands an older command only with its version three meaning", () => {
  fc.assert(
    fc.property(sizes, fc.nat(4), fc.array(step, { maxLength: 25 }), (lengths, extra, steps) => {
      const { file, starts } = sectionedDeck(lengths, extra)
      let register: Register = { ...openRegister("", ""), file, sectionStarts: starts }
      let last: { register: Register; undoable: NonNullable<ReturnType<typeof slideUndoable>> } | null = null
      let next = 300
      for (const operation of steps) {
        const command: SlideCommand | null =
          operation.kind === "undo" && operation.version !== 0 && last !== null
            ? (() => {
                const undo = undoOf(register, last.undoable)
                return undo.ok ? (undo.commands[0]?.command === "slide" ? undo.commands[0].edit : null) : null
              })()
            : edit(register, operation, slideId(String(next++)))
        if (command === null) continue
        const undoable = slideUndoable(register, file, command)
        const answer = decide(register, { command: "slide", file, edit: command })
        if (answer.decision !== "apply") continue
        const switched = register.order.some((row) => row.grid === 3)
        if (switched && command.grid !== undefined && command.grid !== 3) {
          const today = decide(register, { command: "slide", file, edit: { ...command, grid: 3 } as SlideCommand })
          if (today.decision !== "apply") throw new Error(today.code)
          expect(gridGroups(answer.register)).toEqual(gridGroups(today.register))
          expect(slideGroups(answer.register)).toEqual(slideGroups(today.register))
        }
        register = answer.register
        if (undoable !== null) last = { register, undoable }
        const groups = slideGroups(register)
        const flat = groups.flatMap((group) => group.slides)
        expect(flat).toEqual(presentSlides(register).map((spot) => spot.id))
        expect(new Set(groups.map((group) => group.key)).size).toBe(groups.length)
        if (register.order.some((row) => row.grid === 3))
          expect(gridGroups(register)).toEqual(groups.map((group) => group.slides))
      }
    }),
    { numRuns: 300 },
  )
})

it("reads a log of commands from before Grid as today's exported sections", () => {
  fc.assert(
    fc.property(sizes, fc.nat(4), fc.array(step, { maxLength: 20 }), (lengths, extra, steps) => {
      const { file, starts, runs } = sectionedDeck(lengths, extra)
      let register: Register = { ...openRegister("", ""), file, sectionStarts: starts }
      let next = 300
      for (const operation of steps) {
        const command = edit(register, { ...operation, version: 0 }, slideId(String(next++)))
        if (command === null) continue
        const answer = decide(register, { command: "slide", file, edit: command })
        if (answer.decision === "apply") register = answer.register
      }
      const base = (runs.length === 0 ? [file] : runs).map((slides, k) => ({ name: `s${String(k)}`, slides }))
      const sections = foldSections(register, base)
      const expected = sections.flatMap((section, k) =>
        section.slides.length === 0 ? [] : [{ key: `f${String(k)}`, name: section.name, slides: section.slides }],
      )
      expect(
        slideGroups(
          register,
          base.map((section) => section.name),
        ),
      ).toEqual(expected)
    }),
  )
})
