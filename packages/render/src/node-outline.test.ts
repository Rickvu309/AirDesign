import { describe, expect, it } from "vitest"
import { routePath } from "./node-outline.js"

const from = { x: 0, y: 0 }
const to = { x: 200, y: 100 }
const route = (kind: "straight" | "elbow" | "curve", leaves: "across" | "down", arrives: "across" | "down") =>
  routePath({ from, to, route: kind, leaves, arrives })

describe("routePath", () => {
  it("draws a straight line between the two ends", () => {
    expect(route("straight", "across", "across")).toBe("M0 0L200 100")
  })

  it("bends an elbow through the middle when it leaves and arrives the same way", () => {
    expect(route("elbow", "across", "across")).toBe("M0 0L100 0L100 100L200 100")
    expect(route("elbow", "down", "down")).toBe("M0 0L0 50L200 50L200 100")
  })

  it("bends an elbow once when it leaves one way and arrives the other", () => {
    expect(route("elbow", "across", "down")).toBe("M0 0L200 0L200 100")
    expect(route("elbow", "down", "across")).toBe("M0 0L0 100L200 100")
  })

  it("curves with the same turns: an S between like sides, a single bend between unlike ones", () => {
    expect(route("curve", "across", "across")).toBe("M0 0C100 0 100 100 200 100")
    expect(route("curve", "down", "down")).toBe("M0 0C0 50 200 50 200 100")
    expect(route("curve", "across", "down")).toBe("M0 0Q200 0 200 100")
    expect(route("curve", "down", "across")).toBe("M0 0Q0 100 200 100")
  })
})
