import fc from "fast-check"
import { expect, it } from "vitest"
import { decide, openRegister, type Register } from "./decide.js"
import { slideId } from "./element-id.js"
import { gridGroups } from "./grid-order.js"
import { presentSlides, readSlideState, type SlideCommand } from "./slide-order.js"
import { slideUndoable, undoOf } from "./person-undo.js"

it("partitions every accepted trace and reverses each immediate lifecycle edit", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 20 }),
      fc.array(
        fc.record({
          kind: fc.constantFrom("add", "clone", "remove", "move", "move-many"),
          at: fc.nat(100),
          target: fc.nat(100),
          row: fc.constantFrom("same", "new"),
        }),
        { maxLength: 35 },
      ),
      (count, edits) => {
        const file = Array.from({ length: count }, (_, i) => slideId(String(i + 256)))
        let register: Register = { ...openRegister("", ""), file }
        let next = 300
        for (const operation of edits) {
          const present = presentSlides(register)
          const source = present[operation.at % present.length]!
          const anchor = present[operation.target % present.length]!
          const id = slideId(String(next++))
          const group = present.filter((_, index) => index % 2 === operation.at % 2).map((spot) => spot.id)
          const first = group[0] ?? source.id
          const edit: SlideCommand =
            operation.kind === "move-many"
              ? {
                  slide: "move-many",
                  grid: 1,
                  ids: [first, ...group.slice(1)],
                  after: group.includes(anchor.id) ? null : anchor.id,
                  row: operation.row,
                }
              : operation.kind === "add"
                ? { slide: "add", grid: 1, row: operation.row, id, after: anchor.id, layout: source.id }
                : operation.kind === "clone"
                  ? { slide: "clone", grid: 1, id, source: source.id }
                  : operation.kind === "remove"
                    ? { slide: "remove", grid: 1, id: source.id }
                    : {
                        slide: "move",
                        grid: 1,
                        id: source.id,
                        after: anchor.id === source.id ? null : anchor.id,
                        row: "same",
                      }
          const before = gridGroups(register)
          const undoable = slideUndoable(register, file, edit)
          const decision = decide(register, { command: "slide", file, edit })
          if (decision.decision !== "apply") continue
          register = decision.register
          const rows = gridGroups(register)
          const flat = rows.flat()
          expect(rows.every((row) => row.length > 0)).toBe(true)
          expect(new Set(flat).size).toBe(flat.length)
          expect(flat).toEqual(presentSlides(register).map((spot) => spot.id))
          const decoded = readSlideState(JSON.parse(JSON.stringify(register)))
          if (decoded === undefined) throw new Error("decode")
          expect(gridGroups(decoded)).toEqual(rows)
          if (undoable === null) throw new Error("undoable")
          const undone = undoOf(register, undoable)
          if (!undone.ok) throw new Error("undo")
          let restored = register
          for (const command of undone.commands) {
            const answer = decide(restored, command)
            if (answer.decision !== "apply") throw new Error(answer.code)
            restored = answer.register
          }
          expect(gridGroups(restored)).toEqual(before)
        }
      },
    ),
    { numRuns: 300 },
  )
})
