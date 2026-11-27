import { describe, expect, it } from "vitest"
import type { Intent } from "./intent-read.js"
import { compileIntent } from "./intent-compile.js"
import { build, minter } from "./testing/agent-fixtures.js"
import { more, richDeck } from "./testing/rich-deck.js"
import { ids } from "./sample-deck.js"
import { childrenOf } from "./doom-walk.js"
import type { Doom } from "./doom.js"
import type { NodeId } from "./ids.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const kids = (doom: Doom) => childrenOf(doom, ids.slide).map((node) => node.id)
const reorder = (targets: readonly NodeId[], direction: "front" | "back" | "forward" | "backward"): Intent => ({
  op: "reorder",
  targets,
  direction,
})

describe("reorder", () => {
  it("brings layers to the front, sends them to the back, and steps them one place", () => {
    const base = richDeck()
    expect(kids(base)).toEqual([ids.card, ids.side, more.frame, more.line, more.icon])
    expect(kids(build(base, reorder([ids.side], "front")))).toEqual([
      ids.card,
      more.frame,
      more.line,
      more.icon,
      ids.side,
    ])
    expect(kids(build(base, reorder([more.line], "back")))).toEqual([
      more.line,
      ids.card,
      ids.side,
      more.frame,
      more.icon,
    ])
    expect(kids(build(base, reorder([ids.side], "forward")))).toEqual([
      ids.card,
      more.frame,
      ids.side,
      more.line,
      more.icon,
    ])
    expect(kids(build(base, reorder([more.line], "backward")))).toEqual([
      ids.card,
      ids.side,
      more.line,
      more.frame,
      more.icon,
    ])
  })

  it("steps a run of layers together and keeps their order", () => {
    expect(kids(build(richDeck(), reorder([ids.card, ids.side], "forward")))).toEqual([
      more.frame,
      ids.card,
      ids.side,
      more.line,
      more.icon,
    ])
    expect(kids(build(richDeck(), reorder([more.line, more.icon], "back")))).toEqual([
      more.line,
      more.icon,
      ids.card,
      ids.side,
      more.frame,
    ])
  })

  it("writes nothing for a layer already in place", () => {
    expect(compileIntent(richDeck(), reorder([more.icon], "front"), minter(), placement, starts)).toEqual([])
  })

  it("refuses a slide and a layer that is not there", () => {
    expect(compileIntent(richDeck(), reorder([ids.slide], "front"), minter(), placement, starts)).toMatchObject({
      refused: "shape",
      field: "targets",
    })
    expect(compileIntent(richDeck(), reorder(["z:9" as NodeId], "back"), minter(), placement, starts)).toMatchObject({
      refused: "missing",
      field: "targets",
    })
  })
})
