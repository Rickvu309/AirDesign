import { describe, expect, it } from "vitest"
import {
  gridEditing,
  gridPick,
  gridRinged,
  gridStep,
  type GridInteraction,
  type GridStep,
} from "@/editor/grid-interaction"

const none: GridInteraction = { kind: "none" }
const current: GridInteraction = { kind: "slides", pick: null }
const several: GridInteraction = { kind: "slides", pick: { anchor: "b", slides: new Set(["b", "d"]) } }
const elements: GridInteraction = { kind: "elements", slide: "s" }
const text: GridInteraction = { kind: "text", slide: "s" }
const order = ["a", "b", "c", "d", "e"]

const states = { none, current, several, elements, text }

const steps: Record<string, GridStep> = {
  pickCurrent: { kind: "pick", pick: null },
  pickSeveral: { kind: "pick", pick: { anchor: "b", slides: new Set(["b", "d"]) } },
  enter: { kind: "enter", slide: "s" },
  type: { kind: "type", slide: "s" },
  escape: { kind: "escape" },
  clear: { kind: "clear" },
}

const table: Record<keyof typeof states, Record<keyof typeof steps, GridInteraction>> = {
  none: { pickCurrent: current, pickSeveral: several, enter: elements, type: text, escape: none, clear: none },
  current: { pickCurrent: current, pickSeveral: several, enter: elements, type: text, escape: none, clear: none },
  several: { pickCurrent: current, pickSeveral: several, enter: elements, type: text, escape: none, clear: none },
  elements: { pickCurrent: current, pickSeveral: several, enter: elements, type: text, escape: current, clear: none },
  text: { pickCurrent: current, pickSeveral: several, enter: elements, type: text, escape: elements, clear: none },
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
    expect(gridStep(elements, { kind: "enter", slide: "s" })).toBe(elements)
    expect(gridStep(text, { kind: "type", slide: "s" })).toBe(text)
    expect(gridStep(elements, { kind: "enter", slide: "other" })).toEqual({ kind: "elements", slide: "other" })
    expect(gridStep(text, { kind: "enter", slide: "s" })).toEqual(elements)
  })

  it("steps out one level per Escape: text, element, slide, nothing", () => {
    const out = (state: GridInteraction) => gridStep(state, { kind: "escape" })
    expect([out(text), out(out(text)), out(out(out(text)))]).toEqual([elements, current, none])
  })

  it("restores the state from before a gesture", () => {
    expect(gridStep(several, { kind: "restore", state: none })).toBe(none)
    expect(gridStep(none, { kind: "restore", state: several })).toBe(several)
    expect(gridStep(elements, { kind: "restore", state: text })).toBe(text)
  })

  it("mounts the live editor only inside a slide", () => {
    expect(Object.values(states).map(gridEditing)).toEqual([false, false, false, true, true])
  })

  it("rings slides only while slides are what is selected, and drops slides the deck no longer has", () => {
    expect(gridRinged(none, order, 2)).toEqual([])
    expect(gridRinged(current, order, 2)).toEqual([2])
    expect(gridRinged(several, order, 2)).toEqual([1, 3])
    expect(gridRinged(several, ["a", "b", "c"], 2)).toEqual([1])
    expect(gridRinged(several, ["b", "c", "d"], 2)).toEqual([0, 2])
    expect(gridRinged(elements, order, 2)).toEqual([])
    expect(gridRinged(text, order, 2)).toEqual([])
  })

  it("names a pick only while several slides were chosen with Shift, Ctrl or Cmd", () => {
    expect(gridPick(several)).toEqual(several.kind === "slides" ? several.pick : null)
    for (const state of [none, current, elements, text]) expect(gridPick(state)).toBeNull()
  })
})
