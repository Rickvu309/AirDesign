import { describe, expect, it } from "vitest"
import { marks } from "./annotate.mjs"
import { circleRadius } from "./placement.mjs"

const distance = (box, point) =>
  Math.hypot(
    Math.max(box.x - point.x, 0, point.x - box.x - box.width),
    Math.max(box.y - point.y, 0, point.y - box.y - box.height),
  )

describe("marks", () => {
  it("keeps a numbered circle off the text a side drew around its target", () => {
    const target = { x: 120, y: 200, width: 160, height: 26 }
    const texts = [
      { x: 40, y: 150, width: 320, height: 16 },
      { x: 40, y: 172, width: 320, height: 16 },
      { x: 40, y: 238, width: 320, height: 16 },
      { x: 40, y: 260, width: 320, height: 16 },
    ]
    const block = {
      width: 400,
      height: 400,
      callouts: [{ at: ".a", note: "a" }],
      sides: [{ key: "after", boxes: [target], texts }],
    }
    const { circles, shape } = marks(block)
    for (const text of texts) {
      const box = {
        x: text.x * shape.scale,
        y: text.y * shape.scale,
        width: text.width * shape.scale,
        height: text.height * shape.scale,
      }
      expect(distance(box, circles[0])).toBeGreaterThan(circleRadius)
    }
  })
})
