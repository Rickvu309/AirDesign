import { describe, expect, it } from "vitest"
import { pickedSlides } from "@/editor/grid-selection"
import { heldOf, livePick, pressedPick, setDropPlace, slidePress } from "@/editor/slide-list-pick"

const ids = ["a", "b", "c", "d", "e", "f"]

const click = { shiftKey: false, metaKey: false, ctrlKey: false }

describe("slide list selection", () => {
  it("reads Shift as a range and Ctrl or Cmd as one slide in or out", () => {
    expect(slidePress(click)).toBe("only")
    expect(slidePress({ ...click, shiftKey: true })).toBe("range")
    expect(slidePress({ ...click, metaKey: true })).toBe("toggle")
    expect(slidePress({ ...click, ctrlKey: true })).toBe("toggle")
  })

  it("selects every slide from the current one to a Shift click, and keeps that anchor for the next Shift click", () => {
    const range = pressedPick(null, ids, 4, 1, "range")
    expect(pickedSlides(range.pick, ids, range.current)).toEqual([1, 2, 3, 4])
    expect(range.current).toBe(4)
    const back = pressedPick(range.pick, ids, 0, range.current, "range")
    expect(pickedSlides(back.pick, ids, back.current)).toEqual([0, 1])
  })

  it("adds and removes one slide with Ctrl or Cmd, and a lone slide left is a plain selection", () => {
    const two = pressedPick(null, ids, 3, 0, "toggle")
    expect(pickedSlides(two.pick, ids, two.current)).toEqual([0, 3])
    const three = pressedPick(two.pick, ids, 1, two.current, "toggle")
    expect(pickedSlides(three.pick, ids, three.current)).toEqual([0, 1, 3])
    const back = pressedPick(three.pick, ids, 1, three.current, "toggle")
    expect(pickedSlides(back.pick, ids, back.current)).toEqual([0, 3])
    const one = pressedPick(back.pick, ids, 3, back.current, "toggle")
    expect(one).toEqual({ pick: null, current: 0 })
  })

  it("drops the selection on a plain click, and keeps it when the menu opens on a selected slide", () => {
    const two = pressedPick(null, ids, 2, 0, "range")
    expect(pressedPick(two.pick, ids, 1, two.current, "menu")).toEqual(two)
    expect(pressedPick(two.pick, ids, 4, two.current, "menu")).toEqual({ pick: null, current: 4 })
    expect(pressedPick(two.pick, ids, 1, two.current, "only")).toEqual({ pick: null, current: 1 })
  })

  it("holds a selection only while it holds the current slide, and keeps its slides wherever they move", () => {
    const { pick } = pressedPick(null, ids, 3, 1, "range")
    expect(heldOf([1, 2, 3], ids)).toEqual(pick)
    expect(livePick(pick, 3, ids)).toEqual(pick)
    expect(livePick(pick, 5, ids)).toBeNull()
    const shorter = ["a", "b", "c"]
    expect(pickedSlides(livePick(pick, 2, shorter), shorter, 2)).toEqual([1, 2])
    const moved = ["d", "a", "c", "b"]
    expect(pickedSlides(livePick(pick, 0, moved), moved, 0)).toEqual([0, 2, 3])
    expect(livePick(pick, 0, ["d", "a", "e"])).toBeNull()
  })

  it("drops a moved set before a slide above it and after a slide below it, and nowhere inside it", () => {
    expect(setDropPlace([2, 3], 0)).toBe(0)
    expect(setDropPlace([2, 3], 5)).toBe(6)
    expect(setDropPlace([2, 3], 3)).toBeNull()
    expect(setDropPlace([1, 4], 2)).toBe(2)
  })
})
