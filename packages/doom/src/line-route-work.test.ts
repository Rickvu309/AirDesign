import { describe, expect, it, vi } from "vitest"

const work = vi.hoisted(() => ({ probes: 0 }))

vi.mock("./preset-geometry.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./preset-geometry.js")>()
  return {
    ...original,
    distanceToSegment: (...args: Parameters<typeof original.distanceToSegment>) => {
      work.probes += 1
      return original.distanceToSegment(...args)
    },
  }
})

const { endOnShape } = await import("./line-ends.js")
const { elbowPoints } = await import("./line-route.js")

const diamond = { kind: "preset", name: "diamond" } as const
const triangle = { kind: "preset", name: "triangle" } as const
const placed = (w: number, h: number) => ({ x: 0, y: 0, w, h, rotation: 0, flipH: false, flipV: false })

function probesToRoute(dx: number, dy: number, from: "t" | "r" | "b" | "l", to: "t" | "r" | "b" | "l"): number {
  const start = endOnShape(diamond, placed(100, 60), 0, 0, from)
  const end = endOnShape(triangle, placed(60, 40), dx, dy, to)
  work.probes = 0
  elbowPoints(start, end)
  return work.probes
}

describe("the work a route costs", () => {
  it("measures an outline edge for a point inside only when a stretch may cross, so a search with no route stays cheap", () => {
    const worst = Math.max(
      probesToRoute(-26, 23, "t", "r"),
      probesToRoute(-26, 26, "t", "r"),
      probesToRoute(-26, 26, "r", "r"),
    )
    expect(worst).toBeLessThan(500)
  })
})
