import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { readAgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { agentDeck, build, minter, started } from "./agent-fixtures.js"
import { readForAgent } from "./agent-read.js"
import { get } from "./doom-walk.js"
import type { Doom } from "./doom.js"
import { hex, ids, land, sampleDeck } from "./sample-deck.js"

const ink = hex(0x102030)

const set = (target: string, look: Record<string, unknown>): AgentChange =>
  ({ op: "set", target, ...look }) as AgentChange
const at = (doom: Doom, id: string) => doom.nodes.get(id as never)!
const photo = (fit: "fill" | "fit" | "tile" = "fill") => [{ kind: "image" as const, asset: "a".repeat(64), fit }]

describe("paint an agent sets the way the panel's colour, fill, picture and border controls do", () => {
  it("writes a theme colour lighter or darker by a percent, and reads it back the same way", () => {
    const doom = build(agentDeck(), set(ids.title, { color: "accent1+40", stroke: "text-25" }))
    expect(get(at(doom, ids.title), "text")!.spans).toEqual([{ end: 7, color: { var: "accent1", tint: 0.4 } }])
    expect(get(at(doom, ids.title), "strokes")).toEqual([{ kind: "solid", color: { var: "text", tint: -0.25 } }])
    expect(readForAgent(doom, [ids.slide])).toContain("stroke=text-25")
    expect(readForAgent(doom, [ids.slide])).toContain("color=accent1+40")
  })

  it("writes a linear or radial gradient through its colours, evenly spaced, and reads it back", () => {
    let doom = build(agentDeck(), set(ids.card, { fill: { gradient: ["accent1", "accent2+40", ink], angle: 90 } }))
    expect(get(at(doom, ids.card), "fills")).toEqual([
      {
        kind: "gradient",
        shape: "linear",
        angle: 90,
        stops: [
          { at: 0, color: { var: "accent1" } },
          { at: 0.5, color: { var: "accent2", tint: 0.4 } },
          { at: 1, color: ink },
        ],
      },
    ])
    expect(readForAgent(doom, [ids.slide])).toContain(`fill=gradient(accent1>accent2+40>${ink}@90)`)
    doom = build(doom, set(ids.card, { fill: { gradient: ["accent1", "background"], radial: true } }))
    expect(get(at(doom, ids.card), "fills")).toMatchObject([{ kind: "gradient", shape: "radial", angle: 0 }])
    expect(readForAgent(doom, [ids.slide])).toContain("fill=radial(accent1>background)")
  })

  it("sets how a picture sits in its layer, and refuses fit on a layer with no picture", () => {
    const pictured = started(land(sampleDeck(), [{ node: ids.title, prop: "fills", value: photo() }]))
    const doom = build(pictured, set(ids.title, { fit: "tile" }))
    expect(get(at(doom, ids.title), "fills")).toEqual(photo("tile"))
    expect(readForAgent(doom, [ids.slide])).toContain(`fill=image:${"a".repeat(64)}/tile`)
    expect(compileAgentChange(agentDeck(), set(ids.card, { fit: "fit" }), minter())).toMatchObject({
      refused: "shape",
      field: "fit",
    })
  })

  it("sets an outline's dash, drawing a thin outline when there was none", () => {
    const doom = build(agentDeck(), set(ids.card, { stroke: "accent1", dash: "dot" }))
    expect(get(at(doom, ids.card), "stroke")).toMatchObject({ dash: "dot", weight: 2 })
    expect(readForAgent(doom, [ids.slide])).toContain("dash=dot")
    const again = build(doom, set(ids.card, { dash: "dash" }))
    expect(get(at(again, ids.card), "stroke")).toMatchObject({ dash: "dash", weight: 2 })
  })

  it("wraps a gradient angle onto the circle as the panel does, so 400 is 40 and -10 is 350", () => {
    for (const [typed, saved] of [
      [400, 40],
      [-10, 350],
      [720, 0],
      [359.6, 0],
      [-0.5, 0],
    ] as const) {
      const read = readAgentChange(set(ids.card, { fill: { gradient: ["accent1", "accent2"], angle: typed } }))
      const doom = build(agentDeck(), read as AgentChange)
      expect(get(at(doom, ids.card), "fills")).toMatchObject([{ kind: "gradient", angle: saved }])
    }
  })

  it("refuses a tint past a whole step, a gradient of one colour, and an unknown dash or fit", () => {
    for (const look of [
      { color: "accent1+101" },
      { color: "accent1+" },
      { color: "accent9+10" },
      { fill: { gradient: ["accent1"] } },
      { fill: { gradient: ["accent1", "accent2"], angle: Number.POSITIVE_INFINITY } },
      { fill: { gradient: ["accent1", "accent2"], angle: "90" } },
      { dash: "wavy" },
      { fit: "crop" },
    ])
      expect(readAgentChange(set(ids.title, look))).toMatchObject({ refused: "shape" })
  })
})
