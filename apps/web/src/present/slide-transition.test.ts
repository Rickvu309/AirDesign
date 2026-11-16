import { expect, it } from "vitest"
import { transitionFrames } from "./slide-transition"

it("fades the next slide in over the last one", () => {
  expect(transitionFrames({ kind: "fade", direction: null, duration: 700 })).toEqual({
    incoming: [{ opacity: 0 }, { opacity: 1 }],
    outgoing: null,
    duration: 700,
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
  expect(transitionFrames({ kind: "push", direction: "d", duration: 500 }).incoming[0]).toEqual({
    transform: "translateY(-100%)",
  })
  expect(transitionFrames({ kind: "push", direction: "r", duration: 500 }).incoming[0]).toEqual({
    transform: "translateX(-100%)",
  })
})

it("wipes the next slide in from the side it moves away from", () => {
  expect(transitionFrames({ kind: "wipe", direction: "l", duration: 500 })).toMatchObject({
    incoming: [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0)" }],
    outgoing: null,
  })
  expect(transitionFrames({ kind: "wipe", direction: "r", duration: 500 }).incoming[0]).toEqual({
    clipPath: "inset(0 100% 0 0)",
  })
  expect(transitionFrames({ kind: "wipe", direction: "u", duration: 500 }).incoming[0]).toEqual({
    clipPath: "inset(100% 0 0 0)",
  })
  expect(transitionFrames({ kind: "wipe", direction: "d", duration: 500 }).incoming[0]).toEqual({
    clipPath: "inset(0 0 100% 0)",
  })
})
