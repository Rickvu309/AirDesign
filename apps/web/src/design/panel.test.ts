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

const shape: ScopedElement = {
  node: elementId("258.2"),
  facts: { kind: "shape", text: true, grouped: false, animated: false },
  kept: [],
  value: "Hello",
  box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
}

function opacityOf(view: ScopedElement, fields: Readonly<Record<string, unknown>>) {
  const shown = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, own: true }]))
  const panel = panelOf(view, { reads: {}, moves: true, fields: shown })
  return panel.sections.find((section) => section.trait === "opacity")?.rows[0]
}

it("shows one Opacity just before the fill, line and text it fades together", () => {
  const panel = panelOf(shape, { reads: {}, moves: true, fields: {} })
  expect(panel.sections.map((section) => section.trait)).toEqual([
    "box",
    "geometry",
    "opacity",
    "fill",
    "line",
    "effects",
    "body",
    "text",
  ])
  const row = opacityOf(shape, { "fill.alpha": 60_000, "line.alpha": 60_000, "text.alpha": 60_000 })
  expect(row).toMatchObject({ label: "Opacity", control: "percent", value: 60_000, mixed: false, reset: null })
  expect(row?.change(25_000)).toEqual({ target: { node: "258.2" }, opacity: 25_000 })
})

it("shows Mixed when the alphas differ, and full opacity when nothing shows a colour", () => {
  expect(opacityOf(shape, { "fill.alpha": 60_000, "line.alpha": 30_000 })).toMatchObject({ mixed: true })
  expect(opacityOf(shape, { "fill.alpha": "mixed", "line.alpha": null })).toMatchObject({ mixed: true })
  expect(opacityOf(shape, { "fill.alpha": 40_000, "line.alpha": null, "text.alpha": null })).toMatchObject({
    value: 40_000,
    mixed: false,
  })
  expect(opacityOf(shape, {})).toMatchObject({ value: 100_000, mixed: false })
  expect(opacityOf(connector, { "fill.alpha": 10_000, "line.alpha": 50_000 })).toMatchObject({ value: 50_000 })
})

it("offers no Opacity on a group, or on a shape whose fill the index keeps", () => {
  const group = { ...shape, facts: { ...shape.facts, kind: "group" as const } }
  expect(opacityOf(group, {})).toBeUndefined()
  expect(opacityOf({ ...shape, kept: ["fill"] }, {})).toBeUndefined()
})

it("lays out a text box's body field by field, and shows its autofit without letting it change", () => {
  const panel = panelOf(shape, {
    reads: { "text.font": { value: "Calibri", source: "master" } },
    moves: true,
    fields: {
      "body.anchor": { value: "ctr", own: true },
      "body.autofit": { value: "shrink", own: true },
      "body.columns": { value: 1, own: false },
    },
  })
  const body = panel.sections.find((section) => section.trait === "body")
  expect(body?.label).toBe("Text box")
  expect(body?.rows.map((row) => [row.field, row.control, row.value, row.reset])).toEqual([
    ["insets", "record", undefined, null],
    ["anchor", "choice", "ctr", "Reset vertical alignment"],
    ["wrap", "toggle", undefined, null],
    ["autofit", "choice", "shrink", null],
    ["vertical", "choice", undefined, null],
    ["columns", "count", 1, null],
  ])
  expect(body?.rows.filter((row) => row.shownOnly === true).map((row) => row.field)).toEqual(["autofit"])
  const text = panel.sections.find((section) => section.trait === "text")
  const typed = text?.rows.filter((row) => ["font", "lineSpacing", "spaceBefore", "spaceAfter"].includes(row.field))
  expect(typed?.map((row) => [row.label, row.control, row.value])).toEqual([
    ["Font", "text", "Calibri"],
    ["Line spacing", "percent", undefined],
    ["Space before", "length", undefined],
    ["Space after", "length", undefined],
  ])
  expect(typed?.[0]?.change("Georgia")).toEqual({ target: { node: "258.2" }, text: { font: "Georgia" } })
})
