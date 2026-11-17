import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { designCopy } from "@/copy/design-copy"
import { optionWord } from "@/copy/option-copy"
import { fillCopy } from "@/copy/fill-copy"
import { panelOf } from "@/design/panel"
import { ElementDesign } from "./design-panel"

function panel(kind: ScopedElement["facts"]["kind"], geometry?: unknown) {
  const model = panelOf(
    {
      node: elementId("258.2"),
      facts: { kind, text: kind === "shape", grouped: false, animated: false },
      kept: [],
      value: "Hello",
      box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
    },
    {
      reads: {},
      moves: true,
      fields: {
        "geometry.shape": { value: geometry ?? { preset: "rect" }, own: true },
        "fill.value": { value: { solid: { rgb: "112233" } }, own: true },
      },
    },
  )
  return renderToStaticMarkup(
    createElement(ElementDesign, { model, palette: { theme: [], deck: [] }, onChange: () => {} }),
  )
}

it("uses the element name as the single text title", () => {
  const html = panel("shape")
  expect(html).toContain(`data-design-head`)
  expect(html).toContain(`>${designCopy.titles.text}</span>`)
  expect(html).not.toContain(`data-design-section="${designCopy.titles.text}"`)
})

it("keeps Figma appearance sections open with no fold trigger", () => {
  const html = panel("shape", { preset: "ellipse" })
  const fill = html.slice(html.indexOf(`data-design-section="${fillCopy.section}"`))
  expect(fill.split("</section>")[0]).not.toContain('data-slot="collapsible-trigger"')
  expect(html).toContain(`>${optionWord("shape.preset", "ellipse")}</span>`)
  expect(html).toContain(fillCopy.reset)
})
