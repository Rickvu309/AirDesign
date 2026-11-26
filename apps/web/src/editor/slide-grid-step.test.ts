import { expect, it } from "vitest"
import { gridStep } from "./slide-grid-step"

const row = (top: number, lefts: readonly number[]) => lefts.map((left) => ({ left, top }))
const places = [...row(0, [0, 100, 200]), ...row(80, [0, 100, 200]), ...row(160, [0])]

it("steps one slide left and right, across line ends, and stops at the deck's ends", () => {
  expect(gridStep("ArrowRight", places, 1)).toBe(2)
  expect(gridStep("ArrowRight", places, 2)).toBe(3)
  expect(gridStep("ArrowLeft", places, 3)).toBe(2)
  expect(gridStep("ArrowLeft", places, 0)).toBe(0)
  expect(gridStep("ArrowRight", places, 6)).toBe(6)
})

it("steps to the slide above or below in the same column", () => {
  expect(gridStep("ArrowDown", places, 1)).toBe(4)
  expect(gridStep("ArrowUp", places, 4)).toBe(1)
  expect(gridStep("ArrowUp", places, 1)).toBe(1)
})

it("lands on the last slide of a shorter line below", () => {
  expect(gridStep("ArrowDown", places, 5)).toBe(6)
  expect(gridStep("ArrowDown", places, 6)).toBe(6)
  expect(gridStep("ArrowUp", places, 6)).toBe(3)
})

it("goes to the first and last slide with Home and End", () => {
  expect(gridStep("Home", places, 4)).toBe(0)
  expect(gridStep("End", places, 4)).toBe(6)
})
