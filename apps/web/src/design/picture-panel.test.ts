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

it("leads a picture with Fill, Opacity, Border and Shadow, retaining its exact editors", () => {
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
    "alignment",
    "pictureFill",
    "opacity",
    "corners",
    "border",
    "shadow",
    "image",
    "crop",
    "box",
    "line",
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
  expect(image?.strips.flat()[0]?.change("star")).toEqual({ target: { node: "258.4" }, image: { source: "star" } })
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
  facts: { kind: "shape", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}

it("puts a picture fill's preview controls on the shape's Fill section", () => {
  const panel = panelOf(shape, {
    reads: {},
    moves: true,
    fields: { "fill.value": { value: { picture: "rocket" }, own: true } },
  })
  const fill = panel.sections.find((section) => section.trait === "fill")
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
    fields: { "fill.value": { value: { solid: { scheme: "accent1" } }, own: true } },
  })
  const fields = solid.sections
    .find((section) => section.trait === "fill")
    ?.strips.flat()
    .map((row) => row.field)
  expect(fields).not.toContain("mode")
})
