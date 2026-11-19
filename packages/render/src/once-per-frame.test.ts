import { describe, expect, it } from "vitest"
import { oncePerFrame, type Frames } from "./once-per-frame.js"

function fakeFrames() {
  const waiting = new Map<number, () => void>()
  let next = 0
  const frames: Frames = {
    request(run) {
      next += 1
      waiting.set(next, run)
      return next
    },
    cancel(handle) {
      waiting.delete(handle)
    },
  }
  return {
    frames,
    waiting: () => waiting.size,
    paint() {
      const due = [...waiting.values()]
      waiting.clear()
      for (const run of due) run()
    },
  }
}

describe("oncePerFrame", () => {
  it("applies only the latest of several values pushed inside one frame, once, at the frame", () => {
    const clock = fakeFrames()
    const applied: number[] = []
    const moves = oncePerFrame((value: number) => applied.push(value), clock.frames)
    moves.push(1)
    moves.push(2)
    moves.push(3)
    expect(applied).toEqual([])
    expect(clock.waiting()).toBe(1)
    clock.paint()
    expect(applied).toEqual([3])
    clock.paint()
    expect(applied).toEqual([3])
  })

  it("asks for one frame again after a frame lands", () => {
    const clock = fakeFrames()
    const applied: number[] = []
    const moves = oncePerFrame((value: number) => applied.push(value), clock.frames)
    moves.push(1)
    clock.paint()
    moves.push(2)
    moves.push(4)
    clock.paint()
    expect(applied).toEqual([1, 4])
  })

  it("applies a waiting value at once on flush and leaves no frame to land it twice", () => {
    const clock = fakeFrames()
    const applied: number[] = []
    const moves = oncePerFrame((value: number) => applied.push(value), clock.frames)
    moves.push(5)
    moves.flush()
    expect(applied).toEqual([5])
    expect(clock.waiting()).toBe(0)
    moves.flush()
    clock.paint()
    expect(applied).toEqual([5])
  })

  it("forgets a waiting value on drop", () => {
    const clock = fakeFrames()
    const applied: number[] = []
    const moves = oncePerFrame((value: number) => applied.push(value), clock.frames)
    moves.push(7)
    moves.drop()
    expect(clock.waiting()).toBe(0)
    clock.paint()
    moves.flush()
    expect(applied).toEqual([])
  })
})
