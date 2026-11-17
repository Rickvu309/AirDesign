import fc from "fast-check"
import { expect, it } from "vitest"
import { decide, openRegister } from "./decide.js"
import { slideId } from "./element-id.js"
import { gridRows } from "./grid-order.js"
import { slideUndoable, undoOf, redoOf } from "./person-undo.js"
import { presentSlides, readSlideState, type SlideCommand } from "./slide-order.js"

it("keeps every generated complete row together through one move and one inverse", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 50 }), fc.nat(100), fc.nat(100), (count, source, target) => {
      const file = Array.from({ length: count }, (_, i) => slideId(String(i + 1)))
      const before = { ...openRegister("", ""), file }
      const rows = gridRows(before),
        row = rows[source % rows.length]!
      const rest = presentSlides(before).filter((spot) => !row.includes(spot.id))
      const edit: SlideCommand = {
        slide: "move-many",
        grid: 1,
        ids: [row[0], ...row.slice(1).reverse()],
        after: rest[target % (rest.length + 1)]?.id ?? null,
        row: "keep",
      }
      const undoable = slideUndoable(before, file, edit)
      const answer = decide(before, { command: "slide", file, edit })
      if (answer.decision !== "apply" || undoable === null) throw new Error("move")
      expect(gridRows(answer.register)).toContainEqual(row)
      expect(readSlideState(JSON.parse(JSON.stringify(answer.register)))).toEqual({
        file,
        order: answer.register.order,
      })
      const undone = undoOf(answer.register, undoable)
      if (!undone.ok || undone.commands[0] === undefined) throw new Error("undo")
      const restored = decide(answer.register, undone.commands[0])
      if (restored.decision !== "apply") throw new Error(restored.code)
      expect(gridRows(restored.register)).toEqual(rows)
      const redone = redoOf(restored.register, undoable)
      if (!redone.ok || redone.commands[0] === undefined) throw new Error("redo")
      const final = decide(restored.register, redone.commands[0])
      if (final.decision !== "apply") throw new Error(final.code)
      expect(gridRows(final.register)).toEqual(gridRows(answer.register))
    }),
    { numRuns: 300 },
  )
})
