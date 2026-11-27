import { describe, expect, it } from "vitest"
import { deckOf } from "./deck-of.js"
import { readTheme } from "./theme.js"
import { measure } from "./testing/doom-fixtures-art.js"
import { doomFromTree } from "./doom-tree.js"
import { isRefusal } from "./index.js"
import { resolveSlide } from "./resolve-slide.js"
import { hex, ids, sampleDeck, tryLand } from "./sample-deck.js"
import { textFromMarkdown } from "./markdown.js"
import { testTheme } from "./testing/theme.js"

const keynote = {
  ...testTheme.textStyles,
  title: { ...testTheme.textStyles.title, size: 88 },
  body: { ...testTheme.textStyles.body, size: 48 },
}

describe("a deck's theme", () => {
  it("keeps the sizes its stored theme names", () => {
    const stored = readTheme({ ...testTheme, textStyles: keynote })
    if (isRefusal(stored)) throw new Error(JSON.stringify(stored))
    const { doom, slides } = doomFromTree({
      theme: stored,
      slides: [{ children: [{ type: "shape", props: { text: textFromMarkdown("Old deck", "title") } }] }],
    })
    expect(deckOf(doom).theme.textStyles.title.size).toBe(88)
    const [title] = resolveSlide(doom, slides[0]!, measure)
    expect(title!.text!.lines[0]!.runs[0]!.size).toBe(88)
  })

  it("reads only a whole theme, with no values of Doom's own to fill a gap", () => {
    const { display: _display, ...noDisplay } = testTheme.textStyles
    const { positive: _positive, ...noPositive } = testTheme.colors
    expect(() => readTheme({ ...testTheme, textStyles: noDisplay })).toThrow()
    expect(() => readTheme({ ...testTheme, colors: noPositive })).toThrow()
  })

  it("preserves the fallback art", () => {
    expect(testTheme).toMatchObject({ colors: { accent1: hex(0x0b3a6f) }, fonts: { heading: "Inter" } })
  })

  it("refuses to unset a deck's theme, so no deck falls back to the default scale", () => {
    const refused = tryLand(sampleDeck(), [{ node: ids.deck, prop: "theme", value: null }])
    expect(refused).toMatchObject({ refused: "shape", node: ids.deck, prop: "theme" })
  })
})
