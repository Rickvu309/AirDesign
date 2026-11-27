import { describe, expect, it } from "vitest"
import type { Intent } from "./intent-read.js"
import { compileIntent } from "./intent-compile.js"
import { build, minter } from "./testing/agent-fixtures.js"
import { more, richDeck } from "./testing/rich-deck.js"
import { ids } from "./sample-deck.js"
import { childrenOf, parentOf, propOf } from "./doom-walk.js"
import type { Doom } from "./doom.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const kids = (doom: Doom, parent = ids.slide) => childrenOf(doom, parent).map((node) => node.id)
const replace = (look: Record<string, unknown>) => look as unknown as Intent
const compiled = (intent: Intent) => compileIntent(richDeck(), intent, minter("r"), placement, starts)

describe("replace", () => {
  it("puts a new layer in the old one's place and box, in one change", () => {
    const base = richDeck()
    const held = propOf(base.nodes.get(ids.side)!, "box")!
    const doom = build(base, replace({ op: "replace", target: ids.side, kind: "shape", fill: "accent2" }), minter("r"))
    const made = kids(doom)[1]!
    expect(kids(doom)).toEqual([ids.card, made, more.frame, more.line, more.icon])
    expect(parentOf(doom.nodes.get(ids.side)!)).toBeNull()
    expect(propOf(doom.nodes.get(made)!, "box")).toMatchObject({ x: held.x, y: held.y, w: held.w, h: held.h })
    expect(propOf(doom.nodes.get(made)!, "fills")).toEqual([{ kind: "solid", color: { var: "accent2" } }])
  })

  it("keeps the old layer's parent and takes the part of a box it is given", () => {
    const base = richDeck()
    const held = propOf(base.nodes.get(ids.caption)!, "box")!
    const doom = build(base, replace({ op: "replace", target: ids.caption, kind: "icon", icon: "star", box: { x: 4 } }))
    const made = kids(doom, ids.side).at(-1)!
    expect(parentOf(doom.nodes.get(ids.caption)!)).toBeNull()
    expect(propOf(doom.nodes.get(made)!, "box")).toMatchObject({ x: 4, y: held.y })
  })

  it("writes nothing when it is refused", () => {
    expect(compiled(replace({ op: "replace", target: "z:9", kind: "text", text: "x" }))).toMatchObject({
      refused: "missing",
      field: "target",
    })
    expect(compiled(replace({ op: "replace", target: ids.slide, kind: "text", text: "x" }))).toMatchObject({
      refused: "shape",
      field: "target",
    })
    expect(compiled(replace({ op: "replace", target: ids.side, kind: "line", text: "x" }))).toMatchObject({
      refused: "shape",
      field: "text",
      fault: "unknown",
      kind: "line",
    })
  })
})
