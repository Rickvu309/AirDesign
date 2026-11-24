import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { build, compiled, minter, more, richDeck, started } from "./agent-fixtures.js"
import { applyEdit, emptyDoom, isRefusal, rev, type Doom } from "./index.js"
import { agent, create, ids, land, once, theme } from "./sample-deck.js"
import { parentOf, propOf, slidesOf } from "./doom-walk.js"

const change = (value: Record<string, unknown>) => value as AgentChange
const order = (doom: Doom) => slidesOf(doom).map((slide) => slide.id)
const refusal = (doom: Doom, value: Record<string, unknown>) => compileAgentChange(doom, change(value), minter())

describe("slide add", () => {
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
    expect(refusal(richDeck(), { op: "slide" })).toEqual({ refused: "shape", field: "slide", change: "slide" })
    expect(refusal(richDeck(), { op: "slide", add: {}, delete: ids.slide })).toMatchObject({
      refused: "shape",
      field: "slide",
    })
  })
})
