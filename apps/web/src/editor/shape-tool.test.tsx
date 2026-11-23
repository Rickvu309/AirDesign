import { shapeNames } from "@airdesign/doom"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { geometryWords } from "@/copy/geometry-copy"
import { gridColumns, gridStep, moreShapes, ShapeGrid } from "@/design/shape-grid"
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
  for (const shape of Object.values(trayGeometries)) expect(moreShapes).toContain(shape)
})

it("offers every Doom shape and the two lines in the More shapes grid, each once and named", () => {
  expect([...moreShapes].sort()).toEqual(["line", "straightConnector1", ...shapeNames].sort())
  expect(moreShapes.filter((shape) => geometryWords[shape] === undefined)).toEqual([])
})

it("lists every shape in the More shapes grid, each one on and named as the Shape type list names it", () => {
  const picked: string[] = []
  const tags = tagsOf(renderToStaticMarkup(<ShapeGrid onShape={(shape) => picked.push(shape)} />))
  expect(tags.map(labelOf)).toEqual(moreShapes.map((shape) => geometryWords[shape]))
  expect(tags.filter((tag) => / disabled=""/.test(tag))).toEqual([])
  expect(picked).toEqual([])
})

it("marks the chosen preset pressed and lets Tab reach only it, so arrows move from there", () => {
  const tags = tagsOf(renderToStaticMarkup(<ShapeGrid onShape={() => undefined} label="Type" chosen="diamond" />))
  expect(tags.filter((tag) => / aria-pressed="true"/.test(tag)).map(labelOf)).toEqual([geometryWords.diamond])
  expect(tags.filter((tag) => / tabindex="0"/.test(tag)).map(labelOf)).toEqual([geometryWords.diamond])
})

it("steps through the grid by row and column and stops at its edges", () => {
  const count = moreShapes.length
  expect(gridStep("ArrowRight", 0, count)).toBe(1)
  expect(gridStep("ArrowLeft", 0, count)).toBe(0)
  expect(gridStep("ArrowDown", 2, count)).toBe(2 + gridColumns)
  expect(gridStep("ArrowUp", 2, count)).toBe(2)
  expect(gridStep("ArrowDown", count - 1, count)).toBe(count - 1)
  expect(gridStep("ArrowRight", count - 1, count)).toBe(count - 1)
  expect(gridStep("End", 0, count)).toBe(count - 1)
  expect(gridStep("Home", 9, count)).toBe(0)
  expect(gridStep("Enter", 9, count)).toBeNull()
})
