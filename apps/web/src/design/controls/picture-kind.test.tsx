import { elementId, type ScopedElement } from "@airdesign/document"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { fillCopy, fillWords } from "@/copy/fill-copy"
import { unionValue } from "@/design/controls/union"
import { panelOf } from "@/design/panel"
import { PictureFillKinds } from "./picture-kind"

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

it("draws every fill segment in normal ink, and a solid, a gradient or none replaces the image", () => {
  const control = paint()
  const html = renderToStaticMarkup(createElement(PictureFillKinds, { control, palette, onChange: () => {} }))
  expect(html).toContain(`aria-label="${fillCopy.value}"`)
  expect(html.match(/<button/g)).toHaveLength(4)
  expect(html).not.toContain("disabled=")
  for (const word of [fillWords.none, fillWords.solid, fillWords.gradient, fillWords.image])
    expect(html).toContain(`title="${word}"`)
  expect(html).toContain('aria-pressed="true"')
  expect(unionValue(control, palette, "solid")).toEqual({ solid: { scheme: "accent1" } })
  expect(unionValue(control, palette, "none")).toEqual({ none: true })
  expect(unionValue(control, palette, "gradient")).toMatchObject({ gradient: { stops: expect.any(Array) } })
})
