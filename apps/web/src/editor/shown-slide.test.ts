import { expect, it } from "vitest"
import { shownSlideAfter } from "./shown-slide"

it("keeps the slide the person is on when an element edit lands late, and clamps it to the slides left", () => {
  expect(shownSlideAfter("kept", 1, 5)).toBe(1)
  expect(shownSlideAfter("kept", 6, 5)).toBe(4)
})

it("goes to the slide a slide command names, clamped to the slides there are", () => {
  expect(shownSlideAfter(3, 1, 5)).toBe(3)
  expect(shownSlideAfter(9, 1, 5)).toBe(4)
  expect(shownSlideAfter(-2, 1, 5)).toBe(0)
})
