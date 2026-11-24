import { expect, it } from "vitest"
import { layerFrames, playedFrames, transitionFrames } from "./slide-transition"

it("fades the next slide in over the last one", () => {
  expect(transitionFrames({ kind: "fade", ms: 700 })).toEqual({
    incoming: [{ opacity: 0 }, { opacity: 1 }],
    outgoing: null,
    duration: 700,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
  })
})

it("pushes the last slide out to the left", () => {
  expect(transitionFrames({ kind: "push", ms: 500 })).toMatchObject({
    incoming: [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }],
    outgoing: [{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }],
  })
})

it("shows the finished slide when motion is reduced", () => {
  const transition = { kind: "push" as const, ms: 500 }
  expect(playedFrames(transition, true)).toBeNull()
  expect(playedFrames(transition, false)).toEqual(transitionFrames(transition))
})

it("dissolves the slides under Smart animate while matched layers move on their own", () => {
  expect(transitionFrames({ kind: "smartMove", ms: 900 })).toEqual({
    incoming: [{ opacity: 0 }, { opacity: 1 }],
    outgoing: null,
    duration: 900,
    easing: "cubic-bezier(0.77, 0, 0.175, 1)",
    morph: true,
  })
})

it("moves, resizes and turns a matched layer from where it sat on the last slide", () => {
  const before = { x: 10, y: 20, width: 100, height: 50, turn: "rotate(90deg)" }
  const after = { x: 200, y: 100, width: 50, height: 100, turn: "" }
  expect(layerFrames(before, after)).toEqual([
    { transform: "translate(-165px, -105px) rotate(90deg) scale(2, 0.5)" },
    { transform: "translate(0px, 0px) scale(1, 1)" },
  ])
})
