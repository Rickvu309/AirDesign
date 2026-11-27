import type { Expectation } from "./refusal.js"
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

describe("a field refusal names the path, fault and expected value", () => {
  it("refuses the empty hidden caption from the audit as the wrong form of text", () => {
    expect(readAgentChange(hiddenCaption)).toMatchObject({
      refused: "shape",
      field: "text",
      fault: "form",
      expect: { code: "nonempty-string" },
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
      expect: { code: "number-range", min: 0, max: 1 },
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

const readRows: {
  readonly raw: unknown
  readonly field: string
  readonly fault: string
  readonly expect: Expectation
}[] = [
  {
    raw: { op: "slide", move: { after: null } },
    field: "move",
    fault: "form",
    expect: { code: "slide-or-group" },
  },
  {
    raw: { op: "slide", move: { slide: "t:3" } },
    field: "move.after",
    fault: "missing",
    expect: { code: "after-slide" },
  },
  {
    raw: { op: "slide", move: { group: "a:1" } },
    field: "move.after",
    fault: "missing",
    expect: { code: "before-or-after-group" },
  },
  {
    raw: { op: "slide", add: { after: null } },
    field: "add.after",
    fault: "form",
    expect: { code: "first-in-group" },
  },
  {
    raw: { op: "set", target: "t:3", fill: { gradient: [hex(0x112233), "notacolor"] } },
    field: "fill.gradient.1",
    fault: "form",
    expect: { code: "theme-color" },
  },
  {
    raw: { op: "set", target: "t:3", fill: { gradient: [hex(0x112233), hex(0x445566)], angle: "forty" } },
    field: "fill.angle",
    fault: "form",
    expect: { code: "number-range", min: -1000000000, max: 1000000000 },
  },
  {
    raw: { op: "set", target: "t:3", fill: { gradient: [hex(0x112233), hex(0x445566)], bogus: true } },
    field: "fill.bogus",
    fault: "unknown",
    expect: { code: "one-of", options: ["gradient", "angle", "radial"] },
  },
  {
    raw: { op: "set", target: "t:3", fill: { image: "" } },
    field: "fill.image",
    fault: "form",
    expect: { code: "nonempty-string" },
  },
  {
    raw: { op: "set", target: "t:3", from: { layer: ids.title, side: "diagonal" } },
    field: "from.side",
    fault: "form",
    expect: { code: "one-of", options: ["top", "right", "bottom", "left", "center"] },
  },
  { raw: { op: "deck", colors: { accent1: "blue" } }, field: "colors.accent1", fault: "form", expect: { code: "hex" } },
  {
    raw: { op: "deck", fonts: { heading: "!!!" } },
    field: "fonts.heading",
    fault: "form",
    expect: { code: "font-name" },
  },
  { raw: { op: "delete", nodes: [ids.title, "bad"] }, field: "nodes.1", fault: "form", expect: { code: "node-id" } },
  {
    raw: { op: "slide", move: { slide: "bad", after: null } },
    field: "move.slide",
    fault: "form",
    expect: { code: "node-id" },
  },
  {
    raw: { op: "add", slide: "t:3" },
    field: "kind",
    fault: "missing",
    expect: { code: "one-of", options: ["text", "shape", "line", "path", "frame", "picture", "icon"] },
  },
  { raw: { op: "add", kind: "text", slide: "bad" }, field: "slide", fault: "form", expect: { code: "node-id" } },
  {
    raw: { op: "set", target: "t:3", color: "purple" },
    field: "color",
    fault: "form",
    expect: { code: "theme-color" },
  },
  {
    raw: { op: "set", target: "t:3", stroke: "purple" },
    field: "stroke",
    fault: "form",
    expect: { code: "stroke" },
  },
  {
    raw: { op: "add", kind: "text", slide: "t:3", text: 123 },
    field: "text",
    fault: "form",
    expect: { code: "nonempty-string" },
  },
  {
    raw: { op: "set", target: "t:3", effectOpacity: 2 },
    field: "effectOpacity",
    fault: "form",
    expect: { code: "number-range", min: 0, max: 1 },
  },
  { raw: { op: "set", target: "t:3", clip: "yes" }, field: "clip", fault: "form", expect: { code: "boolean" } },
  {
    raw: { op: "set", target: "t:3", link: "not a link" },
    field: "link",
    fault: "form",
    expect: { code: "link-or-none" },
  },
  {
    raw: { op: "set", target: "t:3", insert: { text: "a", link: "https://example.com" } },
    field: "insert.at",
    fault: "missing",
    expect: { code: "integer-range", min: 0, max: 8000 },
  },
  {
    raw: { op: "set", target: "t:3", insert: { at: 0, text: "a\nb", link: "https://example.com" } },
    field: "insert.text",
    fault: "form",
    expect: { code: "single-line" },
  },
  {
    raw: { op: "set", target: "t:3", insert: { at: 0, text: "a", link: "not a link" } },
    field: "insert.link",
    fault: "form",
    expect: { code: "link" },
  },
  {
    raw: { op: "set", target: "t:3", crop: { left: 50, right: 50 } },
    field: "crop",
    fault: "form",
    expect: { code: "crop-sides" },
  },
  {
    raw: { op: "set", target: "t:3", crop: { left: 100 } },
    field: "crop.left",
    fault: "form",
    expect: { code: "number-range", min: 0, max: 99 },
  },
  {
    raw: { op: "set", target: "t:3", arrow: "big" },
    field: "arrow",
    fault: "form",
    expect: { code: "end-arrow" },
  },
  {
    raw: { op: "set", target: "t:3", startArrow: "big" },
    field: "startArrow",
    fault: "form",
    expect: { code: "one-of", options: ["none", "arrow", "triangle", "circle"] },
  },
  {
    raw: { op: "set", target: "t:3", crop: { sideways: 4 } },
    field: "crop.sideways",
    fault: "unknown",
    expect: { code: "one-of", options: ["left", "top", "right", "bottom"] },
  },
]

describe("each refused edit names its own path", () => {
  it("keeps the field, fault and expectation code", () => {
    for (const row of readRows) {
      expect(readAgentChange(row.raw), JSON.stringify(row.raw)).toMatchObject({
        refused: "shape",
        field: row.field,
        fault: row.fault,
        expect: row.expect,
      })
    }
  })

  it("states a layer-kind condition as needs, and leaves a form off an unknown field", () => {
    const set = (target: string, look: Record<string, unknown>) => ({ op: "set", target, ...look }) as AgentChange
    const needs = (change: AgentChange, field: string, condition: Expectation) => {
      const refused = compileAgentChange(richDeck(), change, minter(), placement, starts)
      expect(refused, field).toMatchObject({ refused: "shape", field, fault: "needs", expect: condition })
    }
    needs(set(ids.title, { icon: "star" }), "icon", { code: "needs-icon" })
    needs(set(ids.title, { arrow: true }), "arrow", { code: "needs-line" })
    needs(set(ids.title, { startArrow: "arrow" }), "startArrow", { code: "needs-line" })
    needs(set(ids.title, { fit: "fill" }), "fit", { code: "needs-image" })
    needs(set(ids.card, { crop: { left: 10 } }), "crop", { code: "needs-image" })
    needs(set(ids.card, { gap: 16 }), "gap", { code: "needs-layout" })
    needs({ op: "add", kind: "frame", slide: ids.slide, rows: [["H"], ["a"]], layout: "row" }, "layout", {
      code: "needs-rows",
    })
    const linked = { at: 0, text: "a", link: "https://example.com" }
    needs(set(ids.caption, { link: "https://example.com" }), "link", { code: "needs-text" })
    needs({ op: "add", kind: "shape", slide: ids.slide, link: "https://example.com" }, "link", { code: "needs-text" })
    needs(set(ids.caption, { insert: linked }), "insert", { code: "needs-text" })
    needs(set("*.title", { insert: linked }), "insert", { code: "needs-text" })
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
    expect(fought).toMatchObject({ refused: "shape", field: "crop", fault: "form", expect: { code: "crop-fit" } })
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
      expect: { code: "insert-or-text" },
    })
    const text = compileAgentChange(richDeck(), set(ids.card, { text: "Hi" }), minter(), placement, starts)
    expect(text).toMatchObject({ refused: "shape", field: "text", fault: "unknown" })
    expect(text).not.toHaveProperty("expect")
    const clip = compileAgentChange(richDeck(), set(ids.title, { clip: true }), minter(), placement, starts)
    expect(clip).toMatchObject({ refused: "shape", field: "clip", fault: "unknown" })
    expect(clip).not.toHaveProperty("expect")
    const strength = compileAgentChange(richDeck(), set(ids.slide, { effectOpacity: 0.4 }), minter(), placement, starts)
    expect(strength).toMatchObject({ refused: "shape", field: "effectOpacity", fault: "unknown" })
    expect(strength).not.toHaveProperty("expect")
  })
})
