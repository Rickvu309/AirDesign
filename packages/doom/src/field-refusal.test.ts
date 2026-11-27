import { describe, expect, it } from "vitest"
import { type AgentChange, readAgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { minter } from "./testing/agent-fixtures.js"
import { richDeck } from "./testing/rich-deck.js"
import { hex, ids, land } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

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

const kindForm = "One of text, shape, line, path, frame, picture, icon."
const colorForm = "A theme colour, lighter or darker by a percent, or #rrggbb."
const nodeForm = "1 to 16 of a-z or 0-9, a colon, then 1 to 12 digits."

const readRows: { readonly raw: unknown; readonly field: string; readonly fault: string; readonly form: string }[] = [
  {
    raw: { op: "slide", move: { after: null } },
    field: "move",
    fault: "form",
    form: "A slide id, or a slide group id.",
  },
  {
    raw: { op: "slide", move: { slide: "t:3" } },
    field: "move.after",
    fault: "missing",
    form: "A slide id, or null to put it first.",
  },
  {
    raw: { op: "slide", move: { group: "a:1" } },
    field: "move.after",
    fault: "missing",
    form: "Use before or after with a slide group id. Use after null to put it first.",
  },
  {
    raw: { op: "slide", add: { after: null } },
    field: "add.after",
    fault: "form",
    form: "A slide id. Name the group and after null to put it first.",
  },
  {
    raw: { op: "set", target: "t:3", fill: { gradient: [hex(0x112233), "notacolor"] } },
    field: "fill.gradient.1",
    fault: "form",
    form: colorForm,
  },
  {
    raw: { op: "set", target: "t:3", fill: { gradient: [hex(0x112233), hex(0x445566)], angle: "forty" } },
    field: "fill.angle",
    fault: "form",
    form: "A number from -1000000000 to 1000000000.",
  },
  {
    raw: { op: "set", target: "t:3", fill: { gradient: [hex(0x112233), hex(0x445566)], bogus: true } },
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
    raw: { op: "add", kind: "text", slide: "t:3", text: 123 },
    field: "text",
    fault: "form",
    form: "A non-empty string.",
  },
  {
    raw: { op: "set", target: "t:3", effectOpacity: 2 },
    field: "effectOpacity",
    fault: "form",
    form: "A number from 0 to 1.",
  },
  { raw: { op: "set", target: "t:3", clip: "yes" }, field: "clip", fault: "form", form: "true or false." },
  {
    raw: { op: "set", target: "t:3", link: "not a link" },
    field: "link",
    fault: "form",
    form: "https, mailto, a slide id, or none.",
  },
  {
    raw: { op: "set", target: "t:3", insert: { text: "a", link: "https://example.com" } },
    field: "insert.at",
    fault: "missing",
    form: "A whole number from 0 to 8000.",
  },
  {
    raw: { op: "set", target: "t:3", insert: { at: 0, text: "a\nb", link: "https://example.com" } },
    field: "insert.text",
    fault: "form",
    form: "One line.",
  },
  {
    raw: { op: "set", target: "t:3", insert: { at: 0, text: "a", link: "not a link" } },
    field: "insert.link",
    fault: "form",
    form: "An https or mailto address, or a slide id.",
  },
  {
    raw: { op: "set", target: "t:3", crop: { left: 50, right: 50 } },
    field: "crop",
    fault: "form",
    form: "Percents cut from left, top, right and bottom, each from 0 to 99, leaving some of the picture.",
  },
  {
    raw: { op: "set", target: "t:3", crop: { left: 100 } },
    field: "crop.left",
    fault: "form",
    form: "A number from 0 to 99.",
  },
  {
    raw: { op: "set", target: "t:3", arrow: "big" },
    field: "arrow",
    fault: "form",
    form: "true, false, or one of none, arrow, triangle, circle.",
  },
  {
    raw: { op: "set", target: "t:3", startArrow: "big" },
    field: "startArrow",
    fault: "form",
    form: "One of none, arrow, triangle, circle.",
  },
  {
    raw: { op: "set", target: "t:3", crop: { sideways: 4 } },
    field: "crop.sideways",
    fault: "unknown",
    form: "One of left, top, right, bottom.",
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
      const refused = compileAgentChange(richDeck(), change, minter(), placement, starts)
      expect(refused, field).toMatchObject({ refused: "shape", field, fault: "needs", needs: condition })
      expect(refused, field).not.toHaveProperty("form")
    }
    needs(set(ids.title, { icon: "star" }), "icon", "an icon")
    needs(set(ids.title, { arrow: true }), "arrow", "a line")
    needs(set(ids.title, { startArrow: "arrow" }), "startArrow", "a line")
    needs(set(ids.title, { fit: "fill" }), "fit", "an image fill")
    needs(set(ids.card, { crop: { left: 10 } }), "crop", "an image fill")
    needs(set(ids.card, { gap: 16 }), "gap", "a row or column layout")
    needs(
      { op: "add", kind: "frame", slide: ids.slide, rows: [["H"], ["a"]], layout: "row" },
      "layout",
      "rows to place the grid",
    )
    const linked = { at: 0, text: "a", link: "https://example.com" }
    needs(set(ids.caption, { link: "https://example.com" }), "link", "a text layer")
    needs({ op: "add", kind: "shape", slide: ids.slide, link: "https://example.com" }, "link", "a text layer")
    needs(set(ids.caption, { insert: linked }), "insert", "a text layer")
    needs(set("*.title", { insert: linked }), "insert", "a text layer")
    const pictured = land(richDeck(), [
      { node: ids.title, prop: "fills", value: [{ kind: "image", asset: "a".repeat(64), fit: "tile" }] },
    ])
    const fought = compileAgentChange(
      pictured,
      set(ids.title, { fit: "tile", crop: { left: 10 } }),
      minter(),
      placement,
      starts,
    )
    expect(fought).toMatchObject({ refused: "shape", field: "crop", fault: "form", form: "fit crop, or no fit." })
    expect(fought).not.toHaveProperty("needs")
    const both = compileAgentChange(
      richDeck(),
      set(ids.title, { text: "A", insert: linked }),
      minter(),
      placement,
      starts,
    )
    expect(both).toMatchObject({
      refused: "shape",
      field: "insert",
      fault: "form",
      form: "Insert or text, not both.",
    })
    expect(both).not.toHaveProperty("needs")
    const text = compileAgentChange(richDeck(), set(ids.card, { text: "Hi" }), minter(), placement, starts)
    expect(text).toMatchObject({ refused: "shape", field: "text", fault: "unknown" })
    expect(text).not.toHaveProperty("form")
    expect(text).not.toHaveProperty("needs")
    const clip = compileAgentChange(richDeck(), set(ids.title, { clip: true }), minter(), placement, starts)
    expect(clip).toMatchObject({ refused: "shape", field: "clip", fault: "unknown" })
    expect(clip).not.toHaveProperty("form")
    const strength = compileAgentChange(richDeck(), set(ids.slide, { effectOpacity: 0.4 }), minter(), placement, starts)
    expect(strength).toMatchObject({ refused: "shape", field: "effectOpacity", fault: "unknown" })
    expect(strength).not.toHaveProperty("form")
  })
})
