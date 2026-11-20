import { expect, it } from "vitest"
import { fixedLineHeight, restyled } from "./text-restyle.js"
import { readTextValue, writeTextValue } from "./text-value.js"

const two = '[{"from":0,"lineHeight":150000,"runs":[{"from":0,"text":"a"}]},{"from":1,"runs":[{"from":0,"text":"b"}]}]'

it("keeps a paragraph's fixed line height in hundredths of a point", () => {
  const stored = '[{"from":0,"lineHeightPoints":2400,"runs":[{"from":0,"text":"a"}]}]'
  const read = readTextValue(stored)
  expect(read).toEqual([{ from: 0, lineHeightPoints: 2400, runs: [{ from: 0, text: "a" }] }])
  expect(read === null ? null : writeTextValue(read)).toBe(stored)
})

it("refuses a fixed line height PowerPoint cannot hold, or one beside a percent", () => {
  for (const points of [0, 99, 158_401, 12.5, "24"])
    expect(readTextValue(`[{"from":0,"lineHeightPoints":${JSON.stringify(points)},"runs":[]}]`)).toBeNull()
  expect(readTextValue('[{"from":0,"lineHeight":120000,"lineHeightPoints":2400,"runs":[]}]')).toBeNull()
})

it("fixes every paragraph's line height in points and drops its percent", () => {
  expect(readTextValue(fixedLineHeight(two, 2400))).toEqual([
    { from: 0, lineHeightPoints: 2400, runs: [{ from: 0, text: "a" }] },
    { from: 1, lineHeightPoints: 2400, runs: [{ from: 0, text: "b" }] },
  ])
  expect(readTextValue(fixedLineHeight("Plain", 1800))).toEqual([
    { from: 0, lineHeightPoints: 1800, runs: [{ from: 0, text: "Plain" }] },
  ])
})

it("drops a fixed line height when a percent is set, and keeps it when the type size changes", () => {
  const fixed = fixedLineHeight(two, 2400)
  expect(readTextValue(restyled(fixed, { lineHeight: 120_000 }))?.map((paragraph) => paragraph.lineHeight)).toEqual([
    120_000, 120_000,
  ])
  expect(readTextValue(restyled(fixed, { lineHeight: 120_000 }))?.some((p) => p.lineHeightPoints !== undefined)).toBe(
    false,
  )
  expect(readTextValue(restyled(fixed, { size: 4800 }))?.map((paragraph) => paragraph.lineHeightPoints)).toEqual([
    2400, 2400,
  ])
})
