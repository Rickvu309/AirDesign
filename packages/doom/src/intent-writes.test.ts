import { describe, expect, it } from "vitest"
import type { Intent } from "./intent-read.js"
import { intentWrites } from "./intent-edit.js"
import { agentDeck, minter } from "./testing/agent-fixtures.js"
import { applyEdit, isRefusal, rev, type Doom, type Write } from "./index.js"
import { ids, person } from "./sample-deck.js"
import { childrenOf, propOf } from "./doom-walk.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const change = (value: Record<string, unknown>) => value as Intent
const by = () => ({ mint: minter(), placement, starts })

function landed(doom: Doom, writes: readonly Write[]): Doom {
  const after = applyEdit(doom, { once: "writes", author: person, writes, rev: rev(doom.rev + 1) })
  if (isRefusal(after)) throw new Error(JSON.stringify(after))
  return after
}

describe("intentWrites", () => {
  it("compiles each change on the one before and hands back plain writes", () => {
    const doom = agentDeck()
    const made = intentWrites(
      doom,
      [
        change({ op: "insert", kind: "shape", parent: ids.slide, box: { x: 10, y: 20, w: 30, h: 40 } }),
        change({ op: "update", target: "a:1", name: "Card", hidden: true }),
      ],
      by(),
    )
    if ("refused" in made) throw new Error(JSON.stringify(made))
    const after = landed(doom, made.writes)
    expect(childrenOf(after, ids.slide).at(-1)?.id).toBe("a:1")
    expect(propOf(after.nodes.get("a:1" as never), "name")).toBe("Card")
    expect(propOf(made.after.nodes.get("a:1" as never), "hidden")).toBe(true)
  })

  it("names the change Doom refused and where it sits", () => {
    const made = intentWrites(
      agentDeck(),
      [change({ op: "update", target: ids.title, name: "Title" }), change({ op: "ungroup", target: ids.title })],
      by(),
    )
    expect(made).toMatchObject({ refused: "shape", at: 1, change: `ungroup ${ids.title}` })
  })
})
