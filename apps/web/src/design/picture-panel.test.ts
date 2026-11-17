import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { panelOf } from "./panel"

const picture: ScopedElement = {
  node: elementId("258.4"),
  facts: { kind: "picture", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}

it("shows a picture's icon, recolour and crop first, and its name and alt text last", () => {
  const panel = panelOf(picture, {
    reads: {},
    moves: true,
    fields: {
      "image.source": { value: "rocket", own: true },
      "image.alpha": { value: 60_000, own: true },
      "geometry.shape": { value: { preset: "rect", adjust: {} }, own: true },
    },
  })
  expect(panel.sections.map((section) => section.trait)).toEqual([
    "image",
    "crop",
    "box",
    "opacity",
    "line",
    "effects",
    "identity",
  ])
  const image = panel.sections.find((section) => section.trait === "image")
  expect(image?.strips.flat().map((row) => [row.field, row.label, row.control])).toEqual([
    ["source", "Icon", "asset"],
    ["recolor", "Recolor", "union"],
  ])
  expect(image?.strips.flat()[0]?.value).toBe("rocket")
  expect(image?.strips.flat()[0]?.change("star")).toEqual({ target: { node: "258.4" }, image: { source: "star" } })
  const identity = panel.sections.find((section) => section.trait === "identity")
  expect(identity?.label).toBe("Name and alt text")
  expect(identity?.strips.flat().map((row) => [row.label, row.control])).toEqual([
    ["Name", "text"],
    ["Alt text", "text"],
    ["Hide on slide", "toggle"],
  ])
  expect(panel.sections.find((section) => section.trait === "opacity")?.strips.flat()[0]?.value).toBe(60_000)
})
