import { describe, expect, it } from "vitest"
import { convexPath, polygonPartition } from "./path-partitions.js"

function polygon(d: string) {
  const parsed = convexPath(d)
  if (parsed === null) throw new Error("Expected a convex polygon")
  return parsed
}

describe("path partitions", () => {
  it("joins a closed fan and its implicit fill closure", () => {
    const a = polygon("M0 0L5 0L5 5Z")
    const b = polygon("M0 0L5 5L0 5L0 0")
    expect(polygonPartition([a, b])).toBe(true)
    expect(polygonPartition([b, a])).toBe(true)
  })

  it("preserves overlap and leaves isolated or corner-touching pieces alone", () => {
    const a = polygon("M0 0L5 0L5 5Z")
    expect(polygonPartition([a, a])).toBe(false)
    expect(polygonPartition([a, polygon("M5 5L6 5L6 6Z")])).toBe(false)
    expect(polygonPartition([a, polygon("M9 9L10 9L10 10Z")])).toBe(false)
    expect(convexPath("M0 0L5 0L4 1L5 5L0 5Z")).toBeNull()
  })
})
