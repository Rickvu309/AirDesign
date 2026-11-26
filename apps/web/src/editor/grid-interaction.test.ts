import { describe, expect, it } from "vitest"
import { gridPick, gridRinged, gridStep, type GridInteraction, type GridStep } from "@/editor/grid-interaction"

const none: GridInteraction = { kind: "none" }
const current: GridInteraction = { kind: "slides", pick: null }
const several: GridInteraction = { kind: "slides", pick: { anchor: 1, slides: new Set([1, 3]) } }

const states = { none, current, several }

const steps: Record<string, GridStep> = {
  pickCurrent: { kind: "pick", pick: null },
  pickSeveral: { kind: "pick", pick: { anchor: 1, slides: new Set([1, 3]) } },
  escape: { kind: "escape" },
  clear: { kind: "clear" },
}

const table: Record<keyof typeof states, Record<keyof typeof steps, GridInteraction>> = {
  none: { pickCurrent: current, pickSeveral: several, escape: none, clear: none },
  current: { pickCurrent: current, pickSeveral: several, escape: none, clear: none },
  several: { pickCurrent: current, pickSeveral: several, escape: none, clear: none },
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
  })

  it("restores the state from before a gesture", () => {
    expect(gridStep(several, { kind: "restore", state: none })).toBe(none)
    expect(gridStep(none, { kind: "restore", state: several })).toBe(several)
  })

  it("rings slides only while slides are what is selected, and drops slides the deck no longer has", () => {
    expect(gridRinged(none, 2, 5)).toEqual([])
    expect(gridRinged(current, 2, 5)).toEqual([2])
    expect(gridRinged(several, 2, 5)).toEqual([1, 3])
    expect(gridRinged(several, 2, 3)).toEqual([1])
  })

  it("names a pick only while several slides were chosen with Shift, Ctrl or Cmd", () => {
    expect(gridPick(several)).toEqual(several.kind === "slides" ? several.pick : null)
    for (const state of [none, current]) expect(gridPick(state)).toBeNull()
  })
})
