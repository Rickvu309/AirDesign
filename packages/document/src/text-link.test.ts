import { expect, it } from "vitest"
import { linkRange, linkState, sameFormats } from "./text-format.js"
import { readTextValue, writeTextValue, type TextValue } from "./text-value.js"

it("links selected words without merging destinations and reports Mixed", () => {
  const value: TextValue = [{ from: 0, runs: [{ from: 0, text: "one two three" }] }]
  const link = { kind: "url", url: "https://example.com" } as const
  const range = { start: { paragraph: 0, offset: 4 }, end: { paragraph: 0, offset: 7 } }
  const next = linkRange(value, range, link)
  expect(next[0]?.runs.map((run) => [run.text, run.link])).toEqual([
    ["one ", undefined],
    ["two", link],
    [" three", undefined],
  ])
  expect(linkState(next, range)).toEqual(link)
  expect(linkState(next, null)).toBe("mixed")
  expect(readTextValue(writeTextValue(next))).toEqual(next)
  expect(sameFormats(next[0]!.runs[0]!, next[0]!.runs[1]!)).toBe(false)
  expect(linkState(linkRange(next, range, { kind: "none" }), range)).toEqual({ kind: "none" })
})
