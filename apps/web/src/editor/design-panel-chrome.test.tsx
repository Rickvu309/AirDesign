import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { designCopy } from "@/copy/design-copy"
import { optionWord } from "@/copy/option-copy"
import { linkCopy } from "@/copy/link-copy"
import { pictureCopy } from "@/copy/picture-copy"
import { fillCopy, fillWords } from "@/copy/fill-copy"
import { panelOf } from "@/design/panel"
import { setFold } from "@/design/panel-folds"
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
        "fills.p0": { value: { solid: { rgb: "112233" } }, own: true },
      },
    },
  )
  return renderToStaticMarkup(
    createElement(ElementDesign, { model, palette: { templateColors: [], deck: [] }, onChange: () => {} }),
  )
}

it("titles a square Image while its fills show an image, and Square once they show a colour", () => {
  const shape = {
    node: elementId("258.4"),
    facts: { kind: "shape" as const, text: false, grouped: false, animated: false },
    kept: [],
    value: null,
    box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
  }
  const titled = (fields: Record<string, { readonly value: unknown; readonly own: true }>) => {
    const html = renderToStaticMarkup(
      createElement(ElementDesign, {
        model: panelOf(shape, { reads: {}, moves: true, fields }),
        palette: { templateColors: [], deck: [] },
        onChange: () => {},
      }),
    )
    const at = html.indexOf("data-design-head")
    return html.slice(at, html.indexOf("</div>", at))
  }
  const geometry = { "geometry.shape": { value: { preset: "rect" }, own: true as const } }
  expect(
    titled({
      ...geometry,
      "fills.p0": { value: { image: true }, own: true },
      "fills.source": { value: "rocket", own: true },
    }),
  ).toContain(designCopy.titles.picture)
  const solid = titled({ ...geometry, "fills.p0": { value: { solid: { scheme: "accent1" } }, own: true } })
  expect(solid).toContain(designCopy.square)
  expect(solid).not.toContain(designCopy.titles.picture)
})

it("draws an image's Fill segments as the shape panel does, with the image segment pressed", () => {
  const node = {
    node: elementId("258.4"),
    facts: { kind: "shape" as const, text: false, grouped: false, animated: false },
    kept: [],
    value: null,
    box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
  }
  const segments = (fill: unknown) => {
    const html = renderToStaticMarkup(
      createElement(ElementDesign, {
        model: panelOf(node, {
          reads: {},
          moves: true,
          fields: {
            "geometry.shape": { value: { preset: "rect" }, own: true },
            "fills.p0": { value: fill, own: true },
            "fills.source": { value: "rocket", own: true },
          },
        }),
        palette: { templateColors: [], deck: [] },
        onChange: () => {},
      }),
    )
    const at = html.indexOf(`title="${fillWords.gradient}"`)
    const group = html.slice(html.lastIndexOf("<div", html.lastIndexOf("<div", at) - 1), html.indexOf("</div>", at))
    return { html, group }
  }
  const { html, group: picture } = segments({ image: true })
  expect(html).not.toContain(pictureCopy.current("rocket"))
  const { group: shape } = segments({ solid: { scheme: "accent1" } })
  expect(picture).not.toContain("data-picture-kind")
  expect(picture).not.toContain("bg-line")
  expect(picture).not.toContain("disabled=")
  expect(picture.match(/<button/g)).toHaveLength(4)
  expect(picture.match(/class="[^"]*"/)?.[0]).toBe(shape.match(/class="[^"]*"/)?.[0])
  expect(picture.match(/aria-pressed="true"/g)).toHaveLength(1)
  expect(picture).toMatch(new RegExp(`aria-pressed="true"[^>]*title="${fillWords.image}"`))
})

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
  expect(html).not.toContain(designCopy.fillDetails)
})

it("keeps pattern and reset inside a design-mode fill section", () => {
  setFold("shape", "fillDetails", true)
  const html = renderToStaticMarkup(
    createElement(ElementDesign, {
      mode: "design",
      model: panelOf(
        {
          node: elementId("258.2"),
          facts: { kind: "shape", text: false, grouped: false, animated: false },
          kept: [],
          value: null,
          box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
        },
        {
          reads: {},
          moves: true,
          fields: {
            "geometry.shape": { value: { preset: "ellipse" }, own: true },
            "fills.p0": { value: { solid: { rgb: "112233" } }, own: true },
          },
        },
      ),
      palette: { templateColors: [], deck: [] },
      onChange: () => {},
    }),
  )
  expect(html).toContain(`data-design-section="${designCopy.fillDetails}"`)
  expect(html).toContain("data-fill-details")
  expect(html).toContain(fillCopy.reset)
  expect(html).not.toContain("<details")
  setFold("shape", "fillDetails", false)
})

it("keeps the text Link section open without a fold button", () => {
  const html = panel("shape")
  const start = html.indexOf(`data-design-section="${linkCopy.section}"`)
  expect(start).toBeGreaterThan(-1)
  expect(html.slice(start).split("</section>")[0]).not.toContain('data-slot="collapsible-trigger"')
})
