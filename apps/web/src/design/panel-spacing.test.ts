import { elementId, writeTextValue, type ScopedElement } from "@airdesign/document"
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
