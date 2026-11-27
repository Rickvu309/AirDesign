import { describe, expect, it } from "vitest"
import { doomFromTree } from "./doom-tree.js"
import { placeBox, placeSlide } from "./place-slide.js"
import { measure, plainTheme, row, spot } from "./testing/doom-fixtures-art.js"

const turned = (x: number, y: number, w: number, h: number, rotation: number) => ({ ...spot(x, y, w, h), rotation })

const near = (points: readonly { x: number; y: number }[]) =>
  points.map(({ x, y }) => ({ x: Math.round(x * 1e6) / 1e6, y: Math.round(y * 1e6) / 1e6 }))

describe("placeSlide", () => {
  it("places a child of a turned frame by the frame's turn and offset", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "frame",
              name: "holder",
              props: { box: turned(100, 100, 200, 100, 90) },
              children: [{ type: "shape", name: "kid", props: { box: spot(0, 0, 20, 10) } }],
            },
          ],
        },
      ],
    })
    const placed = placeSlide(grown.doom, grown.slides[0]!, measure)
    const kid = placed.get(grown.ids.kid!)!
    expect(kid.parent).toBe(grown.ids.holder)
    expect(kid.rotation).toBe(90)
    expect(near(kid.corners)).toEqual([
      { x: 250, y: 50 },
      { x: 250, y: 70 },
      { x: 240, y: 70 },
      { x: 240, y: 50 },
    ])
    expect(kid.bounds).toMatchObject({ left: 240, right: 250 })
  })

  it("places children where their frame's layout solved them, not where they were stored", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "frame",
              name: "line-up",
              props: { box: spot(10, 20, 300, 50), layout: row({}, 10) },
              children: [
                { type: "shape", name: "one", props: { box: spot(500, 500, 40, 30) } },
                { type: "shape", name: "two", props: { box: spot(500, 500, 40, 30) } },
              ],
            },
          ],
        },
      ],
    })
    const placed = placeSlide(grown.doom, grown.slides[0]!, measure)
    expect(placed.get(grown.ids.two!)!.corners[0]).toEqual({ x: 60, y: 20 })
  })

  it("places a box with no parent on the slide's own space", () => {
    const placed = placeBox("n:1" as never, turned(0, 0, 10, 10, 180), null)
    expect(placed.parent).toBeNull()
    expect(near([placed.corners[0]])).toEqual([{ x: 10, y: 10 }])
    expect(placed.content).toEqual(placed.matrix)
  })
})
