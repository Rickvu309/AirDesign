import { describe, expect, it } from "vitest"
import { exactPageCheck, pageChange } from "./render-pages.js"

describe("exactPageCheck", () => {
  it("requires the exact changed pages, not the same count", () => {
    const before = ["a", "b", "c", "d"]
    const after = ["a", "x", "c", "y"]
    expect(exactPageCheck({ before, after, targeted: [2, 4], visible: true })).toBe(true)
    expect(exactPageCheck({ before, after, targeted: [2, 3], visible: true })).toBe(false)
    expect(pageChange(before, after)?.changed).toEqual([2, 4])
  })

  it("fails a visible edit that changes no page", () => {
    expect(exactPageCheck({ before: ["a", "b"], after: ["a", "b"], targeted: [2], visible: true })).toBe(false)
  })

  it("accepts an invisible edit that changes no page", () => {
    expect(exactPageCheck({ before: ["a", "b"], after: ["a", "b"], targeted: [2], visible: false })).toBe(true)
  })

  it("fails an invisible edit that changes a page", () => {
    expect(exactPageCheck({ before: ["a", "b"], after: ["a", "x"], targeted: [2], visible: false })).toBe(false)
  })

  it("treats a removed page as the targeted change and no other page", () => {
    expect(exactPageCheck({ before: ["a", "b", "c"], after: ["a", "c"], targeted: [2], visible: true })).toBe(true)
    expect(exactPageCheck({ before: ["a", "b", "c"], after: ["a", "x"], targeted: [2], visible: true })).toBe(false)
    expect(pageChange(["a", "b", "c"], ["b", "c"])).toEqual({ changed: [], removed: [1] })
    expect(pageChange(["a", "b", "c"], ["a", "b"])).toEqual({ changed: [], removed: [3] })
  })

  it("fails when the page counts cannot be aligned", () => {
    expect(exactPageCheck({ before: ["a", "b", "c"], after: ["a"], targeted: [2, 3], visible: true })).toBe(false)
  })
})
