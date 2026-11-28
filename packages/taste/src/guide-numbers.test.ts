import { deckOf, doomFromTree, type TextStyleName, type Theme } from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { guides, newDeckTheme, problemRules, styles, styleText } from "./index.js"

const slide = deckOf(doomFromTree({ theme: newDeckTheme, slides: [] }).doom).size

type Stated = { readonly where: string; readonly text: string; readonly theme?: Theme }
type Claim = {
  readonly claim: string
  readonly says: RegExp
  readonly in: readonly Stated[]
  readonly code: (match: RegExpMatchArray, stated: Stated) => readonly (number | undefined)[]
}

const guideText: readonly Stated[] = guides().map((each) => ({ where: each.name, text: each.markdown }))

const claims: readonly Claim[] = [
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
  ...styles.map(({ id, theme, variants }): Claim => ({
    claim: `${id} text style sizes`,
    says: /`(\w+)`[^`\n.]*? at (\d+)\b/g,
    in: styleText(id)!
      .markdown.split("\n")
      .map((line) => {
        const variant = variants.find(({ name }) => line.trimStart().startsWith(`- \`${name}\`:`))
        return {
          where: `styles/${id}${variant === undefined ? "" : ` ${variant.name}`}`,
          text: line,
          theme: variant?.theme ?? theme,
        }
      }),
    code: ([, name], stated) => [stated.theme?.textStyles[name as TextStyleName]?.size],
  })),
]

describe("numbers the guides share with code", () => {
  it.each(claims)("states $claim as code holds it", ({ says, in: texts, code }) => {
    const stated = texts.flatMap((text) => [...text.text.matchAll(says)].map((match) => ({ text, match })))
    expect(stated.length).toBeGreaterThan(0)
    for (const { text, match } of stated) {
      const numbers = match
        .slice(1)
        .filter((part) => /^\d+$/.test(part))
        .map(Number)
      expect(numbers, `${text.where}: "${match[0]}"`).toEqual(code(match, text))
    }
  })
})
