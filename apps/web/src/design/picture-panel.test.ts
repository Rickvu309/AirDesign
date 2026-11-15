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

it("shows a picture's icon, recolour and crop, its Opacity before its line, and its name and alt text last", () => {
  const panel = panelOf(picture, {
    reads: {},
    moves: true,
    fields: { "image.source": { value: "rocket", own: true }, "image.alpha": { value: 60_000, own: true } },
  })
  expect(panel.sections.map((section) => section.trait)).toEqual([
    "box",
    "geometry",
    "opacity",
    "line",
    "effects",
    "image",
    "crop",
    "identity",
  ])
  const image = panel.sections.find((section) => section.trait === "image")
  expect(image?.rows.map((row) => [row.field, row.label, row.control])).toEqual([
    ["source", "Icon", "asset"],
    ["recolor", "Recolor", "union"],
  ])
  expect(image?.rows[0]?.value).toBe("rocket")
  expect(image?.rows[0]?.change("star")).toEqual({ target: { node: "258.4" }, image: { source: "star" } })
  const identity = panel.sections.find((section) => section.trait === "identity")
  expect(identity?.label).toBe("Name and alt text")
  expect(identity?.rows.map((row) => [row.label, row.control])).toEqual([
    ["Name", "text"],
    ["Alt text", "text"],
    ["Hide on slide", "toggle"],
  ])
  expect(panel.sections.find((section) => section.trait === "opacity")?.rows[0]?.value).toBe(60_000)
})
