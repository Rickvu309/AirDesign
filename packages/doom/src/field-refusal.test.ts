import { describe, expect, it } from "vitest"
import { type AgentChange, readAgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { minter, richDeck } from "./agent-fixtures.js"
import { ids } from "./sample-deck.js"

const hiddenCaption = {
  op: "add",
  kind: "text",
  slide: "m1jx7i64jma5:5",
  textStyle: "caption",
  text: "",
  box: { x: 0, y: 0, w: 10, h: 10 },
  hidden: true,
}

describe("a field refusal names the path, the fault and the accepted form", () => {
  it("refuses the empty hidden caption from the audit as the wrong form of text", () => {
    expect(readAgentChange(hiddenCaption)).toMatchObject({
      refused: "shape",
      field: "text",
      fault: "form",
      form: "A non-empty string.",
    })
  })

  it("names a missing field, an unknown field and a value in the wrong form", () => {
    expect(readAgentChange({ op: "add", kind: "text" })).toMatchObject({
      refused: "shape",
      field: "slide",
      fault: "missing",
    })
    expect(readAgentChange({ op: "set", target: "t:3", nope: true })).toMatchObject({
      refused: "shape",
      field: "nope",
      fault: "unknown",
    })
    expect(readAgentChange({ op: "set", target: "t:3", opacity: 2 })).toMatchObject({
      refused: "shape",
      field: "opacity",
      fault: "form",
      form: "A number from 0 to 1.",
    })
    expect(readAgentChange({ op: "paint" })).toMatchObject({
      refused: "shape",
      field: "op",
      fault: "unknown",
    })
    expect(readAgentChange("add")).toMatchObject({
      refused: "shape",
      field: "op",
      fault: "form",
    })
    const nested = readAgentChange({ op: "set", target: "t:3", box: { x: 0, y: 0, w: "wide", h: 10 } })
    expect(nested).toMatchObject({ refused: "shape", field: "box.w", fault: "form" })
  })
})

const kindForm = "One of text, shape, line, frame, picture, icon, chart, kpi, cards, compare, matrix, timeline, flow."
const colorForm = "A theme colour, lighter or darker by a percent, or #rrggbb."
const nodeForm = "1 to 16 of a-z or 0-9, a colon, then 1 to 12 digits."
const chart = { kind: "bar", categories: ["a"], series: [{ name: "s", values: [1] }] }

const readRows: { readonly raw: unknown; readonly field: string; readonly fault: string; readonly form: string }[] = [
  {
    raw: { op: "set", target: "t:3", chart: { categories: ["a"], series: [{ name: "s", values: [1] }] } },
    field: "chart.kind",
    fault: "missing",
    form: "One of bar, column, line, pie, stacked.",
  },
  {
    raw: { op: "slide", move: { after: null } },
    field: "move.slide",
    fault: "missing",
    form: nodeForm,
  },
  {
    raw: { op: "slide", move: { slide: "t:3" } },
    field: "move.after",
    fault: "missing",
    form: "A node id, or null.",
  },
  {
    raw: { op: "set", target: "t:3", fill: { gradient: ["#112233", "notacolor"] } },
    field: "fill.gradient.1",
    fault: "form",
    form: colorForm,
  },
  {
    raw: { op: "set", target: "t:3", fill: { gradient: ["#112233", "#445566"], angle: "forty" } },
    field: "fill.angle",
    fault: "form",
    form: "A number from -1000000000 to 1000000000.",
  },
  {
    raw: { op: "set", target: "t:3", fill: { gradient: ["#112233", "#445566"], bogus: true } },
    field: "fill.bogus",
    fault: "unknown",
    form: "One of gradient, angle, radial.",
  },
  {
    raw: { op: "set", target: "t:3", fill: { image: "" } },
    field: "fill.image",
    fault: "form",
    form: "A non-empty string.",
  },
  {
    raw: { op: "set", target: "t:3", from: { layer: ids.title, side: "diagonal" } },
    field: "from.side",
    fault: "form",
    form: "One of top, right, bottom, left, center.",
  },
  {
    raw: {
      op: "set",
      target: "t:3",
      chart: { kind: "bar", categories: ["a"], series: [{ name: "s", values: [1], color: "bad" }] },
    },
    field: "chart.series.0.color",
    fault: "form",
    form: colorForm,
  },
  { raw: { op: "deck", colors: { accent1: "blue" } }, field: "colors.accent1", fault: "form", form: "#rrggbb." },
  {
    raw: { op: "deck", fonts: { heading: "!!!" } },
    field: "fonts.heading",
    fault: "form",
    form: "A letter or digit, then up to 99 letters, digits or spaces.",
  },
  { raw: { op: "delete", nodes: [ids.title, "bad"] }, field: "nodes.1", fault: "form", form: nodeForm },
  { raw: { op: "slide", move: { slide: "bad", after: null } }, field: "move.slide", fault: "form", form: nodeForm },
  { raw: { op: "add", slide: "t:3" }, field: "kind", fault: "missing", form: kindForm },
  { raw: { op: "add", kind: "text", slide: "bad" }, field: "slide", fault: "form", form: nodeForm },
  { raw: { op: "set", target: "t:3", color: "purple" }, field: "color", fault: "form", form: colorForm },
  {
    raw: { op: "set", target: "t:3", stroke: "purple" },
    field: "stroke",
    fault: "form",
    form: "A theme colour, lighter or darker by a percent, #rrggbb, or none.",
  },
  {
    raw: {
      op: "set",
      target: "t:3",
      chart: { kind: "bar", categories: ["a", "b"], series: [{ name: "s", values: [1] }] },
    },
    field: "chart.series",
    fault: "form",
    form: "One value per category.",
  },
  {
    raw: { op: "add", kind: "text", slide: "t:3", text: 123 },
    field: "text",
    fault: "form",
    form: "A non-empty string.",
  },
]

describe("each refused edit names its own path", () => {
  it("keeps the field, the fault and the accepted form", () => {
    for (const row of readRows) {
      expect(readAgentChange(row.raw), JSON.stringify(row.raw)).toMatchObject({
        refused: "shape",
        field: row.field,
        fault: row.fault,
        form: row.form,
      })
    }
  })

  it("states a layer-kind condition as needs, and leaves a form off an unknown field", () => {
    const set = (target: string, look: Record<string, unknown>) => ({ op: "set", target, ...look }) as AgentChange
    const needs = (change: AgentChange, field: string, condition: string) => {
      const refused = compileAgentChange(richDeck(), change, minter())
      expect(refused, field).toMatchObject({ refused: "shape", field, fault: "needs", needs: condition })
      expect(refused, field).not.toHaveProperty("form")
    }
    needs(set(ids.title, { icon: "star" }), "icon", "an icon")
    needs(set(ids.title, { arrow: true }), "arrow", "a line")
    needs(set(ids.title, { fit: "fill" }), "fit", "an image fill")
    needs(set(ids.title, { chart }), "chart", "a chart layer")
    needs(set(ids.card, { gap: 16 }), "gap", "a row or column layout")
    needs(
      { op: "add", kind: "frame", slide: ids.slide, rows: [["H"], ["a"]], layout: "row" },
      "layout",
      "rows to place the grid",
    )
    const text = compileAgentChange(richDeck(), set(ids.card, { text: "Hi" }), minter())
    expect(text).toMatchObject({ refused: "shape", field: "text", fault: "unknown" })
    expect(text).not.toHaveProperty("form")
    expect(text).not.toHaveProperty("needs")
  })
})
