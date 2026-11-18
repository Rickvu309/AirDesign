import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { panelOf, partControl } from "./panel"
import { sectionInMode, type PanelMode } from "./panel-order"

const connector: ScopedElement = {
  node: elementId("258.6"),
  facts: { kind: "connector", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 0 },
}

function borderRows(fill: unknown, mode: PanelMode, dash = "solid"): readonly (readonly string[])[] {
  const fields = { "border.fill": { value: fill, own: true }, "border.dash": { value: dash, own: false } }
  const panel = panelOf(connector, { reads: {}, moves: true, fields })
  const border = panel.sections.find((section) => section.trait === "border")
  return border === undefined ? [] : sectionInMode(border, mode).strips.map((strip) => strip.map(({ field }) => field))
}

it("shows one Border section: the presets alone while the border is none, in either mode", () => {
  expect(borderRows({ none: true }, "slides")).toEqual([["border"]])
  expect(borderRows({ none: true }, "design")).toEqual([["border"]])
})

it("shows Color and Border width under the presets, and in design mode the full paint and every exact setting", () => {
  const solid = { solid: { scheme: "accent1" } }
  expect(borderRows(solid, "slides")).toEqual([["border"], ["color", "width"]])
  const exact = [["border"], ["fill"], ["width"], ["dash"], ["cap", "compound"], ["join"], ["head", "tail"]]
  expect(borderRows(solid, "design")).toEqual(exact)
  expect(borderRows(solid, "slides", "lgDash")).toEqual([["border"]])
  expect(borderRows(solid, "design", "lgDash")).toEqual(exact)
})

it("keeps a gradient border's paint in design mode, named apart from the fill's", () => {
  const gradient = {
    gradient: {
      stops: [
        { at: 0, color: { scheme: "accent1" } },
        { at: 100_000, color: { scheme: "accent2" } },
      ],
      shade: { linear: { angle: 0, scaled: false } },
      rotateWithShape: true,
    },
  }
  expect(borderRows(gradient, "slides")).toEqual([["border"]])
  expect(borderRows(gradient, "design")).toEqual([
    ["border"],
    ["fill"],
    ["width"],
    ["dash"],
    ["cap", "compound"],
    ["join"],
    ["head", "tail"],
  ])
  const fields = { "border.fill": { value: gradient, own: true } }
  const border = panelOf(connector, { reads: {}, moves: true, fields }).sections.find(
    (section) => section.trait === "border",
  )
  const fill = border === undefined ? undefined : sectionInMode(border, "design").strips[1]?.[0]
  if (fill === undefined || fill.desc.kind !== "union") throw new Error("border fill")
  const solid = fill.desc.cases.solid
  if (solid === undefined) throw new Error("solid")
  expect(partControl(fill, "solid", solid, { scheme: "accent1" }).label).toBe("Border color")
})
