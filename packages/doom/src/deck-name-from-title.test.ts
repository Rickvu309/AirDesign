import { describe, expect, it } from "vitest"
import { blankDeckName, nameFromTitleWrites } from "./deck-name-from-title.js"
import { agentDeck, apply, build, minter, runName } from "./agent-fixtures.js"
import { compileAgentEdit } from "./agent-edit.js"
import { agent, ids } from "./sample-deck.js"
import { placeholderTitle } from "./placeholder-title.js"
import { titleSlideWrites } from "./slide-placeholders.js"
import { applyEdit, isRefusal, rev, type Doom, type NodeId, type Write } from "./index.js"
import { childrenOf, get, slidesOf } from "./doom-walk.js"
import { deckName } from "./deck-of.js"
import { limits } from "./limits.js"

const named = (name: string): Write => ({ node: ids.deck, prop: "name", value: name })

function titled(name: string): Doom {
  return apply(agentDeck(), [named(name), ...titleSlideWrites(ids.slide, minter("p"), { w: 1920, h: 1080 })])
}

const titleOf = (doom: Doom): NodeId => childrenOf(doom, ids.slide).find((node) => get(node, "role") === "title")!.id

const retitle = (doom: Doom, chars: string): Write => ({
  node: titleOf(doom),
  prop: "text",
  value: { ...get(doom.nodes.get(titleOf(doom))!, "text")!, chars, paras: chars.split("\n").map(() => ({})) },
})

describe("a deck named by its first title", () => {
  it("takes slide 1's title while the deck still has the default name", () => {
    const doom = titled(blankDeckName)
    expect(nameFromTitleWrites(doom, [retitle(doom, "Q3 board update")])).toEqual([named("Q3 board update")])
  })

  it("keeps a name the person chose", () => {
    const doom = titled("Board pack")
    expect(nameFromTitleWrites(doom, [retitle(doom, "Q3 board update")])).toEqual([])
  })

  it("keeps following the title for as long as the name is the title, and stops once the person renames", () => {
    const first = titled(blankDeckName)
    const partial = apply(first, [
      { ...retitle(first, "Q3 b"), base: first.revs.get(titleOf(first))?.get("text") as never },
      named("Q3 b"),
    ])
    expect(nameFromTitleWrites(partial, [retitle(partial, "Q3 board update")])).toEqual([named("Q3 board update")])
    const renamed = apply(partial, [named("Board pack")])
    expect(nameFromTitleWrites(renamed, [retitle(renamed, "Q3 board update")])).toEqual([])
  })

  it("waits while the title is still the placeholder or empty", () => {
    const doom = titled(blankDeckName)
    expect(nameFromTitleWrites(doom, [retitle(doom, placeholderTitle)])).toEqual([])
    expect(nameFromTitleWrites(doom, [retitle(doom, "")])).toEqual([])
  })

  it("writes only when the edit changes the title", () => {
    const doom = titled(blankDeckName)
    expect(nameFromTitleWrites(doom, [{ node: ids.slide, prop: "name", value: "Intro" }])).toEqual([])
  })

  it("takes the first line, trimmed and cut to the name limit", () => {
    const doom = titled(blankDeckName)
    expect(nameFromTitleWrites(doom, [retitle(doom, "  Q3 board update  \nRevenue grew")])).toEqual([
      named("Q3 board update"),
    ])
    const long = "x".repeat(limits.name + 20)
    const [write] = nameFromTitleWrites(doom, [retitle(doom, long)])
    expect([...(write!.value as string)]).toHaveLength(limits.name)
  })

  it("ignores a title on any slide but the first", () => {
    const doom = titled(blankDeckName)
    const added = build(doom, { op: "slide", add: {} }, minter("n"))
    const slide = slidesOf(added)[1]!.id
    const writes = titleSlideWrites(slide, minter("u"), { w: 1920, h: 1080 })
    expect(nameFromTitleWrites(added, writes)).toEqual([])
  })

  it("names the deck in the same agent edit that fills the title", () => {
    const doom = titled(blankDeckName)
    const edit = compileAgentEdit(
      doom,
      [{ op: "add", kind: "text", slide: ids.slide, text: "Q3 board update", textStyle: "title" }],
      { author: agent(runName), once: "fill", mint: minter("m") },
    )
    if ("refused" in edit) throw new Error(JSON.stringify(edit))
    const landed = applyEdit(doom, { ...edit.edit, rev: rev(doom.rev + 1) })
    if (isRefusal(landed)) throw new Error(JSON.stringify(landed))
    expect(deckName(landed)).toBe("Q3 board update")
  })
})
