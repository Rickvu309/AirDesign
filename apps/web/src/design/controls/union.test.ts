import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { unionValue } from "@/design/controls/union"
import { panelOf } from "@/design/panel"

const picture: ScopedElement = {
  node: elementId("258.4"),
  facts: { kind: "shape", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}

const palette = { templateColors: [], deck: [] }

function paint() {
  const control = panelOf(picture, {
    reads: {},
    moves: true,
    fields: {
      "fills.p0": { value: { image: true }, own: true },
      "fills.source": { value: "rocket", own: true },
    },
  })
    .sections.flatMap((section) => section.strips.flat())
    .find((control) => control.trait === "fills" && control.field === "paint")
  if (control === undefined) throw new Error("fill")
  return control
}

it("a solid, a gradient or none replaces an image fill", () => {
  const control = paint()
  expect(unionValue(control, palette, "solid")).toEqual({ solid: { scheme: "accent1" } })
  expect(unionValue(control, palette, "none")).toEqual({ none: true })
  expect(unionValue(control, palette, "gradient")).toMatchObject({ gradient: { stops: expect.any(Array) } })
})
