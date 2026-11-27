import { deckOf, doomFromTree, type TextStyleName } from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { guides, newDeckTheme, problemRules, style, styles, styleText } from "./index.js"

const slide = deckOf(doomFromTree({ theme: newDeckTheme, slides: [] }).doom).size

const guideText = guides().map((each) => ({ where: each.name, text: each.markdown }))

const claims = [
  {
    claim: "the readable floor",
    says: /\b(?:nothing|no text) (?:under|below|smaller than) (\d+) ?px/gi,
    in: guideText,
    code: () => [problemRules.readable],
  },
  {
    claim: "the slide size",
    says: /\b(\d+) by (\d+) slide/gi,
    in: guideText,
    code: () => [slide.w, slide.h],
  },
  ...styles.map(({ id }) => ({
    claim: `${id} text style sizes`,
    says: /`(\w+)`[^`\n.]*? at (\d+)\b/g,
    in: [{ where: `styles/${id}`, text: styleText(id)!.markdown }],
    code: ([, name]: RegExpMatchArray) => [style(id)!.theme.textStyles[name as TextStyleName]?.size],
  })),
]

describe("numbers the guides share with code", () => {
  it.each(claims)("states $claim as code holds it", ({ says, in: texts, code }) => {
    const stated = texts.flatMap(({ where, text }) => [...text.matchAll(says)].map((match) => ({ where, match })))
    expect(stated.length).toBeGreaterThan(0)
    for (const { where, match } of stated) {
      const numbers = match
        .slice(1)
        .filter((part) => /^\d+$/.test(part))
        .map(Number)
      expect(numbers, `${where}: "${match[0]}"`).toEqual(code(match))
    }
  })
})
