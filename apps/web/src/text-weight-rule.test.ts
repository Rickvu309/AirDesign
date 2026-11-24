import { describe, expect, it } from "vitest"

const sources: Readonly<Record<string, string>> = import.meta.glob(
  [
    "./**/*.{ts,tsx}",
    "../../../packages/{doom,render}/src/**/*.{ts,tsx}",
    "!./**/*.test.{ts,tsx}",
    "!../../../packages/*/src/**/*.test.{ts,tsx}",
    "!./screens/**",
  ],
  { query: "?raw", import: "default", eager: true },
)

const guessesWeight = /\b(?:style|look)\.weight\s*(?:>=|<=|>|<)(?!=)/
const readsPaintedFace = "packages/doom/src/painted-face.ts"
const estimate = "packages/doom/src/text-estimate.ts"

describe("a text's weight is read in one place", () => {
  it("compares a text style's weight only in paintedFace, which paint, measure, the panel, PDF and Ctrl+B all ask", () => {
    const loose = Object.entries(sources)
      .map(([path, text]) => [path.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "apps/web/src/"), text] as const)
      .filter(([path, text]) => path !== readsPaintedFace && path !== estimate && guessesWeight.test(text))
      .map(([path]) => `${path}: ask paintedFace for the weight the canvas paints instead of comparing a style weight`)
    expect(loose).toEqual([])
  })
})
