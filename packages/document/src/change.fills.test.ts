import { expect, it } from "vitest"
import { planChange, registerScope, type SetChange } from "./change.js"
import { openRegister, type Register } from "./decide.js"
import type { IndexElement } from "./deck-index.js"
import { elementId } from "./element-id.js"

const box = { x: 10, y: 20, cx: 300, cy: 400 }
const kept: IndexElement = {
  node: elementId("258.7"),
  kind: "shape",
  value: null,
  box,
  grouped: false,
  kept: ["fills"],
}
const solid = { solid: { scheme: "accent2" } } as const

function indexed(): Register {
  const slides = [{ id: "258", position: 0 }]
  return { ...openRegister("", "deck"), index: { format: 2, total: 1, slides, elements: [kept], pages: [] } }
}

it("lets one paint replace fills the editor keeps, and keeps a slot above it out of reach", () => {
  const scope = registerScope(indexed())
  expect(planChange({ target: { node: kept.node }, fills: { paint: solid } }, scope).ok).toBe(true)
  const restored = {
    target: { node: kept.node },
    fills: { paint: { image: true } },
  } as unknown as SetChange
  expect(planChange(restored, scope)).toMatchObject({
    ok: true,
    rows: [
      {
        row: {
          patch: {
            fills: {
              p0: { set: { image: true } },
              p1: { set: { none: true } },
              p2: { set: { none: true } },
              p3: { set: { none: true } },
            },
          },
        },
      },
    ],
  })
  expect(planChange({ target: { node: kept.node }, fills: { p1: solid } }, scope)).toEqual({
    ok: false,
    refusals: [{ node: "258.7", trait: "fills", code: "kept" }],
  })
})
