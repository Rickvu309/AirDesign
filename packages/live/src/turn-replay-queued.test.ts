import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { at, card, frame, offline, online, parentOf, placed, slide, type Key } from "./testing/offline-tabs.js"

const frameBox = { x: 100, y: 100, w: 600, h: 400, rotation: 0, flipH: false, flipV: false }
const intoFrame: readonly doom.Write[] = [{ node: frame, prop: "box", value: frameBox }]
const drag: readonly doom.Write[] = [
  { node: card, prop: "parent", value: at(frame) },
  { node: card, prop: "box", value: { ...placed(50), y: 20 } },
]
const theirNudge: doom.Write = { node: card, prop: "box", value: { ...placed(300), y: 300 } }
const boxOf = (view: doom.Doom) => (view.nodes.get(card) as { box: { x: number; y: number } }).box
const spot = (view: doom.Doom) => [parentOf(view, card), boxOf(view).x, boxOf(view).y]

describe("a drag into a frame undone offline while the other tab nudges the layer", () => {
  it("leaves the layer where the other tab sees it, and keeps their nudge through the redo and the undo after it", async () => {
    const mine = await offline([intoFrame, drag], ["undo"], [theirNudge])
    expect(mine.notices()).toEqual([])
    expect(spot(mine.server())).toEqual([slide, 400, 400])
    expect(mine.redo().ok).toBe(true)
    await mine.sync()
    expect(spot(mine.server())).toEqual([frame, 300, 300])
    expect(mine.undo().ok).toBe(true)
    await mine.sync()
    expect(spot(mine.server())).toEqual([slide, 400, 400])
  })

  it("puts the layer back in its frame where the other tab nudged it when the redo was queued behind the undo", async () => {
    const mine = await offline([intoFrame, drag], ["undo", "redo"], [theirNudge])
    expect(mine.notices()).toEqual([])
    expect(spot(mine.server())).toEqual([frame, 300, 300])
    expect(spot(mine.view())).toEqual([frame, 300, 300])
  })

  it("leaves the layer on the slide where the other tab sees it when undo, redo and undo were queued", async () => {
    const mine = await offline([intoFrame, drag], ["undo", "redo", "undo"], [theirNudge])
    expect(mine.notices()).toEqual([])
    expect(spot(mine.server())).toEqual([slide, 400, 400])
    expect(spot(mine.view())).toEqual([slide, 400, 400])
  })

  it.each(["undo", "undo,redo", "undo,redo,undo", "undo,undo", "undo,undo,redo"])(
    "ends where the same presses made online end: %s",
    async (named) => {
      const presses = named.split(",") as Key[]
      const mine = await offline([intoFrame, drag], presses, [theirNudge])
      const there = await online([intoFrame, drag], presses, [theirNudge])
      expect(mine.notices()).toEqual([])
      expect(spot(mine.server())).toEqual(spot(there.server()))
      expect(spot(mine.view())).toEqual(spot(mine.server()))
    },
  )
})
