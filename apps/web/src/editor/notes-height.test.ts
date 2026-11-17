import { expect, it } from "vitest"
import {
  clampNotesHeight,
  notesOpacity,
  releaseNotesHeight,
  trackNotesHeight,
  notesVelocity,
  rawNotesHeight,
  maxNotesHeight,
} from "./notes-height"

it("leaves a third of the canvas fit room above the overlay and its insets", () => {
  expect(maxNotesHeight(900, 72)).toBe(414)
  expect(maxNotesHeight(200, 72)).toBe(160)
})
it("clamps the open bar to its bounds", () => {
  expect(clampNotesHeight(80, 448)).toBe(160)
  expect(clampNotesHeight(500, 448)).toBe(448)
})
it.each([
  [24, 0, 24],
  [91, 0, 24],
  [92, 0, 160],
  [150, -0.12, 24],
  [40, 0.12, 160],
  [91, 0.11, 24],
  [93, -0.11, 160],
  [160, -1, 160],
  [280, 1, 280],
  [500, -1, 448],
])("releases %s at velocity %s to %s", (height, velocity, target) => {
  expect(releaseNotesHeight(height, velocity, 448)).toBe(target)
})
it("tracks the whole range with resistance only above maximum", () => {
  expect([0, 24, 40, 150, 160, 448, 548].map((h) => trackNotesHeight(h, 448))).toEqual([24, 24, 40, 150, 160, 448, 468])
})
it("derives opacity solely from height", () => {
  expect([0, 24, 92, 160, 400].map(notesOpacity)).toEqual([0, 0, 0.5, 1, 1])
})
it("uses signed pointer velocity over the latest 100 milliseconds", () => {
  expect(notesVelocity([])).toBe(0)
  expect(notesVelocity([{ y: 400, at: 0 }])).toBe(0)
  expect(
    notesVelocity([
      { y: 400, at: 0 },
      { y: 300, at: 100 },
      { y: 310, at: 200 },
    ]),
  ).toBe(-0.1)
  expect(
    notesVelocity([
      { y: 400, at: 0 },
      { y: 380, at: 100 },
    ]),
  ).toBe(0.2)
  expect(
    notesVelocity([
      { y: 400, at: 0 },
      { y: 380, at: 0 },
    ]),
  ).toBe(0)
})

it("caps the bar at half the room remaining above the toolbar", () => {
  expect(maxNotesHeight(1200, 72)).toBe(564)
  expect(maxNotesHeight(600, 72)).toBe(248)
})

it("preserves the rendered height when catching rubber-band overshoot", () => {
  expect(trackNotesHeight(rawNotesHeight(468, 448), 448)).toBe(468)
  expect(trackNotesHeight(rawNotesHeight(468, 448) + 10, 448)).toBe(470)
  expect(rawNotesHeight(92, 448)).toBe(92)
})
