import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { build, compiled, minter, more, richDeck, started } from "./agent-fixtures.js"
import { applyEdit, emptyScene, isRefusal, rev, type Scene } from "./index.js"
import { agent, create, ids, land, once, theme } from "./sample-deck.js"
import { childrenOf, get, parentOf, slidesOf } from "./scene-walk.js"

const change = (value: Record<string, unknown>) => value as AgentChange
const order = (scene: Scene) => slidesOf(scene).map((slide) => slide.id)
const refusal = (scene: Scene, value: Record<string, unknown>) => compileAgentChange(scene, change(value), minter())

describe("slide add", () => {
  it("adds a slide after the last one, in the same group, named by its place", () => {
    const scene = build(richDeck(), change({ op: "slide", add: {} }))
    const slides = slidesOf(scene)
    expect(slides.map((slide) => get(slide, "name"))).toEqual(["Slide 1", "Slide 2", "Slide 3"])
    expect(parentOf(slides[2]!)?.id).toBe(ids.row)
  })

  it("adds a slide after the one named", () => {
    const scene = build(richDeck(), change({ op: "slide", add: { after: ids.slide } }))
    expect(order(scene)[0]).toBe(ids.slide)
    expect(order(scene)[2]).toBe(more.slide2)
    expect(get(slidesOf(scene)[1]!, "name")).toBe("Slide 3")
  })

  it("starts a slide group when the deck has none", () => {
    const bare = started(
      land(emptyScene, [
        ...create(ids.deck, "deck", null),
        { node: ids.deck, prop: "theme", value: theme() },
        { node: ids.deck, prop: "size", value: { w: 1920, h: 1080 } },
      ]),
    )
    const scene = build(bare, change({ op: "slide", add: {} }))
    expect(slidesOf(scene)).toHaveLength(1)
  })

  it("copies a layout's look and its nodes onto the new slide, with new ids", () => {
    const scene = build(richDeck(), change({ op: "slide", add: { layout: "Title" } }))
    const made = slidesOf(scene).at(-1)!
    expect(get(made, "slideLayout")).toBe(more.layout)
    expect(get(made, "fills")).toEqual([{ kind: "solid", color: { var: "background2" } }])
    const copies = childrenOf(scene, made.id)
    expect(copies.map((node) => get(node, "role"))).toEqual(["title", "subtitle"])
    expect(copies.map((node) => get(node, "text")?.chars)).toEqual(["Title", "Subtitle"])
    expect(copies.map((node) => node.id)).not.toContain(more.layoutTitle)
    expect(childrenOf(scene, more.layout)).toHaveLength(2)
  })

  it("makes the copied title the one `<slide>.title` finds", () => {
    let scene = build(richDeck(), change({ op: "slide", add: { layout: "Title" } }), minter("a"))
    const made = slidesOf(scene).at(-1)!
    scene = build(scene, change({ op: "set", target: `${made.id}.title`, text: "Board update" }), minter("b"))
    expect(get(childrenOf(scene, made.id)[0]!, "text")?.chars).toBe("Board update")
  })

  it("refuses a layout nobody named, and a slide that is a layout or not there", () => {
    expect(refusal(richDeck(), { op: "slide", add: { layout: "Nope" } })).toEqual({
      refused: "missing",
      field: "layout",
      change: "slide add",
    })
    expect(refusal(richDeck(), { op: "slide", add: { after: more.layout } })).toMatchObject({
      refused: "shape",
      field: "after",
    })
    expect(refusal(richDeck(), { op: "slide", add: { after: "z:9" } })).toMatchObject({
      refused: "missing",
      field: "after",
    })
  })

  it("lands as an edit the scene accepts, and the 51st slide is refused as a limit", () => {
    let scene = richDeck()
    const ask = change({ op: "slide", add: {} })
    for (let count = 2; count < 50; count += 1) scene = build(scene, ask, minter(`m${count}`))
    expect(slidesOf(scene)).toHaveLength(50)
    const writes = compiled(scene, ask, minter("last"))
    const result = applyEdit(scene, { once: once(), author: agent("run-1"), writes, rev: rev(scene.rev + 1) })
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
    const scene = build(richDeck(), change({ op: "slide", delete: more.slide2 }))
    expect(order(scene)).toEqual([ids.slide])
    expect(parentOf(scene.nodes.get(more.slide2)!)).toBeNull()
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
