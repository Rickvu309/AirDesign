import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { panelOf, partRow } from "./panel"

const connector: ScopedElement = {
  node: elementId("258.6"),
  facts: { kind: "connector", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 0 },
}

function lineRows(fill: unknown): readonly string[] {
  const panel = panelOf(connector, { reads: {}, moves: true, fields: { "line.fill": { value: fill, own: true } } })
  return panel.sections.find((section) => section.trait === "line")?.rows.map((row) => row.field) ?? []
}

it("shows only the line's kind while the line is none, and every line field once it has a color", () => {
  expect(lineRows({ none: true })).toEqual(["fill"])
  expect(lineRows({ solid: { scheme: "accent1" } })).toEqual([
    "fill",
    "width",
    "dash",
    "cap",
    "compound",
    "join",
    "head",
    "tail",
  ])
})

it("names the line's own color apart from the fill's, so each swatch group has its own name", () => {
  const panel = panelOf(connector, {
    reads: {},
    moves: true,
    fields: { "line.fill": { value: { solid: { scheme: "accent1" } }, own: true } },
  })
  const fill = panel.sections.find((section) => section.trait === "line")?.rows[0]
  if (fill === undefined || fill.desc.kind !== "union") throw new Error("line fill")
  const solid = fill.desc.cases.solid
  if (solid === undefined) throw new Error("solid")
  expect(partRow(fill, "solid", solid, { scheme: "accent1" }).label).toBe("Line color")
})
