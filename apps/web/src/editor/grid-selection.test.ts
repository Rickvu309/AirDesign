import { describe, expect, it } from "vitest"
import { pickedSlides, pickRange, pickToggle, toggledCurrent } from "@/editor/grid-selection"

describe("grid selection", () => {
  it("is the current slide alone until a person picks more", () => {
    expect(pickedSlides(null, 2)).toEqual([2])
    expect(pickedSlides(null, 4)).toEqual([4])
  })

  it("adds and takes away one slide with Ctrl or Cmd, starting from the current slide", () => {
    const two = pickToggle(null, 1, 4)
    expect(pickedSlides(two, 4)).toEqual([1, 4])
    const three = pickToggle(two, 2, 4)
    expect(pickedSlides(three, 4)).toEqual([1, 2, 4])
    expect(pickedSlides(pickToggle(three, 2, 4), 4)).toEqual([1, 4])
    expect(pickToggle(null, 3, 3)).toBeNull()
  })

  it("keeps the other slide when the current slide is toggled out of a pair", () => {
    const two = pickToggle(null, 2, 0)
    expect(pickedSlides(pickToggle(two, 2, 2), 2)).toEqual([0])
  })

  it("picks every slide from the anchor to the slide with Shift, in either direction, and keeps the anchor", () => {
    const forward = pickRange(null, 5, 2)
    expect(pickedSlides(forward, 5)).toEqual([2, 3, 4, 5])
    const back = pickRange(forward, 0, 5)
    expect(pickedSlides(back, 0)).toEqual([0, 1, 2])
    expect(pickedSlides(pickRange(null, 3, 1), 3)).toEqual([1, 2, 3])
  })

  it("makes the clicked slide current, or the nearest selected slide before it when the click took it away", () => {
    const three = pickToggle(pickToggle(null, 2, 0), 4, 0)
    expect(toggledCurrent(three, 4)).toBe(4)
    expect(toggledCurrent(pickToggle(three, 4, 4), 4)).toBe(2)
    expect(toggledCurrent(pickToggle(three, 0, 4), 0)).toBe(2)
    expect(toggledCurrent(null, 3)).toBe(3)
  })
})
