import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { ShapeTrayItems } from "@/editor/shape-tool"

it("offers the line, rectangle and ellipse the design's tray shows, and keeps the shapes not built yet off", () => {
  const markup = renderToStaticMarkup(<ShapeTrayItems onShape={() => undefined} />)
  const tags = [...markup.matchAll(/<button[^>]*>/g)].map((tag) => tag[0])
  const labels = tags.map((tag) => /aria-label="([^"]*)"/.exec(tag)?.[1])
  expect(labels).toEqual([
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
  const on = tags.filter((tag) => !/ disabled=""/.test(tag)).map((tag) => /aria-label="([^"]*)"/.exec(tag)?.[1])
  expect(on).toEqual(["Line", "Rectangle", "Ellipse"])
})
