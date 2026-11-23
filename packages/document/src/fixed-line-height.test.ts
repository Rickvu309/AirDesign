import { expect, it } from "vitest"
import { readTextValue, writeTextValue } from "./text-value.js"

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
