import { describe, expect, it } from "vitest"
import { gridStep, type GridInteraction } from "@/editor/grid-interaction"
import { edgePan, marqueeBox, marqueeHits, marqueeStarted, marqueeStep } from "@/editor/grid-marquee"

const faces = [
  { index: 0, left: 0, top: 0, width: 100, height: 50 },
  { index: 1, left: 120, top: 0, width: 100, height: 50 },
  { index: 2, left: 240, top: 0, width: 100, height: 50 },
  { index: 3, left: 0, top: 80, width: 100, height: 50 },
  { index: 4, left: 120, top: 80, width: 100, height: 50 },
]

const several: GridInteraction = { kind: "slides", pick: { anchor: "d", slides: new Set(["d"]) } }
const order = ["a", "b", "c", "d", "e"]

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
    expect(gridStep(several, marqueeStep(several, { current: 0, order }, [1, 2], false))).toEqual({
      kind: "slides",
      pick: { anchor: "b", slides: new Set(["b", "c"]) },
    })
    expect(gridStep(several, marqueeStep(several, { current: 0, order }, [], false))).toEqual({ kind: "none" })
  })

  it("adds to the selection from before the gesture, keeping its anchor", () => {
    expect(gridStep(several, marqueeStep(several, { current: 0, order }, [0, 1], true))).toEqual({
      kind: "slides",
      pick: { anchor: "d", slides: new Set(["a", "b", "d"]) },
    })
    expect(gridStep(several, marqueeStep(several, { current: 0, order }, [], true))).toEqual(several)
  })

  it("adds to the current slide when nothing else was picked, to nothing when no slide was selected, and leaves a selection it only crosses as it was", () => {
    const current: GridInteraction = { kind: "slides", pick: null }
    expect(gridStep(current, marqueeStep(current, { current: 2, order }, [4], true))).toEqual({
      kind: "slides",
      pick: { anchor: "c", slides: new Set(["c", "e"]) },
    })
    const none: GridInteraction = { kind: "none" }
    expect(gridStep(none, marqueeStep(none, { current: 2, order }, [4], true))).toEqual({
      kind: "slides",
      pick: { anchor: "e", slides: new Set(["e"]) },
    })
    expect(gridStep(current, marqueeStep(current, { current: 2, order }, [2], true))).toBe(current)
  })

  it("pans faster the closer the pointer comes to an edge of the room, and not outside it", () => {
    const room = { left: 100, top: 50, width: 800, height: 600 }
    expect(edgePan({ x: 500, y: 350 }, room)).toEqual({ x: 0, y: 0 })
    expect(edgePan({ x: 101, y: 350 }, room)).toEqual({ x: 24, y: 0 })
    expect(edgePan({ x: 128, y: 350 }, room)).toEqual({ x: 12, y: 0 })
    expect(edgePan({ x: 500, y: 649 }, room)).toEqual({ x: 0, y: -24 })
    expect(edgePan({ x: 50, y: 350 }, room)).toEqual({ x: 0, y: 0 })
  })
})
