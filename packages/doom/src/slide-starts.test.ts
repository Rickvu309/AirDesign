import { describe, expect, it } from "vitest"
import { contentAreaOf } from "./agent-place.js"
import { minter } from "./agent-fixtures.js"
import { doomFromTree } from "./doom-tree.js"
import { defaultTheme } from "./default-theme-art.js"
import { childrenOf, descendantsOf, propOf } from "./doom-walk.js"
import { placeholderTitle } from "./placeholder-title.js"
import { type SlideStart, slideStartWrites, slideStarts } from "./slide-starts.js"
import { titleOnlyWrites } from "./slide-placeholders.js"
import { slideTextStyles } from "./slide-text-styles.js"
import { textHeight } from "./text-estimate.js"
import type { Theme } from "./theme.js"
import { sampleChart } from "./sample-charts.js"
import { applyEdit, isRefusal, rev, type Doom, type NodeId } from "./index.js"

const person = { kind: "person", id: "test" } as const

function started(start: SlideStart): { doom: Doom; slide: NodeId } {
  const grown = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const slide = grown.slides[0]!
  const writes = slideStartWrites(grown.doom, slide, minter("s"), start)
  const next = applyEdit(grown.doom, { once: "start", author: person, writes, rev: rev(grown.doom.rev + 1) })
  if (isRefusal(next)) throw new Error(JSON.stringify(next))
  return { doom: next, slide }
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe("a designed starting slide", () => {
  it("is offered in the order the New slide menu lists them", () => {
    expect(slideStarts).toEqual(["title", "text", "kpis", "cards", "chart", "timeline", "grid", "blank"])
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

  it("kpis: sets the numbers in a style a typical figure fits on one line", () => {
    const { doom, slide } = started("kpis")
    const kpi = childrenOf(doom, slide).find((node) => propOf(node, "name") === "KPI")!
    const numbers = descendantsOf(doom, kpi.id).filter((node) => propOf(node, "text")?.chars === "00.0%")
    expect(numbers).toHaveLength(3)
    const theme = { textStyles: slideTextStyles } as Theme
    for (const node of numbers) {
      const text = propOf(node, "text")!
      const room = Math.floor((1600 - 2 * 29) / 3) - 2 * 38
      for (const figure of ["$4.2M", "118%", "$12.5M", "+24.8%"]) {
        const one = textHeight({ ...text, chars: figure }, theme, room)
        expect(one, figure).toBe(theme.textStyles[text.style].size * theme.textStyles[text.style].lineHeight)
      }
    }
  })

  it.each(["kpis", "cards"] as const)(
    "%s: fills most of the room under the title, so the lower half of the slide is not left empty",
    (start) => {
      const { doom, slide } = started(start)
      const [content] = childrenOf(doom, slide).filter((node) => propOf(node, "role") !== "title")
      const box = propOf(content!, "box")!
      const room = 1000 - box.y
      expect(box.h).toBeGreaterThanOrEqual(0.55 * room)
      expect(box.y + box.h).toBeLessThanOrEqual(1000)
    },
  )

  it("blank: holds nothing", () => {
    const { doom, slide } = started("blank")
    expect(childrenOf(doom, slide)).toHaveLength(0)
  })

  it("is built by the agent's patterns, with placeholder words", () => {
    const names = (start: SlideStart) => {
      const { doom, slide } = started(start)
      return childrenOf(doom, slide).map((node) => propOf(node, "name"))
    }
    expect(names("kpis")).toEqual(["Title", "KPI"])
    expect(names("cards")).toEqual(["Title", "Cards"])
    expect(names("timeline")).toEqual(["Title", "Timeline"])
    expect(names("grid")).toEqual(["Title", "Grid"])
    const { doom, slide } = started("chart")
    expect(childrenOf(doom, slide).some((node) => propOf(node, "chart")?.kind === "column")).toBe(true)
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
    const area = contentAreaOf(titled, grown.slides[0]!)!
    expect(area).toMatchObject({ x: 160, w: 1600 })
    expect(area.y).toBeGreaterThan(200)
    expect(area.y + area.h).toBeLessThanOrEqual(1000)
    expect(contentAreaOf(doom, slide)).toEqual({ x: 160, y: 80, w: 1600, h: 920 })
  })
})

describe("a sample chart", () => {
  it("has a category for every value and a series name a person can edit", () => {
    for (const kind of ["column", "bar", "line", "pie", "stacked"] as const) {
      const chart = sampleChart(kind)
      expect(chart.kind).toBe(kind)
      for (const series of chart.series) expect(series.values).toHaveLength(chart.categories.length)
    }
  })
})
