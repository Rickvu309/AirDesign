import { linkedComponentsEnabled } from "./component-rollout.js"
import { describe, expect, it } from "vitest"
import { bytesOf, limits } from "./limits.js"
import { hex } from "./sample-deck.js"
import { agentChangesSchema, readAgentChange, readAgentChanges, type AgentChange } from "./agent-change.js"

const json = (value: unknown) => JSON.parse(JSON.stringify(value))

const valid: readonly AgentChange[] = [
  {
    op: "add",
    kind: "text",
    slide: "t:3" as never,
    text: "**Hello**",
    textStyle: "title",
    box: { x: 0, y: 0, w: 900, h: 90 },
  },
  { op: "add", kind: "kpi", slide: "t:3" as never, items: [{ title: "Revenue", value: "$4.2M", note: "+12%" }] },
  {
    op: "add",
    kind: "chart",
    slide: "t:3" as never,
    chart: { kind: "bar", categories: ["Q1"], series: [{ name: "Plan", values: [3], color: "accent2" }] },
  },
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
  { op: "set", target: "t:9#Plan:Q1", fill: "accent3" },
  { op: "move", node: "t:4" as never, into: "t:5" as never, after: null },
  { op: "wrap", nodes: ["t:4" as never], layout: "row" },
  { op: "unwrap", node: "t:4" as never },
  { op: "delete", nodes: ["t:4" as never] },
  { op: "slide", add: { after: "t:3" as never } },
  { op: "slide", move: { slide: "t:3" as never, after: null } },
  { op: "slide", delete: "t:3" as never },
  { op: "deck", theme: "neutral" },
]

describe("readAgentChange", () => {
  it("reads each op as the agent wrote it through JSON", () => {
    for (const change of valid) {
      const read = readAgentChange(json(change))
      expect(read).not.toHaveProperty("refused")
      expect(read).toMatchObject(json(change))
    }
  })

  it("accepts path data up to 4000 characters and names the limit above it", () => {
    const d = "M0 0L1 1".padEnd(4000)
    const change = { op: "set", target: "t:3", d }
    expect(readAgentChange(change)).toEqual(change)
    expect(readAgentChange({ ...change, d: d + "Z" })).toMatchObject({
      refused: expect.any(String),
      field: "d",
      form: expect.stringContaining("4000"),
    })
  })

  it("reads a hex colour in lower case, however the agent wrote it", () => {
    expect(readAgentChange({ op: "set", target: "t:3", stroke: hex(0xaabbcc).toUpperCase() })).toMatchObject({
      stroke: hex(0xaabbcc),
    })
  })

  it("refuses a key the op does not take, a missing key and a wrong value", () => {
    const refused = (raw: unknown) => expect(readAgentChange(raw)).toMatchObject({ refused: "shape" })
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
    expect(readAgentChange({ op: "set", target: "t:3", startArrow: "stealth" })).toMatchObject({
      refused: "shape",
      field: "startArrow",
    })
    expect(readAgentChange({ op: "set", target: "t:3", arrow: "stealth" })).toMatchObject({
      refused: "shape",
      field: "arrow",
    })
    expect(readAgentChange({ op: "set", target: "t:3", startArrow: "circle", arrow: "triangle" })).toMatchObject({
      startArrow: "circle",
      arrow: "triangle",
    })
  })

  it("answers limit for a text that is too long", () => {
    expect(readAgentChange({ op: "set", target: "t:3", text: "x".repeat(limits.valueBytes + 1) })).toMatchObject({
      refused: "limit",
    })
  })
})

describe("readAgentChanges", () => {
  it("reads a batch and refuses an empty, an oversize or a bad one", () => {
    expect(readAgentChanges(json(valid))).toHaveLength(valid.length)
    expect(readAgentChanges([])).toMatchObject({ refused: "shape" })
    expect(readAgentChanges("x")).toMatchObject({ refused: "shape" })
    expect(readAgentChanges(Array.from({ length: limits.batch + 1 }, () => valid[0]))).toMatchObject({
      refused: "limit",
    })
    expect(readAgentChanges([valid[0], { op: "nope" }])).toMatchObject({ refused: "shape" })
  })
})

type Schema = {
  readonly properties?: Record<string, Schema>
  readonly enum?: readonly string[]
  readonly [key: string]: unknown
}
const change = (agentChangesSchema.$defs.change as unknown as Schema).properties as Record<string, Schema>

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
      "chart",
      "rows",
      "items",
      "axes",
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
      ...(linkedComponentsEnabled ? ["component", "data", "variant", "tokens"] : []),
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
        if (key === "theme") return { op: "deck", theme: value }
        return { op: "set", target: "t:3", [key]: value }
      }
      for (const value of schema.enum) expect(readAgentChange(changeWith(value))).not.toHaveProperty("refused")
      expect(readAgentChange(changeWith("nope"))).toMatchObject({ refused: "shape" })
    }
  })

  it("advertises detach only during the linked template rollout", () => {
    expect(change.op?.enum).toEqual([
      "add",
      "set",
      "move",
      "wrap",
      "unwrap",
      "delete",
      "slide",
      "duplicate",
      "deck",
      ...(linkedComponentsEnabled ? ["detach"] : []),
    ])
  })

  it("fits the budget for the one tool that carries it", () => {
    const tokens = Math.ceil(bytesOf(JSON.stringify(agentChangesSchema)) / 4)
    expect(tokens).toBeLessThan(4_500)
  })
})
