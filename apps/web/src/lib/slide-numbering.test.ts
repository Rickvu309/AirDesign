import { expect, it } from "vitest"
import { skippedNumber, slideIndexOf, slideNumber, slideNumberLabel } from "./slide-numbering"

const skipped = [false, true, false]

it("gives every slide its place in the deck, and a dash in the filmstrip for a skipped one, without renumbering the rest", () => {
  expect(skipped.map((hidden, index) => slideNumberLabel(index, hidden))).toEqual(["1", skippedNumber, "3"])
  expect([0, 1, 2].map(slideNumber)).toEqual([1, 2, 3])
})

it("finds a slide by the number the filmstrip shows, and refuses a number outside the deck", () => {
  expect([1, 2, 3].map((number) => slideIndexOf(number, 3))).toEqual([0, 1, 2])
  expect([0, 4, 1.5, Number.NaN].map((number) => slideIndexOf(number, 3))).toEqual([null, null, null, null])
})
