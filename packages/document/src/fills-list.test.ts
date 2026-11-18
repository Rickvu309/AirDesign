import { describe, expect, it } from "vitest"
import { planChange, registerScope } from "./change.js"
import { openRegister, type Register } from "./decide.js"
import { elementId } from "./element-id.js"
import { listedPaints, listedSlots } from "./fills-list.js"
import { format } from "./format.js"
import { readRow } from "./stored.js"
import { changeFills, readFills } from "./trait-fills.js"

const node = elementId("256.4")
const box = { x: 10, y: 20, cx: 300, cy: 400 }
const none = { none: true } as const
const blue = { solid: { scheme: "accent1" } } as const
const shade = {
  gradient: {
    stops: [
      { pos: 0, color: { scheme: "accent2" } },
      { pos: 100_000, color: { scheme: "accent1" } },
    ],
    shade: { linear: { angle: 0, scaled: false } },
    rotateWithShape: true,
  },
} as const

function photo(): Register {
  const elements = [{ node, kind: "shape" as const, value: null, box, grouped: false }]
  return {
    ...openRegister("", "deck"),
    index: { format: 2, total: 1, slides: [{ id: "256", position: 0 }], elements, pages: [] },
  }
}

describe("a layer's fills as a list of paints", () => {
  it("stores a hidden paint in its slot, paints only the visible ones, and lists every one", () => {
    const row = { v: format, patch: { fills: { p1: { set: { hidden: shade } } } } }
    expect(readRow(row, "text")).toEqual({ ok: true, value: row })
    const shown = { p0: { image: true }, p1: { hidden: shade }, p2: blue, source: "rocket" } as const
    expect(readFills(shown).paints).toEqual([{ image: "rocket" }, blue])
    expect(listedPaints(shown)).toEqual([
      { slot: "p0", paint: { image: true }, hidden: false },
      { slot: "p1", paint: shade, hidden: true },
      { slot: "p2", paint: blue, hidden: false },
    ])
  })

  it("adds a paint on top, removes one by shifting those above it down, moves one, and hides one", () => {
    const shown = { p0: { image: true }, p1: blue } as const
    expect(listedSlots(shown, { add: shade })).toEqual([{ image: true }, blue, shade, none])
    expect(listedSlots(shown, { remove: 0 })).toEqual([blue, none, none, none])
    expect(listedSlots(shown, { move: 1, to: 0 })).toEqual([blue, { image: true }, none, none])
    expect(listedSlots(shown, { hide: 1, hidden: true })).toEqual([{ image: true }, { hidden: blue }, none, none])
    expect(listedSlots({ p0: blue, p1: blue, p2: blue, p3: blue }, { add: shade })).toBeNull()
  })

  it("writes only the slots a list edit changes, so one undo puts the list back", () => {
    const shown = { p0: { image: true }, p1: none, p2: none, p3: none } as const
    const slots = listedSlots(shown, { add: shade })
    if (slots === null) throw new Error("full")
    expect(changeFills({ slots }, shown)).toEqual({ p1: { set: shade } })
  })

  it("lays an agent's overlay on the top slot, above an image wherever it sits, and takes it away", () => {
    expect(changeFills({ overlay: shade })).toEqual({ p3: { set: shade } })
    expect(changeFills({ overlay: null })).toEqual({ p3: { set: none } })
    const planned = planChange({ target: { node }, fills: { overlay: blue } }, registerScope(photo()))
    expect(planned).toEqual({ ok: true, rows: [{ node, row: { v: format, patch: { fills: { p3: { set: blue } } } } }] })
    const both = planChange({ target: { node }, fills: { paint: blue, overlay: shade } }, registerScope(photo()))
    expect(both.ok && both.rows[0]?.row.patch.fills).toEqual({
      p0: { set: blue },
      p1: { set: none },
      p2: { set: none },
      p3: { set: shade },
    })
  })
})
