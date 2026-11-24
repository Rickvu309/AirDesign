import { describe, expect, it } from "vitest"
import { agentDeck, apply, build, minter } from "./agent-fixtures.js"
import { placeholderSubtitle, titleOnlyWrites, titleSlideWrites } from "./slide-placeholders.js"
import { placeholderTitle } from "./placeholder-title.js"
import { slideTextStyles } from "./slide-text-styles.js"
import { textHeight } from "./text-estimate.js"
import { childrenOf, propOf } from "./doom-walk.js"
import { ids } from "./sample-deck.js"
import type { Doom } from "./doom.js"
import type { Theme } from "./theme.js"

const size = { w: 1920, h: 1080 }
const theme = { textStyles: slideTextStyles } as Theme

function withTitleSlide(): Doom {
  const mint = minter("p")
  return apply(agentDeck(), titleSlideWrites(ids.slide, mint, size))
}

const byRole = (doom: Doom, role: string) => childrenOf(doom, ids.slide).find((node) => propOf(node, "role") === role)!
const titleAndSubtitle = (doom: Doom) => ({ title: byRole(doom, "title"), subtitle: byRole(doom, "subtitle") })

describe("a title slide's placeholders", () => {
  it("sets the title in the display style so a typical cover title fits on one line", () => {
    const { title } = titleAndSubtitle(withTitleSlide())
    const text = propOf(title, "text")!
    const box = propOf(title, "box")!
    expect(propOf(title, "role")).toBe("title")
    expect(text).toMatchObject({ chars: placeholderTitle, style: "display", resize: "fixed", alignV: "bottom" })
    const typical = { ...text, chars: "Q3 board update" }
    expect(textHeight(typical, theme, box.w)).toBe(theme.textStyles.display.size * theme.textStyles.display.lineHeight)
    expect(box.y + box.h).toBe(540)
  })

  it("puts the subtitle under the title with a gap, lighter than the title and in the quiet text colour", () => {
    const { title, subtitle } = titleAndSubtitle(withTitleSlide())
    const above = propOf(title, "box")!
    const below = propOf(subtitle, "box")!
    const text = propOf(subtitle, "text")!
    expect(propOf(subtitle, "role")).toBe("subtitle")
    expect(text.chars).toBe(placeholderSubtitle)
    expect(below.y - (above.y + above.h)).toBeGreaterThanOrEqual(32)
    expect(below.x).toBe(above.x)
    expect(below.w).toBe(above.w)
    expect(slideTextStyles[text.style].weight).toBeLessThan(slideTextStyles[propOf(title, "text")!.style].weight)
    expect(text.spans).toEqual([{ end: placeholderSubtitle.length, color: { var: "text2" } }])
  })

  it("keeps both inside the slide margins", () => {
    const { title, subtitle } = titleAndSubtitle(withTitleSlide())
    for (const box of [propOf(title, "box")!, propOf(subtitle, "box")!]) {
      expect(box.x).toBe(160)
      expect(box.x + box.w).toBe(1760)
      expect(box.y + box.h).toBeLessThanOrEqual(1080)
    }
  })
})

describe("a title-only slide's placeholder", () => {
  it("sets the title in the title style, a step under the cover's display, at the top left of the content margins", () => {
    const doom = apply(agentDeck(), titleOnlyWrites(ids.slide, minter("q"), size))
    const title = byRole(doom, "title")
    expect(propOf(title, "role")).toBe("title")
    expect(propOf(title, "text")).toMatchObject({ chars: placeholderTitle, style: "title", resize: "height" })
    expect(propOf(title, "box")).toMatchObject({ x: 160, y: 80, w: 1600 })
  })
})

describe("an agent's words on a title slide", () => {
  const word = (more: Record<string, unknown>) => ({
    op: "add" as const,
    kind: "text" as const,
    slide: ids.slide,
    ...more,
  })

  it("fill the subtitle placeholder and keep its gap, weight and colour", () => {
    const before = withTitleSlide()
    const titled = build(before, word({ text: "Q3 board update", textStyle: "title" }), minter("f"))
    const doom = build(titled, word({ text: "Revenue grew while margin held", textStyle: "heading" }), minter("g"))
    expect(childrenOf(doom, ids.slide)).toHaveLength(childrenOf(before, ids.slide).length)
    const { title, subtitle } = titleAndSubtitle(doom)
    expect(propOf(title, "text")).toMatchObject({ chars: "Q3 board update", style: "display" })
    expect(propOf(subtitle, "text")).toMatchObject({
      chars: "Revenue grew while margin held",
      style: "body",
      resize: "fixed",
      alignV: "top",
      spans: [{ end: 30, color: { var: "text2" } }],
    })
    expect(propOf(subtitle, "box")).toEqual(propOf(titleAndSubtitle(before).subtitle, "box"))
  })

  it("fill the title placeholder when the agent names the display style", () => {
    const before = withTitleSlide()
    const doom = build(before, word({ text: "Q3 board update", textStyle: "display" }), minter("d"))
    expect(childrenOf(doom, ids.slide)).toHaveLength(childrenOf(before, ids.slide).length)
    expect(propOf(titleAndSubtitle(doom).title, "text")).toMatchObject({ chars: "Q3 board update", style: "display" })
    expect(propOf(titleAndSubtitle(doom).subtitle, "text")!.chars).toBe(placeholderSubtitle)
  })

  it("add a second text once the subtitle is filled", () => {
    const filled = build(withTitleSlide(), word({ text: "Revenue grew", textStyle: "heading" }), minter("h"))
    const doom = build(filled, word({ text: "Margin held", textStyle: "body" }), minter("i"))
    expect(childrenOf(doom, ids.slide)).toHaveLength(childrenOf(filled, ids.slide).length + 1)
  })

  it("leave a text with a box of its own beside the subtitle placeholder", () => {
    const before = withTitleSlide()
    const doom = build(
      before,
      word({ text: "Note", textStyle: "body", box: { x: 0, y: 900, w: 400, h: 80 } }),
      minter("j"),
    )
    expect(childrenOf(doom, ids.slide)).toHaveLength(childrenOf(before, ids.slide).length + 1)
    expect(propOf(titleAndSubtitle(before).subtitle, "text")!.chars).toBe(placeholderSubtitle)
  })
})
