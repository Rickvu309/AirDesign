import { expect, it } from "vitest"
import { readDesign } from "./design.js"
import { fillsElement, fillsRow } from "./fills-conversion.js"
import { changeFills, readFills } from "./trait-fills.js"

const accent = { solid: { scheme: "accent1" } } as const
const navy = { solid: { rgb: "1F4E79" } } as const

it("reads the slots bottom first, leaves out empty ones, and shows the top paint in slides mode", () => {
  expect(readFills({})).toEqual({ paints: [], slidesMode: { none: true } })
  expect(readFills({ p0: { none: true } })).toEqual({ paints: [], slidesMode: { none: true } })
  expect(readFills({ p0: accent, p1: { none: true }, p2: navy })).toEqual({ paints: [accent, navy], slidesMode: navy })
})

it("turns one paint into the bottom slot and clears the slots above, and null into an inherited fill", () => {
  const cleared = { p1: { set: { none: true } }, p2: { set: { none: true } }, p3: { set: { none: true } } }
  expect(changeFills({ paint: accent })).toEqual({ p0: { set: accent }, ...cleared })
  expect(changeFills({ paint: null })).toEqual({ p0: "inherit", ...cleared })
})

it("refuses a stored row that names both the old trait and fills, and keeps a row without a fill as it was", () => {
  const both = { v: 40, patch: { fill: { value: "inherit" }, fills: { p0: "inherit" } } }
  expect(fillsRow(both)).toBeNull()
  expect(fillsRow({ v: 40, patch: { fill: { colour: "inherit" } } })).toBeNull()
  const plain = { v: 40, patch: { text: { value: { set: "Hi" } } } }
  expect(fillsRow(plain)).toBe(plain)
})

it("keeps a design summary inside its byte budget once its fill key gets longer, as the reader would have cut it", () => {
  const shown = (bytes: number) => ["x".repeat(bytes)]
  const design = { fill: shown(150), "text.font": shown(150), "text.size": [32], "text.color": shown(35) }
  expect(JSON.stringify(design).length).toBe(400)
  const converted = fillsElement({ node: "256.2", design }) as { readonly design: object }
  expect(Object.keys(converted.design)).toEqual(["fills", "text.size", "text.color"])
  expect(readDesign(converted.design)).not.toBeNull()
})
