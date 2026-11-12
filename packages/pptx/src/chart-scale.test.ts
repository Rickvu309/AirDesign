import { expect, it } from "vitest"
import { chartScale, chartSteps } from "./chart-scale.js"

const free = { min: null, max: null, unit: null }

it("starts at zero and picks a round step for positive values", () => {
  expect(chartScale(8.1, 35, free)).toEqual({ min: 0, max: 35, unit: 5 })
  expect(chartScale(0, 96, free)).toEqual({ min: 0, max: 100, unit: 10 })
  expect(chartScale(0, 1, free)).toEqual({ min: 0, max: 1, unit: 0.1 })
})

it("leaves zero out when the values sit close together, and reaches below zero", () => {
  expect(chartScale(95, 100, free)).toEqual({ min: 95, max: 100, unit: 0.5 })
  expect(chartScale(-5, 10, free)).toEqual({ min: -6, max: 10, unit: 2 })
  expect(chartScale(0, 0, free)).toEqual({ min: 0, max: 1, unit: 0.1 })
})

it("keeps the bounds and step the file fixes", () => {
  expect(chartScale(0, 35, { min: 10, max: 50, unit: null })).toEqual({ min: 10, max: 50, unit: 5 })
  expect(chartScale(0, 35, { min: null, max: null, unit: 7 })).toEqual({ min: 0, max: 35, unit: 7 })
})

it("lists every step without float drift", () => {
  expect(chartSteps({ min: 0, max: 1, unit: 0.1 })).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1])
  expect(chartSteps({ min: -6, max: 10, unit: 2 })).toHaveLength(9)
})
