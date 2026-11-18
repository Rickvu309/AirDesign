import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { panelOf } from "./panel"

const picture: ScopedElement = {
  node: elementId("258.4"),
  facts: { kind: "shape", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}

it("leads a shape whose fills hold an image with Fill, Opacity, Border and Shadow, retaining its exact editors", () => {
  const panel = panelOf(picture, {
    reads: {},
    moves: true,
    fields: {
      "fills.p0": { value: { image: true }, own: true },
      "fills.source": { value: "rocket", own: true },
      "fills.alpha": { value: 60_000, own: true },
      "geometry.shape": { value: { preset: "rect", adjust: {} }, own: true },
    },
  })
  expect(panel.sections.map((section) => section.trait)).toEqual([
    "alignment",
    "pictureFill",
    "opacity",
    "corners",
    "border",
    "shadow",
    "fills",
    "image",
    "crop",
    "box",
    "effects",
    "identity",
  ])
  const image = panel.sections.find((section) => section.trait === "image")
  expect(image?.strips.flat().map((row) => [row.field, row.label, row.kind])).toEqual([
    ["source", "Icon", "asset"],
    ["recolor", "Recolor", "union"],
  ])
  expect(image?.strips.flat()[0]?.value).toBe("rocket")
  const fill = panel.sections.find((section) => section.trait === "pictureFill")
  expect(fill?.strips.map((strip) => strip.map((row) => [row.field, row.label]))).toEqual([
    [["mode", "Fill mode"]],
    [
      ["overlay", "Overlay"],
      ["blur", "Blur"],
    ],
  ])
  expect(panel.kind).toBe("picture")
  expect(image?.strips.flat()[0]?.change("star")).toEqual({ target: { node: "258.4" }, fills: { source: "star" } })
  const identity = panel.sections.find((section) => section.trait === "identity")
  expect(identity?.label).toBe("Name and alt text")
  expect(identity?.strips.flat().map((row) => [row.label, row.kind])).toEqual([
    ["Name", "text"],
    ["Alt text", "text"],
    ["Hide on slide", "toggle"],
  ])
  expect(panel.sections.find((section) => section.trait === "opacity")?.strips.flat()[0]?.value).toBe(60_000)
})

const shape: ScopedElement = {
  node: elementId("258.2"),
  facts: { kind: "shape", text: true, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}

const ellipse = { "geometry.shape": { value: { preset: "ellipse", adjust: {} }, own: true } }

it("puts an image fill's preview controls on the Fill section of a shape that holds text", () => {
  const panel = panelOf(shape, {
    reads: {},
    moves: true,
    fields: {
      ...ellipse,
      "fills.p0": { value: { image: true }, own: true },
      "fills.source": { value: "rocket", own: true },
    },
  })
  expect(panel.kind).toBe("shape")
  const fill = panel.sections.find((section) => section.trait === "fills")
  expect(fill?.strips.slice(-2).map((strip) => strip.map((row) => [row.field, row.label]))).toEqual([
    [["mode", "Fill mode"]],
    [
      ["overlay", "Overlay"],
      ["blur", "Blur"],
    ],
  ])
  expect(panel.sections.some((section) => section.trait === "image")).toBe(false)
  const solid = panelOf(shape, {
    reads: {},
    moves: true,
    fields: { ...ellipse, "fills.p0": { value: { solid: { scheme: "accent1" } }, own: true } },
  })
  const fields = solid.sections
    .find((section) => section.trait === "fills")
    ?.strips.flat()
    .map((row) => row.field)
  expect(fields).not.toContain("mode")
})
