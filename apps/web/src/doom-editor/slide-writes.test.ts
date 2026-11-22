import { doom } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { slidesOf } from "./node-props"
import { grow, landed, paint, spot } from "./doom-fixtures"
import {
  addSlideWrites,
  deleteSlideWrites,
  duplicateSlideWrites,
  moveSlideWrites,
  neighbourAfterDelete,
} from "./slide-writes"

function minter() {
  let next = 0
  return () => doom.nodeId(`m:${String((next += 1))}`)
}

function three() {
  const grown = doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "One",
        props: { fills: paint },
        children: [{ type: "shape", name: "a", props: { box: spot(0, 0, 10, 10) } }],
      },
      { name: "Two", children: [{ type: "shape", name: "b", props: { box: spot(0, 0, 10, 10) } }] },
      { name: "Three", children: [] },
    ],
  })
  return { view: grown.doom, slides: grown.slides, ids: grown.ids }
}

describe("add slide", () => {
  it("puts an empty slide after the current one, with its background and no content", () => {
    const { view, slides } = three()
    const writes = addSlideWrites(view, slides[0]!, minter())
    const after = landed(view, writes.writes)
    const order = slidesOf(after)
    expect(order).toHaveLength(4)
    expect(order[1]).toBe(writes.slide)
    expect(after.nodes.get(writes.slide)).toMatchObject({ type: "slide", name: "Slide 4", fills: paint })
    expect(after.children.get(writes.slide) ?? []).toEqual([])
  })

  it("adds a title slide with one title in the title style, scaled to the deck", () => {
    const { view, slides } = three()
    const made = addSlideWrites(view, slides[0]!, minter(), "title")
    const after = landed(view, made.writes)
    const [title] = after.children.get(made.slide) ?? []
    expect(after.nodes.get(title!)).toMatchObject({
      type: "shape",
      role: "title",
      box: { x: 160, y: 380, w: 1600, h: 160 },
      text: { chars: "Title", style: "title" },
    })
  })

  it("adds after the last slide too", () => {
    const { view, slides } = three()
    const writes = addSlideWrites(view, slides[2]!, minter())
    expect(slidesOf(landed(view, writes.writes)).at(-1)).toBe(writes.slide)
  })

  it("makes a first slide when the deck has none", () => {
    const grown = grow([])
    const withoutSlides = landed(grown.view, [{ node: grown.slides[0]!, prop: "parent", value: null }])
    expect(slidesOf(withoutSlides)).toEqual([])
    const writes = addSlideWrites(withoutSlides, null, minter())
    expect(slidesOf(landed(withoutSlides, writes.writes))).toEqual([writes.slide])
  })
})

describe("duplicate slide", () => {
  it("copies the slide and everything on it right after the original", () => {
    const { view, slides } = three()
    const copy = duplicateSlideWrites(view, slides[0]!, minter())
    const after = landed(view, copy.writes)
    const order = slidesOf(after)
    expect(order).toHaveLength(4)
    expect(order[1]).toBe(copy.slide)
    expect(after.nodes.get(copy.slide)).toMatchObject({ name: "One", fills: paint })
    const [shape] = after.children.get(copy.slide) ?? []
    expect(shape).toBeDefined()
    expect(shape).not.toBe(doom.nodeId("n:4"))
    expect(after.nodes.get(shape!)).toMatchObject({ type: "shape", name: "a", box: spot(0, 0, 10, 10) })
  })
})

describe("delete slide", () => {
  it("takes the slide out of the deck and leaves its content for undo", () => {
    const { view, slides } = three()
    const writes = deleteSlideWrites(view, slides[1]!)
    expect(writes).toEqual([{ node: slides[1], prop: "parent", value: null }])
    expect(slidesOf(landed(view, writes))).toEqual([slides[0], slides[2]])
  })

  it("never deletes the last slide", () => {
    const grown = grow([])
    expect(deleteSlideWrites(grown.view, grown.slides[0]!)).toEqual([])
  })

  it("lands on the slide that takes its place, or the one before at the end", () => {
    const { view, slides } = three()
    expect(neighbourAfterDelete(view, slides[1]!)).toBe(slides[2])
    expect(neighbourAfterDelete(view, slides[2]!)).toBe(slides[1])
    expect(neighbourAfterDelete(view, slides[0]!)).toBe(slides[1])
  })
})

describe("move slide", () => {
  it("is one write that puts the slide at the asked place", () => {
    const { view, slides } = three()
    const writes = moveSlideWrites(view, slides[0]!, 2)
    expect(writes).toHaveLength(1)
    expect(slidesOf(landed(view, writes))).toEqual([slides[1], slides[2], slides[0]])
  })

  it("moves up and to the front", () => {
    const { view, slides } = three()
    expect(slidesOf(landed(view, moveSlideWrites(view, slides[2]!, 1)))).toEqual([slides[0], slides[2], slides[1]])
    expect(slidesOf(landed(view, moveSlideWrites(view, slides[2]!, 0)))).toEqual([slides[2], slides[0], slides[1]])
  })

  it("writes nothing when the slide is already there", () => {
    const { view, slides } = three()
    expect(moveSlideWrites(view, slides[1]!, 1)).toEqual([])
  })
})
