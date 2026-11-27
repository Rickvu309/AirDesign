import { describe, expect, it } from "vitest"
import type { Intent } from "./intent-read.js"
import { readIntent } from "./intent-read.js"
import { compileIntent } from "./intent-compile.js"
import { agentDeck, build, minter, started } from "./testing/agent-fixtures.js"
import { propOf, slidesOf } from "./doom-walk.js"
import type { Doom } from "./doom.js"
import { ids, land, sampleDeck } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const set = (target: string, look: Record<string, unknown>): Intent => ({ op: "set", target, ...look }) as Intent
const titles = (doom: Doom) => [...doom.nodes.values()].filter((node) => propOf(node, "role") === "title")

describe("one change over every slide: '*.title' sets the title on each slide that has one", () => {
  it("restyles the title of every slide in one change", () => {
    const titled = started(land(sampleDeck(), [{ node: ids.title, prop: "role", value: "title" }]))
    let doom = build(titled, { op: "duplicate", nodes: [ids.slide] }, minter("b"))
    doom = build(doom, set("*.title", { textStyle: "heading", color: "accent2" }), minter("c"))
    expect(slidesOf(doom)).toHaveLength(2)
    expect(titles(doom)).toHaveLength(2)
    for (const title of titles(doom))
      expect(propOf(title, "text")).toMatchObject({ style: "heading", spans: [{ color: { var: "accent2" } }] })
  })

  it("refuses when no slide has that role, and a target that is not a role", () => {
    expect(
      compileIntent(agentDeck(), set("*.subtitle", { textStyle: "body" }), minter(), placement, starts),
    ).toMatchObject({
      refused: "missing",
      field: "target",
    })
    expect(readIntent(set("*.card", { fill: "accent1" }))).toMatchObject({ refused: "shape" })
    expect(readIntent(set("*", { fill: "accent1" }))).toMatchObject({ refused: "shape" })
  })
})
