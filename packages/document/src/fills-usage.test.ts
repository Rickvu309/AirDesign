import { describe, expect, it } from "vitest"
import { planChange, registerScope } from "./change.js"
import { decide, landedPatch, openRegister, type Command, type Register } from "./decide.js"
import type { IndexElement } from "./deck-index.js"
import { elementId } from "./element-id.js"
import { format } from "./format.js"
import { redoOf, undoOf, type Undoable } from "./person-undo.js"
import { beforeOf } from "./row.js"
import type { ElementPatch } from "./row.js"
import { changeFills, readFills } from "./trait-fills.js"

const node = elementId("256.4")
const box = { x: 10, y: 20, cx: 300, cy: 400 }
const photo: IndexElement = { node, kind: "shape", value: null, box, grouped: false }
const solid = { solid: { scheme: "accent1" } } as const
const none = { set: { none: true } } as const
const gradient = {
  gradient: {
    stops: [
      { pos: 0, color: { scheme: "accent1" } },
      { pos: 100_000, color: { scheme: "accent2" } },
    ],
    shade: { linear: { angle: 0, scaled: false } },
    rotateWithShape: true,
  },
} as const

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function opened(): Register {
  const index = { format: 2, total: 1, slides: [{ id: "256", position: 0 }], elements: [photo], pages: [] }
  return landed({ ...openRegister("", "deck"), index }, { command: "add", node, floor: "", route: "" })
}

function fillsOf(register: Register): ElementPatch["fills"] {
  return landedPatch(register.elements[node]!, "text").fills
}

type Step = { readonly node: typeof node; readonly before: ElementPatch; readonly after: ElementPatch }

function step(
  register: Register,
  after: ElementPatch,
): { readonly register: Register; readonly undo: Undoable; readonly step: Step } {
  const before = beforeOf(landedPatch(register.elements[node]!, "text"), after)
  const next = landed(register, { command: "person", v: format, patch: after, node })
  return { register: next, undo: { steps: [{ node, before, after }] }, step: { node, before, after } }
}

function turned(register: Register, turn: ReturnType<typeof undoOf>): Register {
  if (!turn.ok) throw new Error("changed")
  return turn.commands.reduce(landed, register)
}

describe("design A's usage of fills, on a photo imported as a shape whose fills hold an image", () => {
  it("switches the photo to a colour in one change, and one undo returns every slot to the photo", () => {
    const planned = planChange({ target: { node }, fills: { paint: solid } }, registerScope(opened()))
    const patch = { fills: { p0: { set: solid }, p1: none, p2: none, p3: none } }
    expect(planned).toEqual({ ok: true, rows: [{ node, row: { v: format, patch } }] })
    const { register, undo, step: taken } = step(opened(), patch)
    expect(taken.before).toEqual({ fills: { p0: "opening", p1: "opening", p2: "opening", p3: "opening" } })
    const undone = turned(register, undoOf(register, undo))
    expect(fillsOf(undone)).toEqual({ p0: "opening", p1: "opening", p2: "opening", p3: "opening" })
    expect(fillsOf(turned(undone, redoOf(undone, undo)))).toEqual(patch.fills)
  })

  it("lays a gradient over the photo in the slot above it, and a crop the same moment folds apart from it", () => {
    const over = step(opened(), { fills: { p1: { set: gradient } } })
    const cropped = step(over.register, { fills: { crop: { set: { l: 10_000, t: 0, r: 0, b: 0 } } } })
    expect(fillsOf(cropped.register)).toEqual({ p1: { set: gradient }, crop: { set: { l: 10_000, t: 0, r: 0, b: 0 } } })
    const undone = turned(cropped.register, undoOf(cropped.register, over.undo))
    expect(fillsOf(undone)).toEqual({ p1: "opening", crop: { set: { l: 10_000, t: 0, r: 0, b: 0 } } })
    expect(readFills({ p0: { image: true }, p1: gradient, source: "rocket" }).paints).toEqual([
      { image: "rocket" },
      gradient,
    ])
  })

  it("keeps an agent's one-field colour one field on the photo, and reads null as the way back to the inherited fill", () => {
    const scope = registerScope(opened())
    expect(planChange({ target: { node }, fills: { paint: { solid: { scheme: "accent2" } } } }, scope)).toMatchObject({
      ok: true,
      rows: [{ row: { patch: { fills: { p0: { set: { solid: { scheme: "accent2" } } } } } } }],
    })
    expect(changeFills({ paint: null })).toEqual({ p0: "inherit", p1: none, p2: none, p3: none })
    expect(planChange({ target: { node }, fills: { paint: null } }, scope)).toEqual({
      ok: true,
      rows: [{ node, row: { v: format, patch: { fills: { p0: "inherit", p1: none, p2: none, p3: none } } } }],
    })
  })

  it("puts an icon in the fills as an image slot and its source, which a recolour beside it leaves alone", () => {
    expect(changeFills({ paint: { image: "rocket" } })).toEqual({
      p0: { set: { image: true } },
      p1: none,
      p2: none,
      p3: none,
      source: { set: "rocket" },
    })
    const icon = step(opened(), { fills: changeFills({ paint: { image: "rocket" } }) })
    const recoloured = step(icon.register, { fills: { recolor: { set: { grayscale: true } } } })
    const undone = turned(recoloured.register, undoOf(recoloured.register, icon.undo))
    expect(fillsOf(undone)).toMatchObject({ source: "opening", recolor: { set: { grayscale: true } } })
  })
})
