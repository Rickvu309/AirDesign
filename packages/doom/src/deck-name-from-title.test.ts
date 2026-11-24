import { describe, expect, it } from "vitest"
import { blankDeckName, deckNameFollows, nameFromTitleWrites as derivedWrites } from "./deck-name-from-title.js"
import { agentDeck, apply, build, minter, runName } from "./agent-fixtures.js"
import { compileAgentEdit } from "./agent-edit.js"
import { readAgentChange } from "./agent-change.js"
import { agent, ids } from "./sample-deck.js"
import { placeholderTitle } from "./placeholder-title.js"
import { titleSlideWrites } from "./slide-placeholders.js"
import { applyEdit, invert, isRefusal, orderKeyBetween, rev, type Doom, type NodeId, type Write } from "./index.js"
import { childrenOf, propOf, slidesOf } from "./doom-walk.js"
import { deckName } from "./deck-of.js"
import { limits } from "./limits.js"

const named = (name: string): Write => ({ node: ids.deck, prop: "name", value: name })
const follows = (on: boolean): Write => ({ node: ids.deck, prop: "nameFollows", value: on })

function titled(name: string, following?: boolean): Doom {
  return apply(agentDeck(), [
    named(name),
    ...(following === undefined ? [] : [follows(following)]),
    ...titleSlideWrites(ids.slide, minter("p"), { w: 1920, h: 1080 }),
  ])
}

const based = (doom: Doom, write: Write): Write => ({
  ...write,
  base: doom.revs.get(write.node)?.get(write.prop) as never,
})

const titleOn = (doom: Doom, slide: NodeId): NodeId =>
  childrenOf(doom, slide).find((node) => propOf(node, "role") === "title")!.id

const typed = (doom: Doom, title: NodeId, chars: string): Write => ({
  node: title,
  prop: "text",
  value: { ...propOf(doom.nodes.get(title)!, "text")!, chars, paras: chars.split("\n").map(() => ({})) },
})

function twoSlides(first: string, second: string): { readonly doom: Doom; readonly second: NodeId } {
  const start = titled(blankDeckName, true)
  const one = apply(start, [based(start, retitle(start, first)), named(first)])
  const added = build(one, { op: "slide", add: {} }, minter("n"))
  const slide = slidesOf(added)[1]!.id
  const withTitle = apply(added, titleSlideWrites(slide, minter("u"), { w: 1920, h: 1080 }))
  const doom = apply(withTitle, [based(withTitle, typed(withTitle, titleOn(withTitle, slide), second))])
  return { doom, second: slide }
}

const nameFromTitleWrites = (doom: Doom, writes: readonly Write[]): readonly Write[] =>
  derivedWrites(doom, writes).map(({ base: _base, ...write }) => write)

const deckWrites = (writes: readonly Write[]) => writes.filter((write) => write.node === ids.deck)

const titleOf = (doom: Doom): NodeId => childrenOf(doom, ids.slide).find((node) => propOf(node, "role") === "title")!.id

const retitle = (doom: Doom, chars: string): Write => ({
  node: titleOf(doom),
  prop: "text",
  value: { ...propOf(doom.nodes.get(titleOf(doom))!, "text")!, chars, paras: chars.split("\n").map(() => ({})) },
})

describe("a deck whose name follows its first title", () => {
  it("takes slide 1's title while the name follows, and writes nothing else", () => {
    const doom = titled(blankDeckName, true)
    expect(nameFromTitleWrites(doom, [retitle(doom, "Q3 board update")])).toEqual([named("Q3 board update")])
  })

  it("bases the name it writes on the deck's name and flag as they stood, so a stale replay is refused", () => {
    const doom = titled(blankDeckName, true)
    const [name, ...rest] = derivedWrites(doom, [retitle(doom, "Q3")])
    expect(name).toEqual({ ...named("Q3"), base: doom.revs.get(ids.deck)?.get("name") })
    expect(rest).toEqual([])
  })

  it("follows on an old deck with no flag only while it has the default name, and says so", () => {
    const blank = titled(blankDeckName)
    expect(nameFromTitleWrites(blank, [retitle(blank, "Q3")])).toEqual([named("Q3"), follows(true)])
    const chosen = titled("Board pack")
    expect(nameFromTitleWrites(chosen, [retitle(chosen, "Q3")])).toEqual([])
  })

  it("stops following once a person or an agent names the deck, even with a slide's own title", () => {
    const { doom } = twoSlides("Intro", "Roadmap")
    expect(nameFromTitleWrites(doom, [named("Roadmap")])).toEqual([follows(false)])
    const renamed = apply(doom, [named("Roadmap"), follows(false)])
    expect(nameFromTitleWrites(renamed, [based(renamed, retitle(renamed, "Intro two"))])).toEqual([])
  })

  it("stops following on a name equal to both slides' title too", () => {
    const { doom } = twoSlides("Zed", "Zed")
    const renamed = apply(doom, [named("Zed"), follows(false)])
    expect(nameFromTitleWrites(renamed, [based(renamed, retitle(renamed, "Alpha"))])).toEqual([])
  })

  it("follows the title of whichever slide is first after a delete or a reorder, and goes blank when it has none", () => {
    const { doom, second } = twoSlides("Alpha", "Beta")
    const row = propOf(slidesOf(doom)[0]!, "parent")!
    const moved = { node: second, prop: "parent", value: { id: row.id, at: orderKeyBetween(null, row.at) } } as Write
    expect(deckWrites(nameFromTitleWrites(doom, [moved]))).toEqual([named("Beta")])
    const firstGone: Write = { node: ids.slide, prop: "parent", value: null }
    expect(deckWrites(nameFromTitleWrites(doom, [firstGone]))).toEqual([named("Beta")])
    const titleGone: Write = { node: titleOn(doom, second), prop: "parent", value: null }
    expect(deckWrites(nameFromTitleWrites(doom, [moved, titleGone]))).toEqual([named(blankDeckName)])
    const untitled = apply(doom, [based(doom, typed(doom, titleOn(doom, second), placeholderTitle))])
    expect(deckWrites(nameFromTitleWrites(untitled, [firstGone]))).toEqual([named(blankDeckName)])
    const betaFirst = apply(doom, [moved, named("Beta")])
    expect(
      nameFromTitleWrites(betaFirst, [based(betaFirst, typed(betaFirst, titleOn(betaFirst, second), "Gamma"))]),
    ).toEqual([named("Gamma")])
    expect(nameFromTitleWrites(betaFirst, [firstGone])).toEqual([])
  })

  it("names the deck for the next slide's title when an agent deletes slide 1, as a person's delete does", () => {
    const { doom } = twoSlides("Alpha", "Beta")
    const edit = compileAgentEdit(doom, [{ op: "slide", delete: ids.slide }], {
      author: agent(runName),
      once: "gone",
      mint: minter("m"),
    })
    if ("refused" in edit) throw new Error(JSON.stringify(edit))
    const landed = applyEdit(doom, { ...edit.edit, rev: rev(doom.rev + 1) })
    if (isRefusal(landed)) throw new Error(JSON.stringify(landed))
    expect(deckName(landed)).toBe("Beta")
  })

  it("leaves a chosen name alone when slide 1 is deleted or another slide moves first", () => {
    const { doom, second } = twoSlides("Alpha", "Beta")
    const chosen = apply(doom, [named("Board pack"), follows(false)])
    const row = propOf(slidesOf(chosen)[0]!, "parent")!
    const moved = { node: second, prop: "parent", value: { id: row.id, at: orderKeyBetween(null, row.at) } } as Write
    expect(nameFromTitleWrites(chosen, [moved])).toEqual([])
    expect(nameFromTitleWrites(chosen, [{ node: ids.slide, prop: "parent", value: null }])).toEqual([])
  })

  it("keeps following when the title is cleared and typed again", () => {
    const doom = titled(blankDeckName, true)
    const cleared = apply(doom, [based(doom, retitle(doom, ""))])
    expect(nameFromTitleWrites(doom, [retitle(doom, "")])).toEqual([])
    expect(nameFromTitleWrites(cleared, [based(cleared, retitle(cleared, "Again"))])).toEqual([named("Again")])
  })

  it("goes back to the default name when the title it follows is deleted or emptied, and stays following", () => {
    const doom = titled("Draft", true)
    const gone: Write = { node: titleOf(doom), prop: "parent", value: null }
    expect(nameFromTitleWrites(doom, [gone])).toEqual([named(blankDeckName)])
    expect(nameFromTitleWrites(doom, [retitle(doom, "")])).toEqual([named(blankDeckName)])
    const reset = apply(doom, [gone, named(blankDeckName)])
    expect(deckNameFollows(reset)).toBe(true)
    expect(nameFromTitleWrites(reset, [gone])).toEqual([])
  })

  it("keeps a name that was chosen when the title is deleted", () => {
    const doom = titled("Board pack", false)
    expect(nameFromTitleWrites(doom, [{ node: titleOf(doom), prop: "parent", value: null }])).toEqual([])
  })

  it("keeps an agent's name when the same edit retitles slide 1", () => {
    const doom = titled(blankDeckName, true)
    const edit = compileAgentEdit(
      doom,
      [
        { op: "deck", name: "Board pack" },
        { op: "add", kind: "text", slide: ids.slide, text: "Q3 board update", textStyle: "title" },
      ],
      { author: agent(runName), once: "both", mint: minter("m") },
    )
    if ("refused" in edit) throw new Error(JSON.stringify(edit))
    const landed = applyEdit(doom, { ...edit.edit, rev: rev(doom.rev + 1) })
    if (isRefusal(landed)) throw new Error(JSON.stringify(landed))
    expect(deckName(landed)).toBe("Board pack")
    expect(
      propOf(
        [...landed.nodes.values()].find((node) => node.type === "deck")!,
        "nameFollows",
      ),
    ).toBe(false)
  })

  it("lets an agent read and set whether the name follows, as a person's rename does", () => {
    const chosen = apply(titled("Board pack", false), [])
    expect(deckNameFollows(chosen)).toBe(false)
    const turned = build(chosen, { op: "deck", nameFollows: true })
    expect(deckNameFollows(turned)).toBe(true)
    expect(nameFromTitleWrites(turned, [retitle(turned, "Q4 plan")])).toEqual([named("Q4 plan")])
  })

  it("refuses an empty or blank name from a person or an agent", () => {
    const doom = titled(blankDeckName, true)
    for (const value of ["", "   "]) {
      const landed = applyEdit(doom, {
        once: "blank",
        author: agent(runName),
        writes: [named(value)],
        rev: rev(doom.rev + 1),
      })
      expect(isRefusal(landed)).toBe(true)
      expect(readAgentChange({ op: "deck", name: value })).toHaveProperty("refused")
    }
  })

  it("puts back the name and the flag together when a rename is undone", () => {
    const doom = titled(blankDeckName, true)
    const writes = [named("Board pack"), ...nameFromTitleWrites(doom, [named("Board pack")])]
    const landed = applyEdit(doom, { once: "rename", author: agent(runName), writes, rev: rev(doom.rev + 1) })
    if (isRefusal(landed)) throw new Error(JSON.stringify(landed))
    const back = invert(doom, landed, { once: "rename", author: agent(runName), writes, rev: rev(doom.rev + 1) })
    const undone = applyEdit(landed, { once: "undo", author: agent(runName), writes: back, rev: rev(landed.rev + 1) })
    if (isRefusal(undone)) throw new Error(JSON.stringify(undone))
    expect(deckName(undone)).toBe(blankDeckName)
    expect(nameFromTitleWrites(undone, [retitle(undone, "Again")])).toEqual([named("Again")])
  })

  it("waits while the title is still the placeholder or empty", () => {
    const doom = titled(blankDeckName, true)
    expect(nameFromTitleWrites(doom, [retitle(doom, placeholderTitle)])).toEqual([])
    expect(nameFromTitleWrites(doom, [retitle(doom, "")])).toEqual([])
  })

  it("writes only when the edit changes the title", () => {
    const doom = titled(blankDeckName, true)
    expect(nameFromTitleWrites(doom, [{ node: ids.slide, prop: "name", value: "Intro" }])).toEqual([])
  })

  it("takes the first line, trimmed and cut to the name limit", () => {
    const doom = titled(blankDeckName, true)
    expect(nameFromTitleWrites(doom, [retitle(doom, "  Q3 board update  \nRevenue grew")])).toEqual([
      named("Q3 board update"),
    ])
    const long = "x".repeat(limits.name + 20)
    const [write] = nameFromTitleWrites(doom, [retitle(doom, long)])
    expect([...(write!.value as string)]).toHaveLength(limits.name)
  })

  it("ignores a title on any slide but the first", () => {
    const doom = titled(blankDeckName, true)
    const added = build(doom, { op: "slide", add: {} }, minter("n"))
    const slide = slidesOf(added)[1]!.id
    const writes = titleSlideWrites(slide, minter("u"), { w: 1920, h: 1080 })
    expect(nameFromTitleWrites(added, writes)).toEqual([])
  })

  it("names the deck in the same agent edit that fills the title", () => {
    const doom = titled(blankDeckName, true)
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
