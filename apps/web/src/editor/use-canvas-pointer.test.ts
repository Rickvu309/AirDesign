import { describe, expect, it } from "vitest"
import { dragButton, freesAspect } from "./use-canvas-pointer"

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
