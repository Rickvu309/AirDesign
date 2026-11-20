import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { turnedLayers } from "./transform-keys.js"

const one = elementId("3.2")
const two = elementId("3.3")

describe("turning layers with the keys", () => {
  it("turns one layer about its own centre by the step, keeping its box", () => {
    const box = { x: 100, y: 100, cx: 200, cy: 100 }
    expect(turnedLayers(new Map([[one, { box, rotation: 0 }]]), 1)).toEqual([{ id: one, rotation: 1 }])
    expect(turnedLayers(new Map([[one, { box, rotation: 0 }]]), -15)).toEqual([{ id: one, rotation: 345 }])
    expect(turnedLayers(new Map([[one, { box, rotation: 359.5 }]]), 1)).toEqual([{ id: one, rotation: 0.5 }])
  })

  it("orbits several layers about the middle of the selection and turns each by the step", () => {
    const left = { x: 0, y: 0, cx: 100, cy: 100 }
    const right = { x: 300, y: 0, cx: 100, cy: 100 }
    const turned = turnedLayers(
      new Map([
        [one, { box: left, rotation: 0 }],
        [two, { box: right, rotation: 0 }],
      ]),
      90,
    )
    expect(turned).toEqual([
      { id: one, rotation: 90, box: { ...left, x: 150, y: -150 } },
      { id: two, rotation: 90, box: { ...right, x: 150, y: 150 } },
    ])
  })
})
