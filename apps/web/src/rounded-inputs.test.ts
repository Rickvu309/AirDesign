import { describe, expect, it } from "vitest"

const sources: Readonly<Record<string, string>> = import.meta.glob(
  ["./**/*.tsx", "!./**/*.test.tsx", "!./screens/**"],
  { query: "?raw", import: "default", eager: true },
)

const typesNumbers = /<input\b[^>]*(?:inputMode="(?:decimal|numeric)"|type="number")|<input\b(?=[\s\S]{0,400}?\bvalue=)/
const rounds = /Math\.round\(|\.toFixed\(/
const helper = '"@/design/shown-number"'

describe("a number field writes only what a person changed", () => {
  it("rounds what it shows only through the shown-number helper, so untouched text never writes back", () => {
    const loose = Object.entries(sources)
      .filter(([, text]) => typesNumbers.test(text) && rounds.test(text) && !text.includes(helper))
      .map(
        ([path]) =>
          `apps/web/src/${path.slice(2)}: round its display with roundedShown and commit through untouched from ${helper}`,
      )
    expect(loose).toEqual([])
  })
})
