import * as doom from "@airdesign/doom"
import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { gridAnchor, gridMovePlacement, type GridMoveSide } from "./grid-move"
import {
  addSlideWrites,
  deleteSlideWrites,
  duplicateSlideWrites,
  moveSlideWrites,
  slideGroupMoveWrites,
  slideGroupsOf,
} from "./slide-writes"
import { landed } from "./testing/doom-fixtures"
import { grouped, minter, undone } from "./testing/grouped-deck"

const slideIds = (view: doom.Doom) => doom.slidesOf(view).map((slide) => slide.id)

function served(view: doom.Doom, ...edits: readonly (readonly doom.Write[])[]): doom.Doom {
  return edits.reduce((server, writes, number) => {
    const next = doom.applyEdit(server, {
      once: `tab-${String(number)}`,
      author: { kind: "person", id: `tab-${String(number)}` },
      writes,
      rev: doom.rev(server.rev + 1),
    })
    if (doom.isRefusal(next)) throw new Error(`refused ${JSON.stringify(next)}`)
    return next
  }, view)
}

const shown = (view: doom.Doom) => slideGroupsOf(view).map((group) => group.slides)

describe("two tabs editing one deck", () => {
  it("keeps a slide another tab added to a slide group this tab's move emptied, whichever lands first", () => {
    const { view, slides } = grouped([4, 1, 4])
    const moving = slideGroupMoveWrites(view, [slides[4]!], 5, "before", minter("a"))
    const adding = addSlideWrites(view, slides[4]!, minter("b"), "blank")
    const one = served(view, moving, adding.writes)
    const other = served(view, adding.writes, moving)
    expect(shown(one)).toEqual([slides.slice(0, 4), [adding.slide], [slides[4], ...slides.slice(5)]])
    expect(shown(other)).toEqual(shown(one))
  })

  it("keeps a slide another tab added to a slide group whose only slide this tab deleted, whichever lands first", () => {
    const { view, slides } = grouped([4, 1, 4])
    const deleting = deleteSlideWrites(view, [slides[4]!])
    const adding = addSlideWrites(view, slides[4]!, minter("b"), "blank")
    const one = served(view, deleting, adding.writes)
    const other = served(view, adding.writes, deleting)
    expect(shown(one)).toEqual([slides.slice(0, 4), [adding.slide], slides.slice(5)])
    expect(shown(other)).toEqual(shown(one))
  })

  it("never shows a slide group its only slide was deleted from, and undo and redo bring the slide back to it", () => {
    const { view, slides } = grouped([4, 1, 4])
    const writes = deleteSlideWrites(view, [slides[4]!])
    const deleted = landed(view, writes)
    expect(shown(deleted)).toEqual([slides.slice(0, 4), slides.slice(5)])
    const back = undone(view, writes)
    expect(slideGroupsOf(back)).toEqual(slideGroupsOf(view))
    expect(shown(landed(back, writes))).toEqual(shown(deleted))
  })

  it("moves a slide group between two slide groups that two tabs added at one spot", () => {
    const { view, slides } = grouped([4, 4, 4])
    const a = addSlideWrites(view, slides[0]!, minter("a"), "blank", undefined, "new")
    const b = addSlideWrites(view, slides[0]!, minter("b"), "blank", undefined, "new")
    const server = served(view, a.writes, b.writes)
    const [first, added, later, second, third] = slideGroupsOf(server)
    const keyOf = (group: doom.NodeId | undefined) => doom.parentOf(server.nodes.get(group!))?.at
    expect(keyOf(added?.group)).toBe(keyOf(later?.group))
    const moved = landed(server, slideGroupMoveWrites(server, second!.slides, 5, "keep", minter("c")))
    expect(shown(moved)).toEqual([first, added, second, later, third].map((group) => group!.slides))
  })
})

describe("slides and slide groups that share an order key", () => {
  const tiedPair = () => grouped([2, 2, 2], [true])

  it("adds a slide right after a slide that shares its key with the next one", () => {
    const { view } = tiedPair()
    const [one, two] = shown(view)[0]!
    const made = addSlideWrites(view, one!, minter(), "blank")
    expect(shown(landed(view, made.writes))[0]).toEqual([one, made.slide, two])
  })

  it("adds a slide group right below one that shares its key with the next slide group", () => {
    const { view } = tiedPair()
    const [one, two, three] = shown(view)
    const made = addSlideWrites(view, one![0]!, minter(), "blank", undefined, "new")
    expect(shown(landed(view, made.writes))).toEqual([one, [made.slide], two, three])
  })

  it("moves a slide in the Slides view between two that share a key", () => {
    const { view } = tiedPair()
    const order = slideIds(view)
    const moved = landed(view, moveSlideWrites(view, [order[3]!], 1))
    expect(slideIds(moved)).toEqual([order[0], order[3], order[1], order[2], order[4], order[5]])
  })

  it("duplicates a slide that shares its key with the next one, the copy right after it", () => {
    const { view } = tiedPair()
    const [one, two] = shown(view)[0]!
    const copy = duplicateSlideWrites(view, [one!], minter())
    expect(shown(landed(view, copy.writes))[0]).toEqual([one, copy.slides[0], two])
  })

  it("puts every Grid drop exactly where it was dropped, for any keys, ties included", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 1, maxLength: 4 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }),
        fc.array(fc.nat(15), { minLength: 1, maxLength: 4 }),
        fc.nat(16),
        fc.constantFrom("same", "before", "new", "keep"),
        (sizes, ties, chosen, place, side: GridMoveSide) => {
          const { view } = grouped(sizes, ties)
          const before = shown(view)
          const sequence = before.flat()
          const held = [...new Set(chosen.map((at) => sequence[at % sequence.length]!))]
          const at = place % (sequence.length + 1)
          const anchor = gridAnchor(sequence, new Set(held), at, side)
          const writes = slideGroupMoveWrites(view, held, at, side, minter())
          expect(shown(landed(view, writes))).toEqual(gridMovePlacement(before, held, anchor, side))
          expect(shown(undone(view, writes))).toEqual(before)
        },
      ),
      { numRuns: 300 },
    )
  })
})
