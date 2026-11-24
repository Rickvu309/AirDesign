import { describe, expect, it } from "vitest"
import { agentFields, agentOps, reach, sample } from "@/testing/agent-reach"

const entries = Object.entries(reach)

type Seen =
  | { readonly person: readonly string[] }
  | { readonly address: string }
  | { readonly owedToPerson: string; readonly partly?: readonly string[] }
  | { readonly declined: string; readonly partly?: readonly string[] }

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
  fill: { person: ["panel:fills.paint", "panel:slide-background"] },
  stroke: { person: ["panel:border.color", "panel:image.color"] },
  strokeWidth: { declined: "Layer styling belongs to the deck design and its agent." },
  color: { person: ["panel:textFill.value", "panel:text.fill"] },
  radius: { declined: "Layer styling belongs to the deck design and its agent." },
  effect: { declined: "Layer styling belongs to the deck design and its agent." },
  effectOpacity: { declined: "Layer styling belongs to the deck design and its agent." },
  opacity: { declined: "Layer styling belongs to the deck design and its agent." },
  text: { person: ["gesture:edit-text", "panel:link.target#words"] },
  insert: { person: ["gesture:edit-text"] },
  textStyle: { person: ["panel:text.style"] },
  align: {
    declined: "One simple panel. Agents still set auto layout.",
    partly: ["panel:text.align"],
  },
  layout: {
    declined: "One simple panel. Agents still set auto layout.",
    partly: ["panel:remove-auto-layout"],
  },
  gap: { declined: "One simple panel. Agents still set auto layout." },
  padding: { declined: "One simple panel. Agents still set auto layout." },
  icon: { person: ["actions:icon#swap"] },
  arrow: { person: ["gesture:tool-arrow", "panel:border.end"] },
  startArrow: { person: ["panel:border.start"] },
  chart: {
    declined: "One simple panel. Chart colours and the axis unit come from the theme, and an agent sets them.",
    partly: ["panel:chart-data"],
  },
  rows: {
    declined: "One simple panel. Agents still set auto layout.",
    partly: ["gesture:edit-text"],
  },
  items: { person: ["gesture:edit-text", "gesture:move"] },
  axes: { person: ["gesture:edit-text"] },
  from: { person: ["gesture:line-end"] },
  to: { person: ["gesture:line-end"] },
  route: { person: ["panel:border.route"] },
  box: { person: ["gesture:move", "gesture:resize", "panel:box.align"] },
  name: { person: ["panel:name"] },
  hidden: { person: ["gesture:hide", "panel:show-hidden"] },
  locked: { person: ["gesture:lock"] },
  size: { person: ["panel:text.size"] },
  font: { person: ["panel:text.font"] },
  weight: { person: ["panel:text.weight"] },
  lineHeight: { declined: "Layer styling belongs to the deck design and its agent." },
  letterSpacing: { declined: "Layer styling belongs to the deck design and its agent." },
  case: { declined: "Layer styling belongs to the deck design and its agent." },
  underline: { person: ["panel:text.underline"] },
  strike: { person: ["panel:text.strike"] },
  link: { person: ["panel:link.target"] },
  clip: { person: ["gesture:frame", "gesture:tool-frame"] },
  mask: { person: ["menu:use-as-mask"] },
  dash: { person: ["panel:border.border"] },
  fit: { declined: "Tile is an agent styling choice.", partly: ["panel:image.mode"] },
  crop: { person: ["gesture:crop-drag"] },
  shape: { person: ["panel:geometry.preset", "gesture:tool-ellipse"] },
  rotation: { person: ["gesture:rotate"] },
  flip: { person: ["gesture:flip-horizontal", "gesture:flip-vertical"] },
  notes: { person: ["notes:slide-notes"] },
  skipped: { person: ["menu:skip-slide"] },
  transition: { declined: "One simple panel. Ask the agent how a slide arrives." },
  alignV: { person: ["panel:text.alignV"] },
  spaceBefore: { declined: "One simple panel. Ask the agent for space between paragraphs." },
  spaceAfter: { declined: "One simple panel. Ask the agent for space between paragraphs." },
  blur: { owedToPerson: "a layer blur: its appearance belongs to the deck design" },
  innerShadow: { owedToPerson: "an inner shadow: its appearance belongs to the deck design" },
  colors: { person: ["panel:theme-colors"] },
  fonts: { person: ["panel:theme-fonts"] },
  nameFollows: { person: ["strip:deck-name"] },
}

const owedToPerson = [
  "align",
  "layout",
  "gap",
  "padding",
  "chart",
  "rows",
  "transition",
  "spaceBefore",
  "spaceAfter",
  "blur",
  "innerShadow",
]

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
      "person" in entry ? entry.person : "owedToPerson" in entry || "declined" in entry ? (entry.partly ?? []) : [],
    )
    expect(named.filter((key) => reach[key] === undefined)).toEqual([])
  })

  it("probes every value field on a layer", () => {
    const valued = [...agentFields].filter((field) => !("address" in (seen[field] ?? { address: "" })))
    expect(valued.filter((field) => !structural.has(field) && sample[field] === undefined)).toEqual([])
  })

  it("lists the agent values a person cannot yet see or change, and no others", () => {
    expect(Object.entries(seen).flatMap(([field, entry]) => ("owedToPerson" in entry ? [field] : []))).toEqual(
      owedToPerson.filter((field) => {
        const entry = seen[field]
        return entry === undefined || !("declined" in entry)
      }),
    )
  })

  it("declines auto layout controls and reads each reason", () => {
    const reason = "One simple panel. Agents still set auto layout."
    expect(seen.align).toEqual({ declined: reason, partly: ["panel:text.align"] })
    expect(seen.layout).toEqual({ declined: reason, partly: ["panel:remove-auto-layout"] })
    expect(seen.gap).toEqual({ declined: reason })
    expect(seen.padding).toEqual({ declined: reason })
    expect(seen.rows).toEqual({ declined: reason, partly: ["gesture:edit-text"] })
    for (const field of ["align", "layout", "gap", "padding", "rows"]) expect(owedToPerson).toContain(field)
  })

  it("leaves a slide's transition and paragraph spacing to the agent, with the reason", () => {
    for (const field of ["transition", "spaceBefore", "spaceAfter"]) {
      expect(seen[field]).toMatchObject({ declined: expect.stringContaining("One simple panel.") })
      expect(owedToPerson).toContain(field)
    }
  })

  it("lets a person rename a layer from the design panel", () => {
    expect(seen.name).toEqual({ person: ["panel:name"] })
  })

  it("lets a person set both arrowheads, and drawing an arrow still sets the end", () => {
    expect(seen.arrow).toEqual({ person: ["gesture:tool-arrow", "panel:border.end"] })
    expect(seen.startArrow).toEqual({ person: ["panel:border.start"] })
  })
})
