import { describe, expect, it } from "vitest"
import { gridMove } from "@/editor/editor-grid-keys"

const row = (left: number, top: number) => ({ left, top, width: 100, height: 60 })

const grid = [row(0, 0), row(120, 0), row(240, 0), row(0, 80), row(120, 80), row(240, 80)]

describe("grid keys", () => {
  it("moves across a slide group with left and right, and to the slide above or below with up and down", () => {
    expect(gridMove("ArrowRight", grid, 0)).toBe(1)
    expect(gridMove("ArrowRight", grid, 2)).toBe(3)
    expect(gridMove("ArrowRight", grid, 5)).toBe(5)
    expect(gridMove("ArrowLeft", grid, 4)).toBe(3)
    expect(gridMove("ArrowLeft", grid, 0)).toBe(0)
    expect(gridMove("ArrowDown", grid, 0)).toBe(3)
    expect(gridMove("ArrowDown", grid, 1)).toBe(4)
    expect(gridMove("ArrowDown", grid, 5)).toBe(5)
    expect(gridMove("ArrowUp", grid, 4)).toBe(1)
    expect(gridMove("ArrowUp", grid, 2)).toBe(2)
    expect(gridMove("Home", grid, 4)).toBe(0)
    expect(gridMove("End", grid, 1)).toBe(5)
  })

  it("moves down onto the next line of the same group", () => {
    const boxes = [0, 1, 2].flatMap((line) => [0, 1, 2, 3, 4].map((column) => row(column * 120, line * 80)))
    expect(gridMove("ArrowDown", boxes, 0)).toBe(5)
    expect(gridMove("ArrowDown", boxes, 4)).toBe(9)
    expect(gridMove("ArrowDown", boxes, 5)).toBe(10)
    expect(gridMove("ArrowUp", boxes, 10)).toBe(5)
    expect(gridMove("ArrowDown", boxes, 12)).toBe(12)
  })

  it("moves from the end of a long line to the nearest slide of a shorter line below", () => {
    const boxes = [row(0, 0), row(120, 0), row(240, 0), row(360, 0), row(0, 80)]
    expect(gridMove("ArrowDown", boxes, 3)).toBe(4)
    expect(gridMove("ArrowUp", boxes, 4)).toBe(0)
  })

  it("stays put when the slide group has nowhere above or below, and moves on no other key", () => {
    expect(gridMove("ArrowDown", [row(0, 0), row(120, 0)], 0)).toBe(0)
    expect(gridMove("ArrowUp", [row(0, 0), row(120, 0)], 1)).toBe(1)
    expect(gridMove("Enter", grid, 2)).toBeNull()
  })
})
