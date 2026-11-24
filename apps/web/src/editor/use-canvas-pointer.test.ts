import { describe, expect, it } from "vitest"
import { dragButton, freesAspect, overSource } from "./use-canvas-pointer"

const event = (ctrlKey: boolean, fn: boolean) => ({
  ctrlKey,
  getModifierState: (name: string) => name === "Fn" && fn,
})

describe("the pointer button and the aspect modifier", () => {
  it("treats a Control context click as a drag, and a plain right click as not one", () => {
    expect(dragButton({ button: 0, ctrlKey: false })).toBe(true)
    expect(dragButton({ button: 1, ctrlKey: false })).toBe(true)
    expect(dragButton({ button: 2, ctrlKey: true })).toBe(true)
    expect(dragButton({ button: 2, ctrlKey: false })).toBe(false)
  })

  it("frees the aspect from Control or Fn, the modifiers Figma names", () => {
    expect(freesAspect(event(true, false), false)).toBe(true)
    expect(freesAspect(event(false, true), false)).toBe(true)
    expect(freesAspect(event(false, false), true)).toBe(true)
    expect(freesAspect(event(false, false), false)).toBe(false)
  })
})

describe("the source line on the slide", () => {
  const ink = { x: 160, y: 1030, w: 300, h: 28 }

  it("is hit on its words, with the same reach as a layer", () => {
    expect(overSource({ x: 200, y: 1040 }, ink, 4.5)).toBe(true)
    expect(overSource({ x: 160, y: 1030 }, ink, 4.5)).toBe(true)
    expect(overSource({ x: 464, y: 1062 }, ink, 4.5)).toBe(true)
  })

  it("is missed in the band beyond its words, above it, and when there is none", () => {
    expect(overSource({ x: 470, y: 1040 }, ink, 4.5)).toBe(false)
    expect(overSource({ x: 200, y: 1020 }, ink, 4.5)).toBe(false)
    expect(overSource({ x: 200, y: 1040 }, null, 4.5)).toBe(false)
  })
})
