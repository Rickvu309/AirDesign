import { describe, expect, it } from "vitest"
import { planChange, registerScope, type SetChange } from "./change.js"
import { openRegister, type Register } from "./decide.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { elementId, slideId } from "./element-id.js"
import { format } from "./format.js"
import type { Alpha } from "./value-kind.js"

const box = { x: 10, y: 20, cx: 300, cy: 400 }

function shape(node: string, value: string | null, kept?: IndexElement["kept"]): IndexElement {
  return { node: elementId(node), kind: "shape", value, box, grouped: false, ...(kept === undefined ? {} : { kept }) }
}

const elements: readonly IndexElement[] = [
  shape("258.2", "Title"),
  { node: elementId("258.4"), kind: "picture", value: null, box, grouped: false },
  shape("258.7", null, ["fills"]),
]

function indexed(more: readonly IndexElement[] = []): Register {
  const index: DeckIndex = {
    format: 2,
    total: elements.length + more.length,
    slides: [{ id: "258", position: 0 }],
    elements: [...elements, ...more],
    pages: [],
  }
  return { ...openRegister("", "deck"), index }
}

function alpha(value: number): Alpha {
  return value as Alpha
}

function plan(change: SetChange, register: Register = indexed()) {
  return planChange(change, registerScope(register))
}

describe("opacity fades every fills, line and text an element takes, at once", () => {
  const faded = { set: 60_000 }

  it("writes the alpha of each field the kind takes in one row", () => {
    expect(plan({ target: { node: elementId("258.2") }, opacity: alpha(60_000) })).toEqual({
      ok: true,
      rows: [
        {
          node: "258.2",
          row: { v: format, patch: { fills: { alpha: faded }, line: { alpha: faded }, text: { alpha: faded } } },
        },
      ],
    })
    expect(plan({ target: { node: elementId("258.4") }, opacity: alpha(60_000) })).toEqual({
      ok: true,
      rows: [{ node: "258.4", row: { v: format, patch: { line: { alpha: faded }, image: { alpha: faded } } } }],
    })
  })

  it("leaves out text an element does not hold, and joins the other fields the change names", () => {
    const solid = { solid: { scheme: "accent2" } } as const
    const textless = indexed([shape("258.5", null)])
    expect(
      plan({ target: { node: elementId("258.5") }, opacity: alpha(0), fills: { paint: solid } }, textless),
    ).toEqual({
      ok: true,
      rows: [
        {
          node: "258.5",
          row: {
            v: format,
            patch: {
              fills: {
                p0: { set: solid },
                p1: { set: { none: true } },
                p2: { set: { none: true } },
                p3: { set: { none: true } },
                alpha: { set: 0 },
              },
              line: { alpha: { set: 0 } },
            },
          },
        },
      ],
    })
  })

  it("refuses a group and a slide, which take no alpha, as kind, and a fill the index keeps as kept", () => {
    const grouped = indexed([{ node: elementId("258.6"), kind: "group", value: null, box, grouped: false }])
    expect(plan({ target: { node: elementId("258.6") }, opacity: alpha(50_000) }, grouped)).toEqual({
      ok: false,
      refusals: [{ node: "258.6", trait: null, code: "kind" }],
    })
    expect(plan({ target: { slide: slideId("258") }, opacity: alpha(50_000) })).toEqual({
      ok: false,
      refusals: [{ node: "258.slide", trait: null, code: "kind" }],
    })
    expect(plan({ target: { node: elementId("258.7") }, opacity: alpha(50_000) })).toEqual({
      ok: false,
      refusals: [{ node: "258.7", trait: "fills", code: "kept" }],
    })
  })
})
