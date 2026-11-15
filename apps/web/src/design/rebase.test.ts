import { traits, type Desc } from "@airdesign/document"
import { expect, it } from "vitest"
import { rebased } from "./rebase"

const rect = traits.crop.fields.rect.desc
const number: Desc = { kind: "number", unit: "emu", min: 0, max: 100 }
const shadow: Desc = {
  kind: "union",
  cases: { none: { kind: "mark" }, outer: { kind: "record", fields: { blur: number, distance: number } } },
  plain: null,
}
const stops: Desc = { kind: "list", item: { kind: "named", item: number, max: 4 }, min: 2, max: 4 }

it("writes only the parts a person changed onto the newest value", () => {
  const plain = { l: 0, t: 0, r: 0, b: 0 }
  expect(rebased(rect, plain, { ...plain, r: 10_000 }, { ...plain, l: 10_000 })).toEqual({
    ...plain,
    l: 10_000,
    r: 10_000,
  })
  expect(rebased(rect, undefined, { r: 10_000 }, { ...plain, l: 10_000 })).toEqual({ ...plain, l: 10_000, r: 10_000 })
  expect(rebased(rect, plain, plain, { ...plain, t: 5_000 })).toEqual({ ...plain, t: 5_000 })
  expect(rebased(number, 1, 2, 3)).toBe(2)
})

it("merges inside a case all three share, and sends a newly chosen case whole", () => {
  const was = { outer: { blur: 1, distance: 1 } }
  expect(rebased(shadow, was, { outer: { blur: 2, distance: 1 } }, { outer: { blur: 1, distance: 5 } })).toEqual({
    outer: { blur: 2, distance: 5 },
  })
  expect(rebased(shadow, was, { none: true }, { outer: { blur: 1, distance: 5 } })).toEqual({ none: true })
  expect(rebased(shadow, was, { outer: { blur: 2, distance: 1 } }, { none: true })).toEqual({
    outer: { blur: 2, distance: 1 },
  })
})

it("merges a list item by item while its length holds, and sends it whole once the length moved", () => {
  const was = [{ a: 1 }, { a: 1 }]
  expect(rebased(stops, was, [{ a: 2 }, { a: 1 }], [{ a: 1 }, { a: 3 }])).toEqual([{ a: 2 }, { a: 3 }])
  expect(rebased(stops, was, [{ a: 2 }, { a: 1 }], [{ a: 1 }])).toEqual([{ a: 2 }, { a: 1 }])
})
