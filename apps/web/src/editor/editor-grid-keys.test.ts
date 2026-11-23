import { describe, expect, it } from "vitest"
import { gridCommand, gridMove, type GridBox } from "@/editor/editor-grid-keys"

const row = (x: number, y: number): GridBox => ({ x, y, width: 100, height: 60 })

const grid: readonly GridBox[] = [row(0, 0), row(120, 0), row(240, 0), row(0, 80), row(120, 80), row(240, 80)]

const key = (
  name: string,
  modifiers: Partial<Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">> = {},
) => ({ key: name, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...modifiers })

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

  it("stays put when the slide group has nowhere above or below", () => {
    expect(gridMove("ArrowDown", [row(0, 0), row(120, 0)], 0)).toBe(0)
    expect(gridMove("ArrowUp", [row(0, 0), row(120, 0)], 1)).toBe(1)
  })

  it("deletes, duplicates, and reorders with alt and up or down", () => {
    expect(gridCommand(key("Enter", { shiftKey: true }))).toBeNull()
    expect(gridCommand(key("ArrowRight"))).toBeNull()
    expect(gridCommand(key("Delete"))).toBe("remove")
    expect(gridCommand(key("Backspace"))).toBe("remove")
    expect(gridCommand(key("d", { ctrlKey: true }))).toBe("clone")
    expect(gridCommand(key("d", { metaKey: true }))).toBe("clone")
    expect(gridCommand(key("ArrowUp", { altKey: true }))).toBe("earlier")
    expect(gridCommand(key("ArrowDown", { altKey: true }))).toBe("later")
    expect(gridCommand(key("ArrowRight", { altKey: true, shiftKey: true }))).toBeNull()
  })

  it("reorders with command or control and a bracket, read by where the key sits", () => {
    expect(gridCommand({ ...key("[", { metaKey: true }), code: "BracketLeft" })).toBe("earlier")
    expect(gridCommand({ ...key("]", { ctrlKey: true }), code: "BracketRight" })).toBe("later")
    expect(gridCommand({ ...key("ü", { ctrlKey: true }), code: "BracketLeft" })).toBe("earlier")
  })
})
