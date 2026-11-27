import { describe, expect, it } from "vitest"
import { contentAreaOf } from "./agent-place.js"
import { minter } from "./testing/agent-fixtures.js"
import { doomFromTree } from "./doom-tree.js"
import { defaultTheme } from "./theme.js"
import { childrenOf, propOf } from "./doom-walk.js"
import { placeholderTitle } from "./placeholder-title.js"
import { type SlideStart, slideStartWrites, slideStarts } from "./slide-starts.js"
import { titleOnlyWrites } from "./slide-placeholders.js"
import { applyEdit, isRefusal, rev, type Doom, type NodeId } from "./index.js"
import { placement } from "./testing/placement-rules.js"

const person = { kind: "person", id: "test" } as const

function started(start: SlideStart): { doom: Doom; slide: NodeId } {
  const grown = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const slide = grown.slides[0]!
  const writes = slideStartWrites(grown.doom, slide, minter("s"), start, placement)
  const next = applyEdit(grown.doom, {
    once: "start",
    author: person,
    writes,
    readBase: grown.doom.rev,
    rev: rev(grown.doom.rev + 1),
  })
  if (isRefusal(next)) throw new Error(JSON.stringify(next))
  return { doom: next, slide }
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe("a designed starting slide", () => {
  it("is offered in the order the New slide menu lists them", () => {
    expect(slideStarts).toEqual(["title", "text", "grid", "blank"])
  })

  it.each(slideStarts.filter((start) => start !== "blank" && start !== "title"))(
    "%s: sets the one title in the title style at the content margins and keeps the rest clear of it",
    (start) => {
      const { doom, slide } = started(start)
      const top = childrenOf(doom, slide)
      const titles = top.filter((node) => propOf(node, "role") === "title")
      expect(titles).toHaveLength(1)
      expect(propOf(titles[0]!, "text")).toMatchObject({ chars: placeholderTitle, style: "title" })
      expect(propOf(titles[0]!, "box")).toMatchObject({ x: 160, y: 80, w: 1600 })
      const boxes = top.map((node) => propOf(node, "box")!)
      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.w).toBeLessThanOrEqual(1920)
        expect(box.y + box.h).toBeLessThanOrEqual(1080)
      }
      for (const [at, box] of boxes.entries())
        for (const other of boxes.slice(at + 1)) expect(overlaps(box, other)).toBe(false)
      expect(top.length).toBeGreaterThan(1)
    },
  )

  it("title: holds the title and the subtitle placeholder only", () => {
    const { doom, slide } = started("title")
    expect(childrenOf(doom, slide).map((node) => propOf(node, "role"))).toEqual(["title", "subtitle"])
  })

  it.each(["grid"] as const)("%s: stays at content height under the title, short of the bottom margin", (start) => {
    const { doom, slide } = started(start)
    const [content] = childrenOf(doom, slide).filter((node) => propOf(node, "role") !== "title")
    const box = propOf(content!, "box")!
    expect(box.h).toBeLessThan(0.55 * (1000 - box.y))
    expect(box.y + box.h).toBeLessThan(1000)
  })

  it("blank: holds nothing", () => {
    const { doom, slide } = started("blank")
    expect(childrenOf(doom, slide)).toHaveLength(0)
  })

  it("starts the grid and text layouts with placeholder words", () => {
    const names = (start: SlideStart) => {
      const { doom, slide } = started(start)
      return childrenOf(doom, slide).map((node) => propOf(node, "name"))
    }
    expect(names("grid")).toEqual(["Title", "Grid"])
    const text = started("text")
    const body = childrenOf(text.doom, text.slide).find((node) => propOf(node, "role") !== "title")!
    expect(propOf(body, "text")).toMatchObject({
      style: "body",
      paras: [{ list: "bullet" }, { list: "bullet" }, { list: "bullet" }],
    })
  })
})

describe("the content area of a slide", () => {
  it("starts at the title's left edge, under it, as wide as the title", () => {
    const { doom, slide } = started("blank")
    const grown = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
    const titled = applyEdit(grown.doom, {
      once: "title",
      author: person,
      writes: titleOnlyWrites(grown.slides[0]!, minter("t"), { w: 1920, h: 1080 }),
      rev: rev(grown.doom.rev + 1),
    })
    if (isRefusal(titled)) throw new Error(JSON.stringify(titled))
    const area = contentAreaOf(titled, grown.slides[0]!, placement)!
    expect(area).toMatchObject({ x: 160, w: 1600 })
    expect(area.y).toBeGreaterThan(200)
    expect(area.y + area.h).toBeLessThanOrEqual(1000)
    expect(contentAreaOf(doom, slide, placement)).toEqual({ x: 160, y: 80, w: 1600, h: 920 })
  })
})
