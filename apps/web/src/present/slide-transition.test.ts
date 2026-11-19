import { expect, it } from "vitest"
import { layerFrames, playedFrames, transitionFrames, type TransitionFrames } from "./slide-transition"

function firstIncoming(frames: TransitionFrames): Keyframe {
  const frame = frames.incoming?.[0]
  if (frame === undefined) throw new Error("incoming")
  return frame
}

it("fades the next slide in over the last one", () => {
  expect(transitionFrames({ kind: "fade", direction: null, duration: 700 })).toEqual({
    incoming: [{ opacity: 0 }, { opacity: 1 }],
    outgoing: null,
    duration: 700,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
  })
})

it("pushes the last slide out the way the file says", () => {
  expect(transitionFrames({ kind: "push", direction: "l", duration: 500 })).toMatchObject({
    incoming: [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }],
    outgoing: [{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }],
  })
  expect(transitionFrames({ kind: "push", direction: "u", duration: 500 })).toMatchObject({
    incoming: [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
    outgoing: [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
  })
  expect(firstIncoming(transitionFrames({ kind: "push", direction: "d", duration: 500 }))).toEqual({
    transform: "translateY(-100%)",
  })
  expect(firstIncoming(transitionFrames({ kind: "push", direction: "r", duration: 500 }))).toEqual({
    transform: "translateX(-100%)",
  })
})

it("covers the last slide from the side a person names, and pulls the last slide off that side", () => {
  expect(transitionFrames({ kind: "cover", direction: "l", duration: 400 })).toMatchObject({
    incoming: [{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }],
    outgoing: null,
    easing: "cubic-bezier(0.77, 0, 0.175, 1)",
  })
  expect(transitionFrames({ kind: "pull", direction: "l", duration: 400 })).toEqual({
    incoming: null,
    outgoing: [{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }],
    duration: 400,
    easing: "cubic-bezier(0.77, 0, 0.175, 1)",
    outgoingOnTop: true,
  })
  expect(transitionFrames({ kind: "cover", direction: "d", duration: 400 }).incoming?.[0]).toEqual({
    transform: "translateY(100%)",
  })
})

it("shows the finished slide when motion is reduced", () => {
  const transition = { kind: "push" as const, direction: "l", duration: 500 }
  expect(playedFrames(transition, true)).toBeNull()
  expect(playedFrames(transition, false)).toEqual(transitionFrames(transition))
})

it("wipes the next slide in from the side it moves away from", () => {
  expect(transitionFrames({ kind: "wipe", direction: "l", duration: 500 })).toMatchObject({
    incoming: [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0)" }],
    outgoing: null,
  })
  expect(firstIncoming(transitionFrames({ kind: "wipe", direction: "r", duration: 500 }))).toEqual({
    clipPath: "inset(0 100% 0 0)",
  })
  expect(firstIncoming(transitionFrames({ kind: "wipe", direction: "u", duration: 500 }))).toEqual({
    clipPath: "inset(100% 0 0 0)",
  })
  expect(firstIncoming(transitionFrames({ kind: "wipe", direction: "d", duration: 500 }))).toEqual({
    clipPath: "inset(0 0 100% 0)",
  })
})

it("dissolves the slides under Smart animate while matched layers move on their own", () => {
  expect(transitionFrames({ kind: "morph", direction: null, duration: 900 })).toEqual({
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
