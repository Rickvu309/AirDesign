import { describe, expect, it } from "vitest"
import { pickAll, pickedSlides, pickRange, pickToggle, prunedPick, toggledCurrent } from "@/editor/grid-selection"

const order = ["a", "b", "c", "d", "e", "f"]

describe("grid selection", () => {
  it("is the current slide alone until a person picks more", () => {
    expect(pickedSlides(null, order, 2)).toEqual([2])
    expect(pickedSlides(null, order, 4)).toEqual([4])
  })

  it("adds and takes away one slide with Ctrl or Cmd, starting from the current slide", () => {
    const two = pickToggle(null, order, 1, 4)
    expect(pickedSlides(two, order, 4)).toEqual([1, 4])
    const three = pickToggle(two, order, 2, 4)
    expect(pickedSlides(three, order, 4)).toEqual([1, 2, 4])
    expect(pickedSlides(pickToggle(three, order, 2, 4), order, 4)).toEqual([1, 4])
    expect(pickToggle(null, order, 3, 3)).toBeNull()
  })

  it("keeps the other slide when the current slide is toggled out of a pair", () => {
    const two = pickToggle(null, order, 2, 0)
    expect(pickedSlides(pickToggle(two, order, 2, 2), order, 2)).toEqual([0])
  })

  it("picks every slide from the anchor to the slide with Shift, in either direction, and keeps the anchor", () => {
    const forward = pickRange(null, order, 5, 2)
    expect(pickedSlides(forward, order, 5)).toEqual([2, 3, 4, 5])
    const back = pickRange(forward, order, 0, 5)
    expect(pickedSlides(back, order, 0)).toEqual([0, 1, 2])
    expect(pickedSlides(pickRange(null, order, 3, 1), order, 3)).toEqual([1, 2, 3])
  })

  it("selects every slide with the current slide as the anchor", () => {
    expect(pickAll(order.slice(0, 4), 1)).toEqual({ anchor: "b", slides: new Set(["a", "b", "c", "d"]) })
    expect(pickAll([], 0)).toBeNull()
  })

  it("drops slides the deck no longer has and keeps the remaining selection", () => {
    expect(pickedSlides(prunedPick(pickAll(order, 0), ["a", "b", "c"]), ["a", "b", "c"], 0)).toEqual([0, 1, 2])
    expect(pickedSlides(prunedPick(pickRange(null, order, 4, 0), ["a"]), ["a"], 0)).toEqual([0])
    expect(prunedPick(pickRange(null, order, 4, 3), ["a", "b"])).toBeNull()
  })

  it("keeps the picked slides and the anchor on the same slides when an earlier slide is deleted", () => {
    const picked = pickToggle(null, order, 4, 2)
    const after = ["a", "c", "d", "e", "f"]
    expect(pickedSlides(picked, after, 3)).toEqual([1, 3])
    expect(pickedSlides(pickRange(picked, after, 0, 3), after, 0)).toEqual([0, 1, 2, 3])
  })

  it("starts the next range from a slide a toggle just took away", () => {
    const picked = prunedPick(pickToggle(pickToggle(pickToggle(null, order, 2, 0), order, 4, 0), order, 2, 0), order)
    expect(pickedSlides(picked, order, 0)).toEqual([0, 4])
    expect(pickedSlides(pickRange(picked, order, 5, 0), order, 0)).toEqual([2, 3, 4, 5])
  })

  it("makes the clicked slide current, or the nearest selected slide before it when the click took it away", () => {
    const three = pickToggle(pickToggle(null, order, 2, 0), order, 4, 0)
    expect(toggledCurrent(three, order, 4)).toBe(4)
    expect(toggledCurrent(pickToggle(three, order, 4, 4), order, 4)).toBe(2)
    expect(toggledCurrent(pickToggle(three, order, 0, 4), order, 0)).toBe(2)
    expect(toggledCurrent(null, order, 3)).toBe(3)
  })
})
