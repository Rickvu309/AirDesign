import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { landed, paint, spot } from "./testing/doom-fixtures"
import {
  addSlideWrites,
  deleteSlideWrites,
  duplicateSlideWrites,
  moveSlideWrites,
  neighbourAfterDelete,
} from "./slide-writes"

const slideIds = (view: doom.Doom) => doom.slidesOf(view).map((slide) => slide.id)

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
      text: { chars: doom.placeholderTitle, style: "title" },
    })
  })

  it("adds a title slide with a title and a subtitle placeholder", () => {
    const { view, slides } = three()
    const made = addSlideWrites(view, slides[0]!, minter(), "title")
    const after = landed(view, made.writes)
    const roles = (after.children.get(made.slide) ?? []).map((id) => (after.nodes.get(id) as { role?: string }).role)
    expect(roles).toEqual(["title", "subtitle"])
  })

  it.each(["text", "kpis", "cards", "chart", "timeline", "grid"] as const)(
    "adds a %s slide the agent's patterns built, under its title, in one edit with the slide",
    (start) => {
      const { view, slides } = three()
      const made = addSlideWrites(view, slides[0]!, minter(), start)
      const after = landed(view, made.writes)
      const children = after.children.get(made.slide) ?? []
      expect(children).toHaveLength(2)
      expect((after.nodes.get(children[0]!) as { role?: string }).role).toBe("title")
      expect(slideIds(after)[1]).toBe(made.slide)
    },
  )

  it("keeps a pattern slide's content under its title, from the title's left edge", () => {
    const { view, slides } = three()
    const made = addSlideWrites(view, slides[0]!, minter(), "kpis")
    const after = landed(view, made.writes)
    const [title, kpi] = (after.children.get(made.slide) ?? []).map(
      (id) => (after.nodes.get(id) as doom.Node & { box: doom.Box }).box,
    )
    expect(kpi!.x).toBe(title!.x)
    expect(kpi!.y).toBeGreaterThanOrEqual(title!.y + title!.h)
    expect(kpi!.w).toBe(title!.w)
  })

  it("adds after the last slide too", () => {
    const { view, slides } = three()
    const writes = addSlideWrites(view, slides[2]!, minter())
    expect(slideIds(landed(view, writes.writes)).at(-1)).toBe(writes.slide)
  })

  it("makes a first slide when the deck has none", () => {
    const withoutSlides = doom.doomFromTree({ theme: doom.defaultTheme, slides: [] }).doom
    expect(slideIds(withoutSlides)).toEqual([])
    const writes = addSlideWrites(withoutSlides, null, minter())
    expect(slideIds(landed(withoutSlides, writes.writes))).toEqual([writes.slide])
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
