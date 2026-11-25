import { describe, expect, it } from "vitest"
import { polar } from "./polar.js"

describe("polar", () => {
  it("measures turns clockwise on the slide from the right", () => {
    const center = { x: 100, y: 50 }
    expect(polar([center, 10, 0])).toEqual({ x: 110, y: 50 })
    expect(polar([center, 10, 0.25])).toEqual({ x: 100, y: 60 })
    expect(polar([center, 10, -0.25])).toEqual({ x: 100, y: 40 })
    expect(polar([center, 10, 1.5])).toEqual({ x: 90, y: 50 })
  })

  it("refuses a centre without coordinates", () => {
    expect(() => polar([{ x: 1 }, 10, 0])).toThrow()
    expect(() => polar([{ x: 1, y: 1 }, Number.NaN, 0])).toThrow()
  })
})
