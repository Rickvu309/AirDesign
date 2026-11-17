import { expect, it } from "vitest"
import { PNG } from "pngjs"
import { blank } from "./images.mjs"
import { composeBlock, fullNames } from "./before-after.mjs"

it("names each block's full screenshots apart when blocks share a state", () => {
  expect(fullNames([{ state: "design-autofit" }, { state: "agent-empty" }, { state: "design-autofit" }])).toEqual([
    "design-autofit",
    "agent-empty",
    "design-autofit-2",
  ])
})

it("keeps both layouts in a shared crop when the new sidebar shrinks", () => {
  const sides = [{ key: "before" }, { key: "after" }]
  const shots = [248, 240].map((width) => ({
    full: PNG.sync.write(blank(500, 400)),
    viewport: { width: 500, height: 400 },
    frame: { x: 0, y: 0, width, height: 400 },
    boxes: [{ x: width - 8, y: 20, width: 8, height: 28 }],
  }))
  const { block } = composeBlock({ state: "decks-list", title: "Sidebar", crop: "aside", callouts: [] }, sides, shots)
  expect(block.width).toBe(248)
  expect(block.sides.map((side) => side.png.width)).toEqual([248, 248])
  expect(block.sides[0].boxes[0]).toEqual({ x: 240, y: 20, width: 8, height: 28 })
})

it("warns when a real target is cropped out instead of calling it absent", () => {
  const { warnings } = composeBlock(
    { state: "decks-list", title: "Sidebar", crop: "aside", callouts: [{ at: "button", note: "Border removed" }] },
    [{ key: "after" }],
    [
      {
        full: PNG.sync.write(blank(500, 400)),
        viewport: { width: 500, height: 400 },
        frame: { x: 0, y: 0, width: 240, height: 400 },
        boxes: [{ x: 300, y: 20, width: 100, height: 28 }],
      },
    ],
  )
  expect(warnings).toContain('decks-list: callout 1 "button" is outside the crop on after; widen the crop')
})

it("preserves moved frames and reports a partly clipped target", () => {
  const shots = [20, 60].map((x) => ({
    full: PNG.sync.write(blank(500, 400)),
    viewport: { width: 500, height: 400 },
    frame: { x, y: 20, width: 100, height: 80 },
    boxes: [{ x: 10, y: 30, width: 30, height: 20 }],
  }))
  const { block, warnings } = composeBlock(
    { state: "decks-list", title: "Moved control", crop: "header", callouts: [{ at: "button", note: "Moved" }] },
    [{ key: "before" }, { key: "after" }],
    shots,
  )
  expect(block.width).toBe(140)
  expect(block.height).toBe(80)
  expect(block.sides[0].boxes[0]).toEqual({ x: 0, y: 10, width: 20, height: 20 })
  expect(warnings).toHaveLength(2)
  expect(warnings[0]).toContain("clipped by the crop on before")
})
