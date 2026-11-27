import { describe, expect, it } from "vitest"
import { deckOf } from "./deck-of.js"
import { defaultTheme, readTheme } from "./theme.js"
import { measure } from "./testing/doom-fixtures-art.js"
import { doomFromTree } from "./doom-tree.js"
import { isRefusal } from "./index.js"
import { resolveSlide } from "./resolve-slide.js"
import { hex, ids, sampleDeck, tryLand } from "./sample-deck.js"
import { textFromMarkdown } from "./markdown.js"

const { display: _, ...beforeDisplay } = defaultTheme.textStyles
const keynote = {
  ...beforeDisplay,
  title: { ...defaultTheme.textStyles.title, size: 88 },
  body: { ...defaultTheme.textStyles.body, size: 48 },
}

describe("a deck's theme", () => {
  it("keeps the sizes its stored theme names, whatever the default scale says", () => {
    const stored = readTheme({ ...defaultTheme, textStyles: keynote })
    if (isRefusal(stored)) throw new Error(JSON.stringify(stored))
    const { doom, slides } = doomFromTree({
      theme: stored,
      slides: [{ children: [{ type: "shape", props: { text: textFromMarkdown("Old deck", "title") } }] }],
    })
    expect(deckOf(doom).theme.textStyles.title.size).toBe(88)
    const [title] = resolveSlide(doom, slides[0]!, measure)
    expect(title!.text!.lines[0]!.runs[0]!.size).toBe(88)
  })

  it("reads a theme stored before a text style existed, taking only that style from the default scale", () => {
    const stored = readTheme({ ...defaultTheme, textStyles: keynote })
    expect(stored).toMatchObject({ textStyles: { ...keynote, display: defaultTheme.textStyles.display } })
  })

  it("uses fallback values for missing signed colors and keeps any saved signed color", () => {
    const { positive: _positive, total: _total, ...old } = defaultTheme.colors
    const negative = hex(0xa63678)
    expect(readTheme({ ...defaultTheme, colors: { ...old, negative } })).toEqual({
      ...defaultTheme,
      colors: { ...defaultTheme.colors, negative },
    })
  })

  it("preserves the fallback art", () => {
    expect(defaultTheme).toMatchObject({ colors: { accent1: hex(0x0b3a6f) }, fonts: { heading: "Inter" } })
  })

  it("refuses to unset a deck's theme, so no deck falls back to the default scale", () => {
    const refused = tryLand(sampleDeck(), [{ node: ids.deck, prop: "theme", value: null }])
    expect(refused).toMatchObject({ refused: "shape", node: ids.deck, prop: "theme" })
  })
})
