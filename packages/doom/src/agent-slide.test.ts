import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { build, compiled, minter, started } from "./testing/agent-fixtures.js"
import { more, richDeck } from "./testing/rich-deck.js"
import {
  applyEdit,
  childrenOf,
  defaultTheme,
  doomFromTree,
  emptyDoom,
  isRefusal,
  nodeId,
  orderKeyBetween,
  rev,
  type Doom,
  type NodeId,
  type OrderKey,
  type Write,
} from "./index.js"
import { agent, create, ids, land, once, theme } from "./sample-deck.js"
import { parentOf, propOf, slidesOf } from "./doom-walk.js"
import { placement } from "./testing/placement-rules.js"

const change = (value: Record<string, unknown>) => value as AgentChange
const order = (doom: Doom) => slidesOf(doom).map((slide) => slide.id)
const refusal = (doom: Doom, value: Record<string, unknown>) =>
  compileAgentChange(doom, change(value), minter(), placement)

describe("slide add", () => {
  it("adds a slide in the last group that has a slide, leaving empty groups empty", () => {
    const { doom, slides, empties } = deckWithEmptyGroups()
    const added = build(started(doom), change({ op: "slide", add: {} }))
    const made = slidesOf(added).at(-1)!
    expect(parentOf(made)?.id).toBe(parentOf(added.nodes.get(slides[3]!))?.id)
    for (const empty of empties) expect(childrenOf(added, empty)).toEqual([])
  })

  it("adds the first slide on the deck's only empty row", () => {
    const bare = doomFromTree({ theme: defaultTheme, slides: [] }).doom
    const row = [...bare.nodes.values()].find((node) => node.type === "slideRow")!
    const added = build(started(bare), change({ op: "slide", add: {} }))
    expect(parentOf(slidesOf(added)[0])?.id).toBe(row.id)
  })

  it("adds a slide after the last one, in the same group, named by its place", () => {
    const doom = build(richDeck(), change({ op: "slide", add: {} }))
    const slides = slidesOf(doom)
    expect(slides.map((slide) => propOf(slide, "name"))).toEqual(["Slide 1", "Slide 2", "Slide 3"])
    expect(parentOf(slides[2]!)?.id).toBe(ids.row)
  })

  it("adds a slide after the one named", () => {
    const doom = build(richDeck(), change({ op: "slide", add: { after: ids.slide } }))
    expect(order(doom)[0]).toBe(ids.slide)
    expect(order(doom)[2]).toBe(more.slide2)
    expect(propOf(slidesOf(doom)[1]!, "name")).toBe("Slide 3")
  })

  it("starts a slide group when the deck has none", () => {
    const bare = started(
      land(emptyDoom, [
        ...create(ids.deck, "deck", null),
        { node: ids.deck, prop: "theme", value: theme() },
        { node: ids.deck, prop: "size", value: { w: 1920, h: 1080 } },
      ]),
    )
    const doom = build(bare, change({ op: "slide", add: {} }))
    expect(slidesOf(doom)).toHaveLength(1)
  })

  it("refuses a slide that is a layout or not there", () => {
    expect(refusal(richDeck(), { op: "slide", add: { after: more.layout } })).toMatchObject({
      refused: "shape",
      field: "after",
    })
    expect(refusal(richDeck(), { op: "slide", add: { after: "z:9" } })).toMatchObject({
      refused: "missing",
      field: "after",
    })
  })

  it("lands as an edit the doom accepts, and the 51st slide is refused as a limit", () => {
    let doom = richDeck()
    const ask = change({ op: "slide", add: {} })
    for (let count = 2; count < 50; count += 1) doom = build(doom, ask, minter(`m${count}`))
    expect(slidesOf(doom)).toHaveLength(50)
    const writes = compiled(doom, ask, minter("last"))
    const result = applyEdit(doom, { once: once(), author: agent("run-1"), writes, rev: rev(doom.rev + 1) })
    expect(isRefusal(result) && result.refused).toBe("limit")
  })
})

describe("slide move and delete", () => {
  it("moves a slide to the front of the first group that has a slide, and leaves empty groups empty", () => {
    const { doom, slides, empties } = deckWithEmptyGroups()
    const base = started(doom)
    const last = slides[3]!
    const moved = build(base, change({ op: "slide", move: { slide: last, after: null } }))
    expect(groups(moved)).toEqual([[last, slides[0]!, slides[1]!], [slides[2]!]])
    for (const empty of empties) expect(childrenOf(moved, empty)).toEqual([])
  })

  it("moves a slide to the front, or after another", () => {
    const base = build(richDeck(), change({ op: "slide", add: {} }), minter("a"))
    const third = slidesOf(base)[2]!.id
    expect(order(build(base, change({ op: "slide", move: { slide: third, after: null } })))).toEqual([
      third,
      ids.slide,
      more.slide2,
    ])
    expect(order(build(base, change({ op: "slide", move: { slide: ids.slide, after: more.slide2 } })))).toEqual([
      more.slide2,
      ids.slide,
      third,
    ])
  })

  it("deletes a slide by clearing its parent", () => {
    const doom = build(richDeck(), change({ op: "slide", delete: more.slide2 }))
    expect(order(doom)).toEqual([ids.slide])
    expect(parentOf(doom.nodes.get(more.slide2)!)).toBeNull()
  })

  it("refuses moving a slide after itself and a node that is no slide", () => {
    expect(refusal(richDeck(), { op: "slide", move: { slide: ids.slide, after: ids.slide } })).toMatchObject({
      refused: "shape",
      field: "after",
    })
    expect(refusal(richDeck(), { op: "slide", delete: ids.card })).toMatchObject({ refused: "shape", field: "delete" })
    expect(refusal(richDeck(), { op: "slide", move: { slide: "z:9", after: null } })).toMatchObject({
      refused: "missing",
      field: "move",
    })
  })

  it("wants exactly one of add, move and delete", () => {
    expect(refusal(richDeck(), { op: "slide" })).toEqual({
      refused: "shape",
      field: "slide",
      fault: "form",
      form: "Exactly one of add, move or delete.",
      change: "slide",
    })
    expect(refusal(richDeck(), { op: "slide", add: {}, delete: ids.slide })).toMatchObject({
      refused: "shape",
      field: "slide",
    })
  })
})

function groups(doom: Doom): NodeId[][] {
  const rows: NodeId[][] = []
  let row: NodeId | undefined
  for (const slide of slidesOf(doom)) {
    const parent = parentOf(slide)!.id
    if (parent !== row) {
      row = parent
      rows.push([])
    }
    rows.at(-1)!.push(slide.id)
  }
  return rows
}

function deckWithEmptyGroups() {
  const grown = doomFromTree({
    theme: defaultTheme,
    slides: ["One", "Two", "Three", "Four"].map((name) => ({ name, children: [] })),
  })
  const slides = grown.slides
  const firstRow = parentOf(grown.doom.nodes.get(slides[0]!))!
  const deck = parentOf(grown.doom.nodes.get(firstRow.id))!
  const keys: OrderKey[] = [orderKeyBetween(null, null)]
  for (let count = 0; count < 4; count += 1) keys.push(orderKeyBetween(keys.at(-1)!, null))
  const [before, home, mid, later, after] = keys
  const emptyBefore = nodeId("e:0")
  const emptyMid = nodeId("e:1")
  const emptyAfter = nodeId("e:2")
  const second = nodeId("g:2")
  const row = (id: NodeId, at: OrderKey): Write[] => [
    { node: id, prop: "type", value: "slideRow" },
    { node: id, prop: "parent", value: { id: deck.id, at } },
  ]
  const slideKey = orderKeyBetween(null, null)
  const doom = land(grown.doom, [
    { node: firstRow.id, prop: "parent", value: { id: deck.id, at: home! } },
    ...row(emptyBefore, before!),
    ...row(emptyMid, mid!),
    ...row(second, later!),
    { node: slides[2]!, prop: "parent", value: { id: second, at: slideKey } },
    { node: slides[3]!, prop: "parent", value: { id: second, at: orderKeyBetween(slideKey, null) } },
    ...row(emptyAfter, after!),
  ])
  return { doom, slides, empties: [emptyBefore, emptyMid, emptyAfter] }
}
