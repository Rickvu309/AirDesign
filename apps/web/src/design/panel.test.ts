import { elementId, writeTextValue, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { panelOf, partRow, type ShownField } from "./panel"

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

it("shows one Opacity for the fill, line and text it fades together", () => {
  const panel = panelOf(shape, { reads: {}, moves: true, fields: {} })
  expect(panel.sections.filter((section) => section.trait === "opacity")).toHaveLength(1)
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

it("lays out a text box's body field by field, autofit included", () => {
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
    ["autofit", "choice", "shrink", "Reset autofit"],
    ["vertical", "choice", undefined, null],
    ["columns", "count", 1, null],
  ])
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

const untouched = {
  "text.size": { value: 1800, own: false },
  "text.font": { value: "Arial", own: false },
  "text.align": { value: "left", own: false },
  "text.lineSpacing": { value: 100_000, own: false },
  "text.spaceBefore": { value: 0, own: false },
  "text.spaceAfter": { value: 0, own: false },
  "body.columns": { value: 1, own: false },
  "body.anchor": { value: "ctr", own: true },
}

function shownRows(view: ScopedElement, fields: Readonly<Record<string, ShownField>> = untouched) {
  const panel = panelOf(view, { reads: {}, moves: true, fields })
  return Object.fromEntries(
    panel.sections.flatMap((section) =>
      section.rows.map((row) => [`${row.trait}.${row.field}`, [row.value, row.inherited]]),
    ),
  )
}

it("shows an untouched text box's painted size, font and spacing as inherited", () => {
  const rows = shownRows({ ...shape, value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hello" }] }]) })
  expect(rows["text.size"]).toEqual([1800, true])
  expect(rows["text.font"]).toEqual(["Arial", true])
  expect(rows["text.color"]).toEqual([{ scheme: "tx1" }, true])
  expect(rows["text.align"]).toEqual(["left", true])
  expect(rows["text.lineSpacing"]).toEqual([100_000, true])
  expect(rows["text.spaceBefore"]).toEqual([0, true])
  expect(rows["text.spaceAfter"]).toEqual([0, true])
  expect(rows["body.columns"]).toEqual([1, true])
  expect(rows["body.anchor"]).toEqual(["ctr", false])
})

it("shows a size or spacing the element sets as its own", () => {
  const value = writeTextValue([{ from: 0, lineSpacing: 150_000, runs: [{ from: 0, text: "Hello", size: 2400 }] }])
  const rows = shownRows({ ...shape, value })
  expect(rows["text.size"]).toEqual([2400, false])
  expect(rows["text.lineSpacing"]).toEqual([150_000, false])
  expect(rows["text.font"]).toEqual(["Arial", true])
  expect(shownRows(shape, { ...untouched, "text.font": { value: "Abadi", own: true } })["text.font"]).toEqual([
    "Abadi",
    false,
  ])
})

it("leaves a field empty and not inherited when nothing paints it", () => {
  const rows = shownRows(shape, { ...untouched, "text.lineSpacing": { value: null, own: false } })
  expect(rows["text.lineSpacing"]).toEqual([undefined, false])
})

it("sizes a table by Width and Height beside X and Y, and offers no rotation for it", () => {
  const table: ScopedElement = {
    node: elementId("258.4"),
    facts: { kind: "table", text: false, grouped: false, animated: false },
    kept: [],
    value: null,
    box: { x: 457_200, y: 914_400, cx: 7_315_200, cy: 1_112_520 },
  }
  const panel = panelOf(table, { reads: {}, moves: true, fields: {} })
  const rows = panel.sections.find((section) => section.trait === "box")?.rows ?? []
  expect(rows.filter((row) => row.control === "length").map((row) => [row.label, row.value])).toEqual([
    ["X", 457_200],
    ["Y", 914_400],
    ["Width", 7_315_200],
    ["Height", 1_112_520],
  ])
  expect(rows.map((row) => row.field)).not.toContain("rot")
  expect(rows.find((row) => row.field === "w")?.change(9_144_000)).toEqual({
    target: { node: "258.4" },
    box: { w: 9_144_000 },
  })
})

function boxRows(view: ScopedElement, fields: Readonly<Record<string, ShownField>>) {
  const panel = panelOf(view, { reads: {}, moves: true, fields })
  return panel.sections.find((section) => section.trait === "box")?.rows ?? []
}

it("draws Align and Distribute as actions and every other box row as itself", () => {
  const rows = boxRows(shape, {})
  expect(rows.filter((row) => row.control === "action").map((row) => row.field)).toEqual(["align", "distribute"])
  expect(rows.filter((row) => row.control !== "action").map((row) => row.field)).toEqual([
    "x",
    "y",
    "w",
    "h",
    "rot",
    "flipH",
    "flipV",
  ])
})

it("leaves Flip to the route of a connector that is bound to a shape", () => {
  const bound = { value: { shape: { node: "258.2", site: 1 } }, own: true }
  const free = { value: { none: true }, own: true }
  expect(boxRows(connector, { "connection.end": bound }).map((row) => row.field)).not.toContain("flipH")
  expect(boxRows(connector, { "connection.start": bound }).map((row) => row.field)).not.toContain("flipV")
  expect(boxRows(connector, { "connection.start": free, "connection.end": free }).map((row) => row.field)).toContain(
    "flipH",
  )
  expect(boxRows(connector, {}).map((row) => row.field)).toContain("flipV")
})

function pickedOver(own: boolean, alpha: number) {
  const fields = { "line.fill": { value: { solid: { scheme: "accent2" } }, own }, "line.alpha": { value: alpha, own } }
  const panel = panelOf(connector, { reads: {}, moves: true, fields })
  const row = panel.sections.find((section) => section.trait === "line")?.rows.find((each) => each.field === "fill")
  if (row === undefined) throw new Error("line fill")
  return row.change({ solid: { rgb: "C00000" } })
}

it("writes a colour picked over an inherited line color at the opacity the line showed, so the file's own alpha does not come back", () => {
  expect(pickedOver(false, 100_000)).toEqual({
    target: { node: connector.node },
    line: { fill: { solid: { rgb: "C00000", transforms: [{ op: "alpha", val: 100_000 }] } } },
  })
})

it("writes a colour picked over the line's own color as picked, so the export keeps the alpha it showed", () => {
  expect(pickedOver(true, 60_000)).toEqual({
    target: { node: connector.node },
    line: { fill: { solid: { rgb: "C00000" } } },
  })
})
