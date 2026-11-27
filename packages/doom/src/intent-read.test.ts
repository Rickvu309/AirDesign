import { describe, expect, it } from "vitest"
import { limits } from "./limits.js"
import { hex } from "./sample-deck.js"
import { intentsSchema, readIntent, type Intent } from "./intent-read.js"
import { testTheme } from "./testing/theme.js"

const json = (value: unknown) => JSON.parse(JSON.stringify(value))

const valid: readonly Intent[] = [
  {
    op: "add",
    kind: "text",
    slide: "t:3" as never,
    text: "**Hello**",
    textStyle: "title",
    box: { x: 0, y: 0, w: 900, h: 90 },
  },
  { op: "add", kind: "frame", slide: "t:3" as never, rows: [["Revenue", "$4.2M"]] },
  {
    op: "add",
    kind: "frame",
    slide: "t:3" as never,
    rows: [
      ["Q1", "Q2"],
      ["a", "b"],
    ],
    fill: { image: "https://x.test/a.png" },
  },
  { op: "set", target: "t:3.title", text: "x", fill: "none", stroke: hex(0xaabbcc), effect: "lifted" },
  { op: "set", target: "t:6", insert: { at: 2, text: "linked", link: "https://example.com" } },
  { op: "set", target: "t:6", d: "M0 0L1 1" },
  { op: "move", node: "t:4" as never, into: "t:5" as never, after: null },
  {
    op: "move",
    nodes: ["t:4" as never, "t:5" as never],
    into: "t:10" as never,
    box: { x: 40, y: 60, w: 200, h: 100 },
  },
  { op: "wrap", nodes: ["t:4" as never], layout: "row" },
  { op: "unwrap", node: "t:4" as never },
  { op: "delete", nodes: ["t:4" as never] },
  { op: "slide", add: { after: "t:3" as never } },
  { op: "slide", move: { slide: "t:3" as never, after: null } },
  { op: "slide", delete: "t:3" as never },
  { op: "deck", theme: testTheme },
]

describe("readIntent", () => {
  it("reads each op as the agent wrote it through JSON", () => {
    for (const change of valid) {
      const read = readIntent(json(change))
      expect(read).not.toHaveProperty("refused")
      expect(read).toMatchObject(json(change))
    }
  })

  it("accepts path data up to 4000 characters and names the limit above it", () => {
    const d = "M0 0L1 1".padEnd(4000)
    const change = { op: "set", target: "t:3", d }
    expect(readIntent(change)).toEqual(change)
    expect(readIntent({ ...change, d: d + "Z" })).toMatchObject({
      refused: expect.any(String),
      field: "d",
      expect: { code: "path-length", max: 4_000 },
    })
  })

  it("reads a hex colour in lower case, however the agent wrote it", () => {
    expect(readIntent({ op: "set", target: "t:3", stroke: hex(0xaabbcc).toUpperCase() })).toMatchObject({
      stroke: hex(0xaabbcc),
    })
  })

  it("refuses a key the op does not take, a missing key and a wrong value", () => {
    const refused = (raw: unknown) => expect(readIntent(raw)).toMatchObject({ refused: "shape" })
    refused({ op: "move", node: "t:4", text: "x" })
    refused({ op: "delete" })
    refused({ op: "add", kind: "text" })
    refused({ op: "add", kind: "table", slide: "t:3" })
    refused({ op: "set", target: "t:3", fill: "12" })
    refused({ op: "set", target: "t:3", fill: "accent9" })
    refused({ op: "set", target: "t:3", opacity: 2 })
    refused({ op: "set", target: "nope", text: "x" })
    refused({ op: "set", target: "t:3", textStyle: "huge" })
    refused({ op: "set", target: "t:3", layout: "grid" })
    refused({ op: "slide", add: { layout: "Blank" } })
    refused({ op: "paint" })
    expect(readIntent({ op: "detach", target: "t:3" })).toMatchObject({ refused: "shape", field: "op" })
    for (const field of ["component", "spec", "data", "variant", "tokens", "focus"]) {
      expect(readIntent({ op: "set", target: "t:3", [field]: {} })).toMatchObject({
        refused: "shape",
        field,
        fault: "unknown",
      })
    }
    refused({ op: "set", target: "t:3", chart: {} })
    refused({ op: "set", target: "t:3#Plan:Q1", fill: "accent1" })
    refused("add")
    refused(null)
    refused({
      op: "add",
      kind: "chart",
      slide: "t:3",
      chart: { kind: "bar", categories: ["a"], series: [{ name: "s", values: [1, 2] }] },
    })
  })

  it("refuses an arrowhead it does not know, and names the field", () => {
    expect(readIntent({ op: "set", target: "t:3", startArrow: "stealth" })).toMatchObject({
      refused: "shape",
      field: "startArrow",
    })
    expect(readIntent({ op: "set", target: "t:3", arrow: "stealth" })).toMatchObject({
      refused: "shape",
      field: "arrow",
    })
    expect(readIntent({ op: "set", target: "t:3", startArrow: "circle", arrow: "triangle" })).toMatchObject({
      startArrow: "circle",
      arrow: "triangle",
    })
  })

  it("answers limit for a text that is too long", () => {
    expect(readIntent({ op: "set", target: "t:3", text: "x".repeat(limits.valueBytes + 1) })).toMatchObject({
      refused: "limit",
    })
  })
})

type Schema = {
  readonly properties?: Record<string, Schema>
  readonly enum?: readonly string[]
  readonly [key: string]: unknown
}
const change = (intentsSchema.$defs.change as unknown as Schema).properties as Record<string, Schema>

describe("the advertised schema", () => {
  it("names the fields of the surface, and the reader takes every one of them", () => {
    const named = [
      "op",
      "kind",
      "slide",
      "into",
      "target",
      "node",
      "nodes",
      "after",
      "add",
      "move",
      "delete",
      "fill",
      "fillStroke",
      "stroke",
      "strokeWidth",
      "color",
      "radius",
      "effect",
      "effectOpacity",
      "link",
      "clip",
      "mask",
      "opacity",
      "text",
      "insert",
      "textStyle",
      "language",
      "align",
      "layout",
      "gap",
      "padding",
      "icon",
      "arrow",
      "startArrow",
      "from",
      "to",
      "route",
      "lane",
      "rows",
      "box",
      "name",
      "hidden",
      "locked",
      "size",
      "font",
      "weight",
      "lineHeight",
      "letterSpacing",
      "case",
      "underline",
      "strike",
      "d",
      "dash",
      "fit",
      "crop",
      "shape",
      "rotation",
      "flip",
      "notes",
      "skipped",
      "transition",
      "alignV",
      "spaceBefore",
      "spaceAfter",
      "blur",
      "innerShadow",
      "theme",
      "colors",
      "fonts",
      "nameFollows",
    ]
    expect(Object.keys(change).sort()).toEqual([...named].sort())
    const used = new Set(valid.flatMap((each) => Object.keys(each)))
    for (const key of used) expect(named).toContain(key)
  })

  it("lists as enum exactly the values the reader accepts", () => {
    for (const [key, schema] of Object.entries(change)) {
      if (schema.enum === undefined || key === "op") continue
      const changeWith = (value: string) => {
        if (key === "kind") return { op: "add", kind: value, slide: "t:3" }
        return { op: "set", target: "t:3", [key]: value }
      }
      for (const value of schema.enum) expect(readIntent(changeWith(value))).not.toHaveProperty("refused")
      expect(readIntent(changeWith("nope"))).toMatchObject({ refused: "shape" })
    }
  })

  it("advertises the change operations", () => {
    expect(change.op?.enum).toEqual(["add", "set", "move", "wrap", "unwrap", "delete", "slide", "duplicate", "deck"])
  })
})
