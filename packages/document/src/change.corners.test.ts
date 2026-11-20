import { describe, expect, it } from "vitest"
import { planChange, registerScope, type SetChange } from "./change.js"
import { openRegister, type Register } from "./decide.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { elementId } from "./element-id.js"

const box = { x: 0, y: 0, cx: 3_000_000, cy: 2_000_000 }

function shape(node: string, design?: IndexElement["design"], kept?: IndexElement["kept"]): IndexElement {
  return {
    node: elementId(node),
    kind: "shape",
    value: null,
    box,
    grouped: false,
    ...(design === undefined ? {} : { design }),
    ...(kept === undefined ? {} : { kept }),
  }
}

const elements: readonly IndexElement[] = [
  shape("258.2"),
  shape("258.3", { geometry: ["roundRect"], "geometry.corners": [16] }),
  shape("258.4", { geometry: ["roundRect"] }),
  shape("258.5", { geometry: ["ellipse"] }),
  shape("258.6", { geometry: ["custom"] }, ["geometry"]),
]

function register(): Register {
  const index: DeckIndex = {
    format: 2,
    total: elements.length,
    slides: [{ id: "258", position: 0 }],
    elements,
    pages: [],
  }
  return { ...openRegister("", "deck"), index }
}

function patchOf(change: SetChange) {
  const planned = planChange(change, registerScope(register()))
  return planned.ok ? planned.rows[0]?.row.patch : planned.refusals
}

const at = (node: string) => ({ node: elementId(node) })

describe("corners, a radius that becomes PowerPoint's rounded rectangle", () => {
  it("rounds a rectangle by the radius over its short side", () => {
    expect(patchOf({ target: at("258.2"), geometry: { corners: 200_000 } })).toEqual({
      geometry: { shape: { set: { preset: "roundRect", adjust: { adj: 10_000 } } } },
    })
  })

  it("squares a rounded rectangle at zero and caps the radius at half the short side, as the Corners field does", () => {
    expect(patchOf({ target: at("258.3"), geometry: { corners: 0 } })).toEqual({
      geometry: { shape: { set: { preset: "rect", adjust: {} } } },
    })
    expect(patchOf({ target: at("258.3"), geometry: { corners: 9_000_000 } })).toEqual({
      geometry: { shape: { set: { preset: "roundRect", adjust: { adj: 50_000 } } } },
    })
  })

  it("measures the radius against the box the same change sets", () => {
    expect(patchOf({ target: at("258.2"), box: { w: 1_000_000 }, geometry: { corners: 200_000 } })).toEqual({
      box: { x: { set: 0 }, y: { set: 0 }, w: { set: 1_000_000 }, h: { set: 2_000_000 } },
      geometry: { shape: { set: { preset: "roundRect", adjust: { adj: 20_000 } } } },
    })
  })

  it("refuses corners on a shape that is not a rectangle", () => {
    for (const node of ["258.5", "258.6"])
      expect(patchOf({ target: at(node), geometry: { corners: 200_000 } })).toEqual([
        { node, trait: "geometry", code: "kind" },
      ])
  })
})

describe("an agent's resize keeps a rounded rectangle's radius", () => {
  it("rewrites the adjust in the same row when the short side changes", () => {
    expect(patchOf({ target: at("258.3"), box: { h: 4_000_000 } })).toEqual({
      box: { x: { set: 0 }, y: { set: 0 }, w: { set: 3_000_000 }, h: { set: 4_000_000 } },
      geometry: { shape: { set: { preset: "roundRect", adjust: { adj: 6_773 } } } },
    })
  })

  it("leaves the geometry alone when the short side stays or the radius is unknown", () => {
    expect(patchOf({ target: at("258.3"), box: { w: 5_000_000 } })).toEqual({
      box: { x: { set: 0 }, y: { set: 0 }, w: { set: 5_000_000 }, h: { set: 2_000_000 } },
    })
    expect(patchOf({ target: at("258.4"), box: { h: 4_000_000 } })).toEqual({
      box: { x: { set: 0 }, y: { set: 0 }, w: { set: 3_000_000 }, h: { set: 4_000_000 } },
    })
  })
})
