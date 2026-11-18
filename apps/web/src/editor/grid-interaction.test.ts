import { describe, expect, it } from "vitest"
import {
  gridEditing,
  gridOpened,
  gridPick,
  gridDesigned,
  gridRinged,
  gridStep,
  type GridInteraction,
  type GridStep,
} from "@/editor/grid-interaction"

const none: GridInteraction = { kind: "none" }
const current: GridInteraction = { kind: "slides", pick: null }
const several: GridInteraction = { kind: "slides", pick: { anchor: 1, slides: new Set([1, 3]) } }
const elements: GridInteraction = { kind: "elements" }
const text: GridInteraction = { kind: "text" }

const states = { none, current, several, elements, text }

const steps: Record<string, GridStep> = {
  pickCurrent: { kind: "pick", pick: null },
  pickSeveral: { kind: "pick", pick: { anchor: 1, slides: new Set([1, 3]) } },
  enter: { kind: "enter" },
  type: { kind: "type" },
  escape: { kind: "escape" },
  clear: { kind: "clear" },
}

const table: Record<keyof typeof states, Record<keyof typeof steps, GridInteraction>> = {
  none: {
    pickCurrent: current,
    pickSeveral: several,
    enter: elements,
    type: text,
    escape: none,
    clear: none,
  },
  current: {
    pickCurrent: current,
    pickSeveral: several,
    enter: elements,
    type: text,
    escape: none,
    clear: none,
  },
  several: {
    pickCurrent: current,
    pickSeveral: several,
    enter: elements,
    type: text,
    escape: none,
    clear: none,
  },
  elements: {
    pickCurrent: current,
    pickSeveral: several,
    enter: elements,
    type: text,
    escape: current,
    clear: none,
  },
  text: {
    pickCurrent: current,
    pickSeveral: several,
    enter: elements,
    type: text,
    escape: elements,
    clear: none,
  },
}

describe("grid interaction", () => {
  for (const [from, row] of Object.entries(table)) {
    for (const [step, to] of Object.entries(row)) {
      it(`${step} from ${from} lands on ${to.kind}`, () => {
        const state = states[from as keyof typeof states]
        expect(gridStep(state, steps[step as keyof typeof steps]!)).toEqual(to)
      })
    }
  }

  it("keeps the same state object when a step changes nothing, so React skips the render", () => {
    expect(gridStep(none, { kind: "escape" })).toBe(none)
    expect(gridStep(none, { kind: "clear" })).toBe(none)
    expect(gridStep(elements, { kind: "enter" })).toBe(elements)
    expect(gridStep(text, { kind: "type" })).toBe(text)
  })

  it("steps out one level per Escape: text, element, slide, nothing", () => {
    const out = (state: GridInteraction) => gridStep(state, { kind: "escape" })
    expect([out(text), out(out(text)), out(out(out(text)))]).toEqual([elements, current, none])
  })

  it("mounts the live editor only inside a slide", () => {
    expect(Object.values(states).map(gridEditing)).toEqual([false, false, false, true, true])
  })

  it("rings slides only while slides are what is selected", () => {
    expect(gridRinged(none, 2, 5)).toEqual([])
    expect(gridRinged(current, 2, 5)).toEqual([2])
    expect(gridRinged(several, 2, 5)).toEqual([1, 3])
    expect(gridRinged(several, 2, 3)).toEqual([1])
    expect(gridRinged(elements, 2, 5)).toEqual([])
    expect(gridRinged(text, 2, 5)).toEqual([])
  })

  it("names a pick only while several slides were chosen with Shift, Ctrl or Cmd", () => {
    expect(gridPick(several)).toEqual(several.kind === "slides" ? several.pick : null)
    for (const state of [none, current, elements, text]) expect(gridPick(state)).toBeNull()
  })

  it("opens inside the slide when the document already has selected elements", () => {
    expect(gridOpened(true)).toEqual(elements)
    expect(gridOpened(false)).toEqual(current)
  })
})

describe("slides the Design panel shows", () => {
  it("counts the ringed slides, none after the canvas is cleared, and the open slide while its elements are edited", () => {
    expect(gridDesigned(several, 2, 5)).toBe(2)
    expect(gridDesigned(current, 2, 5)).toBe(1)
    expect(gridDesigned(none, 2, 5)).toBe(0)
    expect(gridDesigned(elements, 2, 5)).toBe(1)
    expect(gridDesigned(text, 2, 5)).toBe(1)
  })

  it("leaves out ringed slides in a collapsed section", () => {
    expect(gridDesigned(several, 2, 5, undefined, (index) => index !== 1)).toBe(1)
    expect(gridDesigned(several, 2, 5, undefined, () => false)).toBe(0)
  })
})
