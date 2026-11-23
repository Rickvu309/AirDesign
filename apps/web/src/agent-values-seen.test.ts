import { describe, expect, it } from "vitest"
import { agentFields, agentOps, reach, sample } from "@/testing/agent-reach"

const entries = Object.entries(reach)

type Seen =
  | { readonly person: readonly string[] }
  | { readonly address: string }
  | { readonly owedToPerson: string; readonly partly?: readonly string[] }

const seen: Readonly<Record<string, Seen>> = {
  op: { person: ["gesture:tool-text", "gesture:delete", "gesture:group", "gesture:ungroup", "gesture:forward"] },
  kind: { person: ["gesture:tool-text", "gesture:tool-rectangle", "gesture:tool-line", "gesture:tool-frame"] },
  slide: { address: "the slide to add to" },
  into: { address: "the frame to add into" },
  target: { address: "the layer, role or chart bar a set changes" },
  node: { address: "the layer moved or unwrapped" },
  nodes: { address: "the layers wrapped, deleted or duplicated" },
  after: { address: "the place among siblings" },
  add: { person: ["gesture:slide-add"] },
  move: { person: ["gesture:slide-up", "gesture:slide-down"] },
  delete: { person: ["gesture:slide-delete"] },
  fill: { person: ["panel:fills.paint", "panel:image.source", "panel:slide-background"] },
  stroke: { person: ["panel:border.color", "panel:image.color"] },
  strokeWidth: { person: ["panel:border.width", "panel:image.weight"] },
  color: { person: ["panel:textFill.value", "panel:text.fill"] },
  radius: { person: ["panel:corners.corners"] },
  effect: { person: ["panel:shadow.shadow"] },
  opacity: { person: ["panel:opacity.opacity"] },
  text: {
    owedToPerson: "a link on some words: not underlined, and no place to read or change its address",
    partly: ["gesture:edit-text"],
  },
  textStyle: { person: ["panel:text.style"] },
  align: {
    owedToPerson: "where a row or column frame places its children: no auto layout controls",
    partly: ["panel:text.align"],
  },
  layout: {
    owedToPerson: "row, column and grid: the panel only removes auto layout",
    partly: ["panel:remove-auto-layout"],
  },
  gap: { owedToPerson: "the space between a frame's children: no auto layout controls" },
  padding: { owedToPerson: "the space inside a frame: no auto layout controls" },
  icon: { owedToPerson: "which icon a layer draws: the icon picker writes nothing", partly: ["actions:icon"] },
  arrow: {
    owedToPerson: "an arrowhead on a line already drawn: lines have no end controls",
    partly: ["gesture:tool-arrow"],
  },
  chart: {
    owedToPerson: "a series colour and a single bar's colour: the chart editor shows names and values only",
    partly: ["panel:chart-data"],
  },
  rows: { owedToPerson: "a grid frame's rows and columns: no grid controls", partly: ["gesture:edit-text"] },
  items: { person: ["gesture:edit-text", "gesture:move"] },
  axes: { person: ["gesture:edit-text"] },
  from: { person: ["gesture:line-end"] },
  to: { person: ["gesture:line-end"] },
  route: { person: ["panel:border.route"] },
  box: { person: ["gesture:move", "gesture:resize", "panel:box.align"] },
  name: { owedToPerson: "a layer's name: no layers panel" },
  hidden: { owedToPerson: "a hidden layer cannot be seen or shown again: no layers panel", partly: ["gesture:hide"] },
  size: { person: ["panel:text.size"] },
  font: { person: ["panel:text.font"] },
  lineHeight: { person: ["panel:text.lineHeight"] },
  letterSpacing: { person: ["panel:text.letterSpacing"] },
  case: { person: ["panel:text.case"] },
  underline: { person: ["panel:text.underline"] },
  strike: { person: ["panel:text.strike"] },
  dash: { person: ["panel:border.border"] },
  fit: { person: ["panel:image.mode"] },
  shape: { person: ["panel:geometry.preset", "gesture:tool-ellipse"] },
  rotation: { person: ["gesture:rotate"] },
  flip: { person: ["gesture:flip-horizontal", "gesture:flip-vertical"] },
  notes: { person: ["notes:slide-notes"] },
  colors: { person: ["panel:theme-colors"] },
  fonts: { person: ["panel:theme-fonts"] },
  nameFollows: { person: ["strip:deck-name"] },
}

const owedToPerson = ["text", "align", "layout", "gap", "padding", "icon", "arrow", "chart", "rows", "name", "hidden"]

const structural = new Set([
  "op",
  "kind",
  "add",
  "move",
  "delete",
  "rows",
  "items",
  "axes",
  "colors",
  "fonts",
  "nameFollows",
])

describe("every value an agent sets names where a person sees it and changes it", () => {
  it("names every field of the agent's schema, and every op a person has", () => {
    expect([...agentFields].filter((field) => seen[field] === undefined)).toEqual([])
    expect(
      [...agentOps].filter(
        (op) =>
          !["set", "add", "slide"].includes(op) &&
          !entries.some(([, entry]) => "agent" in entry && entry.agent === `op.${op}`),
      ),
    ).toEqual([])
  })

  it("names only person capabilities the reach table lists", () => {
    const named = Object.values(seen).flatMap((entry) =>
      "person" in entry ? entry.person : "owedToPerson" in entry ? (entry.partly ?? []) : [],
    )
    expect(named.filter((key) => reach[key] === undefined)).toEqual([])
  })

  it("probes every value field on a layer", () => {
    const valued = [...agentFields].filter((field) => !("address" in (seen[field] ?? { address: "" })))
    expect(valued.filter((field) => !structural.has(field) && sample[field] === undefined)).toEqual([])
  })

  it("lists the agent values a person cannot yet see or change, and no others", () => {
    expect(Object.entries(seen).flatMap(([field, entry]) => ("owedToPerson" in entry ? [field] : []))).toEqual(
      owedToPerson,
    )
  })
})
