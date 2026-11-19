import { describe, expect, it } from "vitest"
import { gridStep, type GridInteraction } from "@/editor/grid-interaction"
import { marqueeBox, marqueeHits, marqueeStarted, marqueeStep } from "@/editor/grid-marquee"

const faces = [
  { index: 0, left: 0, top: 0, width: 100, height: 50 },
  { index: 1, left: 120, top: 0, width: 100, height: 50 },
  { index: 2, left: 240, top: 0, width: 100, height: 50 },
  { index: 3, left: 0, top: 80, width: 100, height: 50 },
  { index: 4, left: 120, top: 80, width: 100, height: 50 },
]

const several: GridInteraction = { kind: "slides", pick: { anchor: 3, slides: new Set([3]) } }

describe("grid marquee", () => {
  it("draws the same box whichever corner the drag starts from", () => {
    const box = { left: 10, top: 20, right: 110, bottom: 70 }
    expect(marqueeBox({ x: 10, y: 20 }, { x: 110, y: 70 })).toEqual(box)
    expect(marqueeBox({ x: 110, y: 70 }, { x: 10, y: 20 })).toEqual(box)
    expect(marqueeBox({ x: 110, y: 20 }, { x: 10, y: 70 })).toEqual(box)
  })

  it("starts only once the pointer passes the slide drag threshold", () => {
    expect(marqueeStarted({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(false)
    expect(marqueeStarted({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false)
    expect(marqueeStarted({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true)
  })

  it("hits every slide face the box crosses, across groups, in slide order", () => {
    expect(marqueeHits({ left: 210, top: 40, right: 250, bottom: 90 }, faces)).toEqual([1, 2, 4])
    expect(marqueeHits({ left: 101, top: 51, right: 119, bottom: 79 }, faces)).toEqual([])
    expect(marqueeHits({ left: 50, top: 60, right: 60, bottom: 60 }, faces)).toEqual([])
    expect(marqueeHits({ left: -50, top: 25, right: 400, bottom: 25 }, faces)).toEqual([0, 1, 2])
  })

  it("replaces the selection with the slides it crosses, and clears it when it crosses none", () => {
    expect(gridStep(several, marqueeStep(several, { current: 0, count: 5 }, [1, 2], false))).toEqual({
      kind: "slides",
      pick: { anchor: 1, slides: new Set([1, 2]) },
    })
    expect(gridStep(several, marqueeStep(several, { current: 0, count: 5 }, [], false))).toEqual({ kind: "none" })
  })

  it("adds to the selection from before the gesture, keeping its anchor", () => {
    expect(gridStep(several, marqueeStep(several, { current: 0, count: 5 }, [0, 1], true))).toEqual({
      kind: "slides",
      pick: { anchor: 3, slides: new Set([0, 1, 3]) },
    })
    expect(gridStep(several, marqueeStep(several, { current: 0, count: 5 }, [], true))).toEqual(several)
  })

  it("adds to the current slide when nothing else was picked, to nothing when no slide was selected, and leaves a selection it only crosses as it was", () => {
    const current: GridInteraction = { kind: "slides", pick: null }
    expect(gridStep(current, marqueeStep(current, { current: 2, count: 5 }, [4], true))).toEqual({
      kind: "slides",
      pick: { anchor: 2, slides: new Set([2, 4]) },
    })
    const none: GridInteraction = { kind: "none" }
    expect(gridStep(none, marqueeStep(none, { current: 2, count: 5 }, [4], true))).toEqual({
      kind: "slides",
      pick: { anchor: 4, slides: new Set([4]) },
    })
    expect(gridStep(current, marqueeStep(current, { current: 2, count: 5 }, [2], true))).toBe(current)
    const elements: GridInteraction = { kind: "elements" }
    expect(gridStep(elements, marqueeStep(elements, { current: 2, count: 5 }, [], true))).toBe(elements)
  })

  it("restores the state from before the gesture", () => {
    const text: GridInteraction = { kind: "text" }
    expect(gridStep(several, { kind: "restore", state: text })).toBe(text)
    expect(gridStep(text, { kind: "restore", state: several })).toBe(several)
  })
})
