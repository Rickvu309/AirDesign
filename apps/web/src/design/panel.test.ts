import { elementId, writeTextValue, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { panelOf, panelOfMany, partControl, type ShownField } from "./panel"

const connector: ScopedElement = {
  node: elementId("258.6"),
  facts: { kind: "connector", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914_400, cy: 0 },
}

function lineControls(fill: unknown): readonly string[] {
  const panel = panelOf(connector, { reads: {}, moves: true, fields: { "line.fill": { value: fill, own: true } } })
  return (
    panel.sections
      .find((section) => section.trait === "line")
      ?.strips.flat()
      .map((control) => control.field) ?? []
  )
}

it("shows only the line's kind while the line is none, and every line field once it has a color", () => {
  expect(lineControls({ none: true })).toEqual(["fill"])
  expect(lineControls({ solid: { scheme: "accent1" } })).toEqual([
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
  const fill = panel.sections.find((section) => section.trait === "line")?.strips.flat()[0]
  if (fill === undefined || fill.desc.kind !== "union") throw new Error("line fill")
  const solid = fill.desc.cases.solid
  if (solid === undefined) throw new Error("solid")
  expect(partControl(fill, "solid", solid, { scheme: "accent1" }).label).toBe("Line color")
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
  return panel.sections.find((section) => section.trait === "opacity")?.strips.flat()[0]
}

it("shows one Opacity for the fill, line and text it fades together", () => {
  const panel = panelOf(shape, { reads: {}, moves: true, fields: {} })
  expect(panel.sections.filter((section) => section.trait === "opacity")).toHaveLength(1)
  const control = opacityOf(shape, { "fill.alpha": 60_000, "line.alpha": 60_000, "text.alpha": 60_000 })
  expect(control).toMatchObject({ label: "Opacity", kind: "percent", value: 60_000, mixed: false, reset: null })
  expect(control?.change(25_000)).toEqual({ target: { node: "258.2" }, opacity: 25_000 })
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
  expect(body?.strips.flat().map((control) => [control.field, control.kind, control.value, control.reset])).toEqual([
    ["insets", "record", undefined, null],
    ["anchor", "choice", "ctr", "Reset vertical alignment"],
    ["wrap", "toggle", undefined, null],
    ["autofit", "choice", "shrink", "Reset autofit"],
    ["vertical", "choice", undefined, null],
    ["columns", "count", 1, null],
  ])
  const text = panel.sections.find((section) => section.trait === "text")
  const typed = text?.strips
    .flat()
    .filter((control) => ["font", "lineSpacing", "spaceBefore", "spaceAfter"].includes(control.field))
  expect(typed?.map((control) => [control.label, control.kind, control.value])).toEqual([
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

function shownControls(view: ScopedElement, fields: Readonly<Record<string, ShownField>> = untouched) {
  const panel = panelOf(view, { reads: {}, moves: true, fields })
  return Object.fromEntries(
    panel.sections.flatMap((section) =>
      section.strips.flat().map((control) => [`${control.trait}.${control.field}`, [control.value, control.inherited]]),
    ),
  )
}

it("shows an untouched text box's painted size, font and spacing as inherited", () => {
  const controls = shownControls({ ...shape, value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hello" }] }]) })
  expect(controls["text.size"]).toEqual([1800, true])
  expect(controls["text.font"]).toEqual(["Arial", true])
  expect(controls["text.color"]).toEqual([{ scheme: "tx1" }, true])
  expect(controls["text.align"]).toEqual(["left", true])
  expect(controls["text.lineSpacing"]).toEqual([100_000, true])
  expect(controls["text.spaceBefore"]).toEqual([0, true])
  expect(controls["text.spaceAfter"]).toEqual([0, true])
  expect(controls["body.columns"]).toEqual([1, true])
  expect(controls["body.anchor"]).toEqual(["ctr", false])
})

it("shows a size or spacing the element sets as its own", () => {
  const value = writeTextValue([{ from: 0, lineSpacing: 150_000, runs: [{ from: 0, text: "Hello", size: 2400 }] }])
  const controls = shownControls({ ...shape, value })
  expect(controls["text.size"]).toEqual([2400, false])
  expect(controls["text.lineSpacing"]).toEqual([150_000, false])
  expect(controls["text.font"]).toEqual(["Arial", true])
  expect(shownControls(shape, { ...untouched, "text.font": { value: "Abadi", own: true } })["text.font"]).toEqual([
    "Abadi",
    false,
  ])
})

it("leaves a field empty and not inherited when nothing paints it", () => {
  const controls = shownControls(shape, { ...untouched, "text.lineSpacing": { value: null, own: false } })
  expect(controls["text.lineSpacing"]).toEqual([undefined, false])
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
  const controls = panel.sections.find((section) => section.trait === "box")?.strips.flat() ?? []
  expect(
    controls.filter((control) => control.kind === "length").map((control) => [control.label, control.value]),
  ).toEqual([
    ["X", 457_200],
    ["Y", 914_400],
    ["Width", 7_315_200],
    ["Height", 1_112_520],
  ])
  expect(controls.map((control) => control.field)).not.toContain("rot")
  expect(controls.find((control) => control.field === "w")?.change(9_144_000)).toEqual({
    target: { node: "258.4" },
    box: { w: 9_144_000 },
  })
})

function boxControls(view: ScopedElement, fields: Readonly<Record<string, ShownField>>) {
  const panel = panelOf(view, { reads: {}, moves: true, fields })
  return panel.sections.find((section) => section.trait === "box")?.strips.flat() ?? []
}

it("draws Align and Distribute as actions and every other box control as itself", () => {
  const controls = boxControls(shape, {})
  expect(controls.filter((control) => control.kind === "action")).toEqual([])
  expect(controls.filter((control) => control.kind !== "action").map((control) => control.field)).toEqual([
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
  expect(boxControls(connector, { "connection.end": bound }).map((control) => control.field)).not.toContain("flipH")
  expect(boxControls(connector, { "connection.start": bound }).map((control) => control.field)).not.toContain("flipV")
  expect(
    boxControls(connector, { "connection.start": free, "connection.end": free }).map((control) => control.field),
  ).toContain("flipH")
  expect(boxControls(connector, {}).map((control) => control.field)).toContain("flipV")
})

function filled(node: string, fill: unknown, x: number) {
  const view = { ...shape, node: elementId(node), value: "", box: { x, y: 0, cx: 914_400, cy: 914_400 } }
  return panelOf(view, { reads: {}, moves: true, fields: { "fill.value": { value: fill, own: true } } })
}

it("reads Mixed where two shapes differ and sets the fill of both in one change", () => {
  const blue = filled("258.2", { solid: { scheme: "accent1" } }, 0)
  const green = filled("258.3", { solid: { scheme: "accent6" } }, 914_400)
  const panel = panelOfMany([blue, green])
  expect(panel).toMatchObject({ nodes: ["258.2", "258.3"], node: "258.3", kind: "many" })
  const control = (trait: string, field: string) =>
    panel.sections
      .find((section) => section.trait === trait)
      ?.strips.flat()
      .find((each) => each.field === field)
  expect(control("fill", "value")).toMatchObject({ value: { solid: { scheme: "accent1" } }, mixed: true })
  expect(control("box", "x")).toMatchObject({ value: undefined, mixed: true })
  expect(control("box", "y")).toMatchObject({ value: 0, mixed: false })
  expect(control("fill", "value")?.change({ solid: { scheme: "accent2" } })).toEqual({
    target: { nodes: ["258.2", "258.3"] },
    fill: { value: { solid: { scheme: "accent2" } } },
  })
  expect(control("alignment", "align")?.change("left")).toEqual({
    target: { nodes: ["258.2", "258.3"] },
    box: { align: "left" },
  })
})

it("leaves out what only one element can hold, such as its text and its name", () => {
  const panel = panelOfMany([filled("258.2", null, 0), filled("258.3", null, 0)])
  expect(panel.sections.map((section) => section.trait)).toEqual([
    "alignment",
    "fill",
    "opacity",
    "text",
    "box",
    "line",
    "effects",
  ])
  expect(panel.sections.find((section) => section.trait === "effects")?.open).toBe(false)
  const fields = panel.sections.flatMap((section) =>
    section.strips.flat().map((control) => `${control.trait}.${control.field}`),
  )
  expect(fields).not.toContain("text.value")
  expect(fields).toContain("text.size")
})

it("keeps the fill kind two shapes share, and names no kind when their kinds differ", () => {
  const solid = filled("258.2", { solid: { scheme: "accent1" } }, 0)
  const none = filled("258.3", { none: true }, 0)
  const fill = panelOfMany([solid, none])
    .sections.find((section) => section.trait === "fill")
    ?.strips.flat()[0]
  expect(fill).toMatchObject({ value: undefined, mixed: true })
})

function pickedOver(own: boolean, alpha: number) {
  const fields = { "line.fill": { value: { solid: { scheme: "accent2" } }, own }, "line.alpha": { value: alpha, own } }
  const panel = panelOf(connector, { reads: {}, moves: true, fields })
  const control = panel.sections
    .find((section) => section.trait === "line")
    ?.strips.flat()
    .find((each) => each.field === "fill")
  if (control === undefined) throw new Error("line fill")
  return control.change({ solid: { rgb: "C00000" } })
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

it("arranges a text box into strips with resolved names and choices", () => {
  const panel = panelOf(shape, { reads: {}, moves: true })
  const text = panel.sections.find((section) => section.trait === "text")
  expect(text?.strips.map((strip) => strip.map((control) => control.field))).toEqual([
    ["font"],
    ["size", "lineSpacing"],
    ["bold", "italic", "underline"],
    ["align", "bullet"],
    ["color"],
    ["spaceBefore", "spaceAfter"],
  ])
  expect(text?.strips[0]?.[0]?.look.name).toEqual({ show: "hidden" })
  expect(text?.strips[1]?.[0]?.look.name.show).toBe("icon")
  expect(text?.strips[3]?.[0]?.look.form).toBe("segments")
  expect(text?.strips[3]?.[0]?.look.options.left).toBeDefined()
})

it("resolves box actions and letter names in the shape's strips", () => {
  const panel = panelOf({ ...shape, facts: { ...shape.facts, text: false } }, { reads: {}, moves: true })
  expect(panel.kind).toBe("shape")
  const box = panel.sections.find((section) => section.trait === "box")
  expect(box?.strips.map((strip) => strip.map((control) => control.field))).toEqual([
    ["x", "y"],
    ["w", "h"],
    ["rot", "flipH", "flipV"],
  ])
  expect(box?.strips[1]?.[0]?.look.name).toEqual({ show: "letter", letter: "W" })
  expect(panel.sections[0]).toMatchObject({
    trait: "alignment",
    label: null,
    strips: [
      [
        { field: "align", trait: "box", kind: "action" },
        { field: "distribute", trait: "box", kind: "action" },
      ],
    ],
  })
  const geometry = panel.sections.find((section) => section.trait === "geometry")?.strips.flat()[0]
  if (geometry === undefined || geometry.desc.kind !== "record") throw new Error("geometry")
  const preset = geometry.desc.fields.preset
  if (preset === undefined) throw new Error("preset")
  expect(partControl(geometry, "preset", preset, "rect")).toMatchObject({
    kind: "preset",
    look: { name: { show: "above" } },
  })
})

it("resolves a connector's choice form explicitly and its site override", () => {
  const panel = panelOf(connector, { reads: {}, moves: true })
  const line = panel.sections.find((section) => section.trait === "line")
  expect(line?.strips.map((strip) => strip.map((control) => control.field))).toEqual([
    ["fill"],
    ["width", "dash"],
    ["cap", "compound"],
    ["join"],
    ["head", "tail"],
  ])
  expect(line?.strips[2]?.[0]?.look.form).toBe("list")
  const connection = panel.sections.find((section) => section.trait === "connection")?.strips.flat()[0]
  if (connection === undefined || connection.desc.kind !== "union") throw new Error("connection")
  const attached = connection.desc.cases.shape
  if (attached === undefined || attached.kind !== "record") throw new Error("attached")
  const site = attached.fields.site
  if (site === undefined) throw new Error("site")
  const shapePart = partControl(connection, "shape", attached, {})
  expect(partControl(shapePart, "site", site, 0)).toMatchObject({ kind: "site", look: { name: { show: "above" } } })
})

it("keeps the same strips and looks for a many-selection", () => {
  const first = panelOf(shape, { reads: {}, moves: true })
  const second = panelOf({ ...shape, node: elementId("258.3") }, { reads: {}, moves: true })
  const panel = panelOfMany([first, second])
  expect(
    panel.sections
      .find((section) => section.trait === "box")
      ?.strips.map((strip) => strip.map((control) => control.field)),
  ).toEqual([
    ["x", "y"],
    ["w", "h"],
    ["rot", "flipH", "flipV"],
  ])
  expect(panel.sections.find((section) => section.trait === "opacity")?.strips[0]?.[0]?.look.name).toEqual({
    show: "beside",
  })
})

it("leaves text content to the canvas and omits alignment when moves are refused", () => {
  const panel = panelOf(shape, { reads: {}, moves: true })
  expect(
    panel.sections.flatMap((section) => section.strips.flat()).map((control) => `${control.trait}.${control.field}`),
  ).not.toContain("text.value")
  expect(panelOf(shape, { reads: {}, moves: false }).sections.map((section) => section.trait)).not.toContain(
    "alignment",
  )
})
