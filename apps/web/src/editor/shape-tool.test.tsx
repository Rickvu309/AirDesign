import { presets, type Geometry } from "@airdesign/document"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { geometryWords } from "@/copy/geometry-copy"
import { ShapeGrid } from "@/editor/shape-grid"
import { ShapeTrayItems, trayGeometries } from "@/editor/shape-tool"

function tagsOf(markup: string) {
  return [...markup.matchAll(/<button[^>]*>/g)].map((tag) => tag[0])
}

function labelOf(tag: string) {
  return /aria-label="([^"]*)"/.exec(tag)?.[1]
}

it("offers the twelve shapes the design's tray shows, and every one is on", () => {
  const tags = tagsOf(renderToStaticMarkup(<ShapeTrayItems onShape={() => undefined} onMore={() => undefined} />))
  expect(tags.map(labelOf)).toEqual([
    "Line",
    "Arrow",
    "Rectangle",
    "Ellipse",
    "Diamond",
    "Triangle",
    "Star",
    "Plus",
    "Left arrow",
    "Right arrow",
    "Speech bubble",
    "More shapes",
  ])
  expect(tags.filter((tag) => / disabled=""/.test(tag))).toEqual([])
})

it("maps each tray shape to the PowerPoint preset it inserts", () => {
  expect(trayGeometries).toEqual({
    Line: "line",
    Arrow: "straightConnector1",
    Rectangle: "rect",
    Ellipse: "ellipse",
    Diamond: "diamond",
    Triangle: "triangle",
    Star: "star5",
    Plus: "plus",
    "Left arrow": "leftArrow",
    "Right arrow": "rightArrow",
    "Speech bubble": "wedgeRectCallout",
  })
  for (const geometry of Object.values(trayGeometries)) expect(presets).toContain(geometry)
})

it("lists every preset in the More shapes grid, each one on and named as the Shape type list names it", () => {
  const picked: Geometry[] = []
  const tags = tagsOf(renderToStaticMarkup(<ShapeGrid onShape={(geometry) => picked.push(geometry)} />))
  expect(tags.map(labelOf)).toEqual(presets.map((preset) => geometryWords[preset]))
  expect(tags.filter((tag) => / disabled=""/.test(tag))).toEqual([])
  expect(picked).toEqual([])
})
