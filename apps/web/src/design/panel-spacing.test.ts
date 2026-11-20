import { elementId, readTextValue, writeTextValue, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { panelOf } from "./panel"

const shape: ScopedElement = {
  node: elementId("258.2"),
  facts: { kind: "shape", text: true, grouped: false, animated: false },
  kept: [],
  value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "A", size: 2000 }] }]),
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}

function control(field: string) {
  return panelOf(shape, { reads: {}, moves: true })
    .sections.flatMap((section) => section.strips.flat())
    .find((each) => each.trait === "text" && each.field === field)
}

it("gives line height an Auto, PowerPoint's single line, and reads typed points against the type size", () => {
  const typed = control("lineHeight")?.typed
  expect(typed?.auto).toBe(100)
  expect(typed?.points).toBeCloseTo(100 / 24, 6)
})

it("reads typed letter spacing points as a share of the type size", () => {
  expect(control("letterSpacing")?.typed?.points).toBeCloseTo(5, 6)
})

it("shows a fixed line height in points and sets one through the text, keeping each paragraph", () => {
  const fixed: ScopedElement = {
    ...shape,
    value: writeTextValue([
      { from: 0, lineHeightPoints: 2400, runs: [{ from: 0, text: "A", size: 2000 }] },
      { from: 1, lineHeightPoints: 2400, runs: [{ from: 0, text: "B" }] },
    ]),
  }
  const field = panelOf(fixed, { reads: {}, moves: true })
    .sections.flatMap((section) => section.strips.flat())
    .find((each) => each.trait === "text" && each.field === "lineHeight")
  expect(field?.value).toEqual({ points: 2400 })
  expect(field?.typed?.fixed).toBe(true)
  const change = field?.change({ points: 1800 })
  expect(change?.target).toEqual({ node: shape.node })
  expect(readTextValue(String(change?.text?.value))).toEqual([
    { from: 0, lineHeightPoints: 1800, runs: [{ from: 0, text: "A", size: 2000 }] },
    { from: 1, lineHeightPoints: 1800, runs: [{ from: 0, text: "B" }] },
  ])
  expect(field?.change(150_000).text).toEqual({ lineHeight: 150_000 })
})
