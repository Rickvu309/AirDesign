import fc from "fast-check"
import { expect, it } from "vitest"
import { currentBox, currentValue, openRegister, shownPatch, type NodeRegister } from "./decide.js"
import { rootElement } from "./element-id.js"

const box = fc.record({
  x: fc.integer({ min: -5, max: 5 }),
  y: fc.integer({ min: -5, max: 5 }),
  cx: fc.integer({ min: 0, max: 5 }),
  cy: fc.integer({ min: 0, max: 5 }),
})

const landedRow = fc.record({
  actor: fc.constantFrom("person" as const, "agent" as const),
  visible: fc.boolean(),
  edit: fc.oneof(
    fc.string({ maxLength: 3 }).map((value) => ({ value })),
    box.map((value) => ({ property: "box" as const, value })),
  ),
})

it("shows per field what the screen shows: the last visible value and box, else the floor", () => {
  fc.assert(
    fc.property(
      fc.string({ maxLength: 3 }),
      fc.option(box, { nil: undefined }),
      fc.array(landedRow, { maxLength: 8 }),
      fc.constantFrom("text" as const, "notes" as const),
      (floor, floorBox, rows, holder) => {
        const opened = openRegister(floor, "").elements[rootElement]
        if (opened === undefined) throw new Error("node")
        const body: NodeRegister = {
          ...opened,
          ...(floorBox === undefined ? {} : { floorBox }),
          landed: rows.map(({ actor, visible, edit }) => ({ actor, visible, ...edit })),
        }
        const shown = shownPatch(body, holder)
        expect(shown[holder]?.value).toEqual({ set: currentValue(body) })
        const shownBox = currentBox(body)
        expect(shown.box).toEqual(
          shownBox === null
            ? undefined
            : { x: { set: shownBox.x }, y: { set: shownBox.y }, w: { set: shownBox.cx }, h: { set: shownBox.cy } },
        )
      },
    ),
  )
})
