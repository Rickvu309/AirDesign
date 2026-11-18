import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { panelOf, panelOfMany } from "./panel"

const connector: ScopedElement = {
  node: elementId("258.6"),
  facts: { kind: "connector", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 0 },
}

const shape: ScopedElement = {
  node: elementId("258.2"),
  facts: { kind: "shape", text: true, grouped: false, animated: false },
  kept: [],
  value: "Hello",
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}

function filled(node: string, fill: unknown, x: number) {
  const view = { ...shape, node: elementId(node), value: "", box: { x, y: 0, cx: 914_400, cy: 914_400 } }
  return panelOf(view, {
    reads: {},
    moves: true,
    fields: { "geometry.shape": { value: { preset: "ellipse" }, own: true }, "fill.value": { value: fill, own: true } },
  })
}

function textBox(node: string) {
  return panelOf({ ...shape, node: elementId(node) }, { reads: {}, moves: true })
}

it("uses the selected elements' mode to decide which controls a text box and a line share", () => {
  const line = panelOf(connector, { reads: {}, moves: true })
  const text = filled("258.2", null, 0)
  const slides = panelOfMany([text, line], "slides").sections.map(({ trait }) => trait)
  expect(slides).toEqual(["alignment", "border", "shadow"])
  const design = panelOfMany([text, line], "design").sections.map(({ trait }) => trait)
  expect(design).toContain("opacity")
  expect(design).toContain("effects")
})

it("shows text controls first for a text selection and hides corners and shadow", () => {
  const text = panelOfMany([textBox("258.2"), textBox("258.3")], "slides")
  const sections = text.sections.map(({ trait }) => trait)
  expect(sections.slice(0, 4)).toEqual(["alignment", "text", "textFill", "opacity"])
  expect(sections).not.toContain("corners")
  expect(sections).not.toContain("shadow")
})

it("hides opacity and text controls when a line joins the selection", () => {
  const line = panelOf(connector, { reads: {}, moves: true })
  const mixed = panelOfMany([textBox("258.2"), line], "slides")
  expect(mixed.sections.map(({ trait }) => trait)).not.toContain("opacity")
  expect(mixed.sections.map(({ trait }) => trait)).not.toContain("text")
})

it("shows corners when every selected shape supports it", () => {
  const rect = (node: string, size: number) =>
    panelOf(
      {
        ...shape,
        node: elementId(node),
        facts: { ...shape.facts, text: false },
        box: { x: 0, y: 0, cx: size, cy: size },
      },
      { reads: {}, moves: true, fields: { "geometry.shape": { value: { preset: "rect" }, own: true } } },
    )
  const panel = panelOfMany([rect("258.2", 914_400), rect("258.3", 457_200)], "slides")
  expect(panel.sections.find(({ trait }) => trait === "corners")?.strips.flat()[0]).toMatchObject({
    value: 0,
    mixed: false,
  })
})
