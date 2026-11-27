import * as doom from "@airdesign/doom"
import { placeholderTitle } from "@airdesign/doom/testing"
import fc from "fast-check"
import { describe, expect, it } from "vitest"
import type { GridMoveSide } from "./grid-move"
import { landed, paint, spot } from "./testing/doom-fixtures"
import { grouped, minter, undone } from "./testing/grouped-deck"
import {
  addSlideWrites,
  deleteSlideWrites,
  duplicateSlideWrites,
  moveSlideWrites,
  neighbourAfterDelete,
  slideGroupMoveWrites,
  slideGroupsOf,
} from "./slide-writes"

const slideIds = (view: doom.Doom) => doom.slidesOf(view).map((slide) => slide.id)

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
  it("puts a blank slide after the current one, with its background and no content", () => {
    const { view, slides } = three()
    const writes = addSlideWrites(view, slides[0]!, minter(), "blank")
    const after = landed(view, writes.writes)
    const order = slideIds(after)
    expect(order).toHaveLength(4)
    expect(order[1]).toBe(writes.slide)
    expect(after.nodes.get(writes.slide)).toMatchObject({ type: "slide", name: "Slide 4", fills: paint })
    expect(after.children.get(writes.slide) ?? []).toEqual([])
  })

  it("adds by default a slide with one title placeholder in the title style at the title spot", () => {
    const { view, slides } = three()
    const made = addSlideWrites(view, slides[0]!, minter())
    const after = landed(view, made.writes)
    const [title, ...rest] = after.children.get(made.slide) ?? []
    expect(rest).toEqual([])
    expect(after.nodes.get(title!)).toMatchObject({
      type: "shape",
      role: "title",
      box: { x: 160, y: 80, w: 1600, h: 120 },
      text: { chars: placeholderTitle, style: "title" },
    })
  })

  it("adds a title slide with a title and a subtitle placeholder", () => {
    const { view, slides } = three()
    const made = addSlideWrites(view, slides[0]!, minter(), "title")
    const after = landed(view, made.writes)
    const roles = (after.children.get(made.slide) ?? []).map((id) => (after.nodes.get(id) as { role?: string }).role)
    expect(roles).toEqual(["title", "subtitle"])
  })

  it.each(["text", "grid"] as const)("adds a %s layout, under its title, in one edit with the slide", (start) => {
    const { view, slides } = three()
    const made = addSlideWrites(view, slides[0]!, minter(), start)
    const after = landed(view, made.writes)
    const children = after.children.get(made.slide) ?? []
    expect(children).toHaveLength(2)
    expect((after.nodes.get(children[0]!) as { role?: string }).role).toBe("title")
    expect(slideIds(after)[1]).toBe(made.slide)
  })

  it("keeps the grid under its title, from the title's left edge", () => {
    const { view, slides } = three()
    const made = addSlideWrites(view, slides[0]!, minter(), "grid")
    const after = landed(view, made.writes)
    const [title, grid] = (after.children.get(made.slide) ?? []).map(
      (id) => (after.nodes.get(id) as doom.Node & { box: doom.Box }).box,
    )
    expect(grid!.x).toBe(title!.x)
    expect(grid!.y).toBeGreaterThanOrEqual(title!.y + title!.h)
    expect(grid!.w).toBe(title!.w)
  })

  it("adds after the last slide too", () => {
    const { view, slides } = three()
    const writes = addSlideWrites(view, slides[2]!, minter())
    expect(slideIds(landed(view, writes.writes)).at(-1)).toBe(writes.slide)
  })

  it("makes a first slide when the deck has none", () => {
    const withoutSlides = doom.doomFromTree({ theme: doom.defaultTheme, slides: [] }).doom
    expect(slideIds(withoutSlides)).toEqual([])
    const row = [...withoutSlides.nodes.values()].find((node) => node.type === "slideRow")!
    const writes = addSlideWrites(withoutSlides, null, minter())
    const after = landed(withoutSlides, writes.writes)
    expect(slideIds(after)).toEqual([writes.slide])
    expect(doom.parentOf(after.nodes.get(writes.slide))?.id).toBe(row.id)
  })

  it("ignores non-slideRow deck children when choosing a row for a first slide", () => {
    const withoutSlides = doom.doomFromTree({ theme: doom.defaultTheme, slides: [] }).doom
    const deck = [...withoutSlides.nodes.values()].find((node) => node.type === "deck")!
    const stray = doom.nodeId("f:91")
    const nodes = new Map(withoutSlides.nodes).set(stray, {
      id: stray,
      type: "frame",
      parent: { id: deck.id, at: doom.orderKeyBetween(null, null) },
      rev: doom.rev(1),
    })
    const children = new Map(withoutSlides.children).set(deck.id, [stray])
    const dirty: doom.Doom = { ...withoutSlides, nodes, children }
    const made = addSlideWrites(dirty, null, minter(), "blank")
    const after = landed(dirty, made.writes)
    expect(slideIds(after)).toEqual([made.slide])
    const parentRow = doom.parentOf(after.nodes.get(made.slide))
    expect(parentRow?.id).not.toBe(stray)
    expect(after.nodes.get(parentRow!.id)?.type).toBe("slideRow")
  })
})

function four() {
  const grown = doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: ["One", "Two", "Three", "Four"].map((name) => ({ name, children: [] })),
  })
  return { view: grown.doom, slides: grown.slides }
}

describe("duplicate slides", () => {
  it("copies the slide and everything on it right after the original", () => {
    const { view, slides } = three()
    const copy = duplicateSlideWrites(view, [slides[0]!], minter())
    const after = landed(view, copy.writes)
    const order = slideIds(after)
    const made = copy.slides[0]!
    expect(order).toHaveLength(4)
    expect(order[1]).toBe(made)
    expect(after.nodes.get(made)).toMatchObject({ name: "One", fills: paint })
    const [shape] = after.children.get(made) ?? []
    expect(shape).toBeDefined()
    expect(shape).not.toBe(doom.nodeId("n:4"))
    expect(after.nodes.get(shape!)).toMatchObject({ type: "shape", name: "a", box: spot(0, 0, 10, 10) })
  })

  it("copies several slides in one edit, each copy right after its original", () => {
    const { view, slides } = four()
    const copy = duplicateSlideWrites(view, [slides[1]!, slides[2]!], minter())
    const [two, three] = copy.slides
    expect(slideIds(landed(view, copy.writes))).toEqual([slides[0], slides[1], two, slides[2], three, slides[3]])
  })
})

describe("delete slides", () => {
  it("takes the slide out of the deck and leaves its content for undo", () => {
    const { view, slides } = three()
    const writes = deleteSlideWrites(view, [slides[1]!])
    expect(writes).toEqual([{ node: slides[1], prop: "parent", value: null }])
    expect(slideIds(landed(view, writes))).toEqual([slides[0], slides[2]])
  })

  it("takes several slides out in one edit", () => {
    const { view, slides } = four()
    expect(slideIds(landed(view, deleteSlideWrites(view, [slides[3]!, slides[1]!])))).toEqual([slides[0], slides[2]])
  })

  it("leaves the deck's last slide to the core, which refuses to land it", () => {
    const { view, slides } = three()
    const writes = deleteSlideWrites(view, slides)
    expect(writes).toHaveLength(slides.length)
    expect(
      doom.applyEdit(view, { once: "all", author: { kind: "person", id: "p" }, writes, rev: doom.rev(view.rev + 1) }),
    ).toEqual({ refused: "last-slide" })
  })

  it("lands on the slide that takes the first one's place, or the one before at the end", () => {
    const { view, slides } = three()
    expect(neighbourAfterDelete(view, [slides[1]!])).toBe(slides[2])
    expect(neighbourAfterDelete(view, [slides[2]!])).toBe(slides[1])
    expect(neighbourAfterDelete(view, [slides[0]!])).toBe(slides[1])
    const deck = four()
    expect(neighbourAfterDelete(deck.view, [deck.slides[1]!, deck.slides[2]!])).toBe(deck.slides[3])
    expect(neighbourAfterDelete(deck.view, [deck.slides[2]!, deck.slides[3]!])).toBe(deck.slides[1])
  })
})

describe("move slides", () => {
  it("keeps a slide dropped on a group's last slide in that group", () => {
    const { view: flat, slides } = three()
    const [one, two, last] = slides
    const group = doom.parentOf(flat.nodes.get(one!))!
    const deck = doom.parentOf(flat.nodes.get(group.id))!
    const second = doom.nodeId("m:99")
    const view = landed(flat, [
      { node: second, prop: "type", value: "slideRow" },
      { node: second, prop: "parent", value: { id: deck.id, at: doom.orderKeyBetween(deck.at, null) } },
      { node: last!, prop: "parent", value: { id: second, at: doom.orderKeyBetween(null, null) } },
    ])
    const groupOf = (after: doom.Doom, slide: doom.NodeId) => doom.parentOf(after.nodes.get(slide))?.id
    const moved = landed(view, moveSlideWrites(view, [one!], 2, two))
    expect(slideIds(moved)).toEqual([two, one, last])
    expect(groupOf(moved, one!)).toBe(group.id)
    const joined = landed(view, moveSlideWrites(view, [one!], 2, last))
    expect(slideIds(joined)).toEqual([two, one, last])
    expect(groupOf(joined, one!)).toBe(second)
  })

  it("is one write per slide that puts them before the asked place", () => {
    const { view, slides } = three()
    const writes = moveSlideWrites(view, [slides[0]!], 3)
    expect(writes).toHaveLength(1)
    expect(slideIds(landed(view, writes))).toEqual([slides[1], slides[2], slides[0]])
  })

  it("moves up and to the front", () => {
    const { view, slides } = three()
    expect(slideIds(landed(view, moveSlideWrites(view, [slides[2]!], 1)))).toEqual([slides[0], slides[2], slides[1]])
    expect(slideIds(landed(view, moveSlideWrites(view, [slides[2]!], 0)))).toEqual([slides[2], slides[0], slides[1]])
  })

  it("moves several slides together, in their deck order, closing the gaps they leave", () => {
    const { view, slides } = four()
    const [one, two, three, last] = slides
    expect(slideIds(landed(view, moveSlideWrites(view, [two!, one!], 4)))).toEqual([three, last, one, two])
    expect(slideIds(landed(view, moveSlideWrites(view, [one!, three!], 0)))).toEqual([one, three, two, last])
    expect(slideIds(landed(view, moveSlideWrites(view, [two!, last!], 1)))).toEqual([one, two, last, three])
  })

  it("writes nothing when the slides are already there", () => {
    const { view, slides } = four()
    expect(moveSlideWrites(view, [slides[1]!], 1)).toEqual([])
    expect(moveSlideWrites(view, [slides[1]!], 2)).toEqual([])
    expect(moveSlideWrites(view, [slides[1]!, slides[2]!], 3)).toEqual([])
  })
})

function groupsOf(view: doom.Doom, slides: readonly doom.NodeId[]): number[][] {
  const groups = new Map<doom.NodeId | undefined, number[]>()
  for (const slide of doom.slidesOf(view)) {
    const group = doom.parentOf(slide)?.id
    groups.set(group, [...(groups.get(group) ?? []), slides.indexOf(slide.id)])
  }
  return [...groups.values()]
}

function liveGroups(view: doom.Doom): number {
  return [...view.nodes.values()].filter((node) => node.type === "slideRow" && doom.parentOf(node) != null).length
}

describe("move slides between slide groups", () => {
  const pick = (slides: readonly doom.NodeId[], held: readonly number[]) => held.map((at) => slides[at]!)

  it("drops slides after a slide into that slide's group", () => {
    const { view, slides } = grouped([4, 4])
    const moved = landed(view, slideGroupMoveWrites(view, pick(slides, [0]), 7, "same", minter()))
    expect(groupsOf(moved, slides)).toEqual([
      [1, 2, 3],
      [4, 5, 6, 0, 7],
    ])
  })

  it("puts a slide at a slide group's start without changing the slide order", () => {
    const { view, slides } = grouped([4, 4])
    const moved = landed(view, slideGroupMoveWrites(view, pick(slides, [3]), 4, "before", minter()))
    expect(groupsOf(moved, slides)).toEqual([
      [0, 1, 2],
      [3, 4, 5, 6, 7],
    ])
  })

  it("starts a new slide group below with the moved slides and no other", () => {
    const { view, slides } = grouped([4, 4])
    const writes = slideGroupMoveWrites(view, pick(slides, [1, 2]), 4, "new", minter())
    const moved = landed(view, writes)
    expect(groupsOf(moved, slides)).toEqual([
      [0, 3],
      [1, 2],
      [4, 5, 6, 7],
    ])
    expect(writes.filter((write) => write.prop === "type")).toEqual([
      { node: doom.nodeId("m:1"), prop: "type", value: "slideRow" },
    ])
  })

  it("moves a whole slide group with one write to its slide group node", () => {
    const { view, slides } = grouped([3, 2, 3])
    const writes = slideGroupMoveWrites(view, pick(slides, [5, 6, 7]), 0, "keep", minter())
    expect(writes).toHaveLength(1)
    expect(groupsOf(landed(view, writes), slides)).toEqual([
      [5, 6, 7],
      [0, 1, 2],
      [3, 4],
    ])
    const down = slideGroupMoveWrites(view, pick(slides, [0, 1, 2]), 8, "keep", minter())
    expect(groupsOf(landed(view, down), slides)).toEqual([
      [3, 4],
      [5, 6, 7],
      [0, 1, 2],
    ])
  })

  it("leaves the slide group its last slide left in the deck, unseen, and undo puts the slide back in it", () => {
    const { view, slides } = grouped([3, 1, 2])
    const writes = slideGroupMoveWrites(view, pick(slides, [3]), 1, "same", minter())
    const moved = landed(view, writes)
    expect(groupsOf(moved, slides)).toEqual([
      [0, 3, 1, 2],
      [4, 5],
    ])
    expect(slideGroupsOf(moved)).toHaveLength(2)
    expect(liveGroups(moved)).toBe(3)
    expect(slideGroupsOf(undone(view, writes))).toEqual(slideGroupsOf(view))
  })

  it("writes nothing when the slides would stay in the same slide groups and places", () => {
    const { view, slides } = grouped([4, 1, 3])
    expect(slideGroupMoveWrites(view, pick(slides, [1]), 1, "same", minter())).toEqual([])
    expect(slideGroupMoveWrites(view, pick(slides, [1, 2]), 3, "same", minter())).toEqual([])
    expect(slideGroupMoveWrites(view, pick(slides, [5, 6, 7]), 5, "keep", minter())).toEqual([])
    expect(slideGroupMoveWrites(view, pick(slides, [4]), 5, "new", minter())).toEqual([])
  })

  it("keeps every slide, keeps the others in order and lands as one undo, for any drop", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 1, maxLength: 4 }),
        fc.array(fc.nat(15), { minLength: 1, maxLength: 4 }),
        fc.nat(16),
        fc.constantFrom("same", "before", "new", "keep"),
        (sizes, chosen, place, side: GridMoveSide) => {
          const { view, slides } = grouped(sizes)
          const held = [...new Set(chosen.map((at) => at % slides.length))].sort((a, b) => a - b)
          const at = place % (slides.length + 1)
          const before = groupsOf(view, slides)
          const writes = slideGroupMoveWrites(view, pick(slides, held), at, side, minter())
          const after = groupsOf(landed(view, writes), slides)
          expect(after.flat().toSorted((a, b) => a - b)).toEqual(slides.map((_, index) => index))
          expect(after.flat().filter((index) => !held.includes(index))).toEqual(
            before.flat().filter((index) => !held.includes(index)),
          )
          expect(groupsOf(undone(view, writes), slides)).toEqual(before)
        },
      ),
      { numRuns: 300 },
    )
  })
})

describe("add a slide in a new slide group", () => {
  it("puts the slide alone in a new slide group right below the slide's group", () => {
    const { view, slides } = grouped([2, 2])
    const made = addSlideWrites(view, slides[0]!, minter(), "blank", undefined, "new")
    const after = landed(view, made.writes)
    const order = slideIds(after)
    expect(groupsOf(after, [...slides, made.slide])).toEqual([[0, 1], [4], [2, 3]])
    expect(order[2]).toBe(made.slide)
  })

  it("adds below the last slide group too", () => {
    const { view, slides } = grouped([2, 2])
    const made = addSlideWrites(view, slides[3]!, minter(), "blank", undefined, "new")
    expect(groupsOf(landed(view, made.writes), [...slides, made.slide])).toEqual([[0, 1], [2, 3], [4]])
  })
})
