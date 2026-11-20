import type { TextRun, TextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { styledRun, weightState } from "./run-style.js"

const plain = { typeface: "Inter", bold: false, italic: false }
const file = () => plain
const run = (more: Partial<TextRun> = {}): TextRun => ({ from: 0, text: "A", ...more })
const title: TextValue = [
  {
    from: 0,
    runs: [
      { from: 0, text: "Introduction", font: "Inter SemiBold" },
      { from: 1, text: " to Heat Pumps" },
    ],
  },
]
const word = { start: { paragraph: 0, offset: 0 }, end: { paragraph: 0, offset: 12 } }
const rest = { start: { paragraph: 0, offset: 13 }, end: { paragraph: 0, offset: 26 } }

it("reads the weight of the selected words", () => {
  expect(weightState(title, word, file)).toEqual({ weight: 600, italic: false })
  expect(weightState(title, rest, file)).toEqual({ weight: 400, italic: false })
  expect(weightState(title, null, file)).toBe("mixed")
})

it("reads a template font token and the bold flag", () => {
  const themed: TextValue = [{ from: 0, runs: [{ from: 0, text: "Hi", font: "+mn-lt", bold: true, italic: true }] }]
  expect(weightState(themed, null, file, { "+mn-lt": "Inter" })).toEqual({ weight: 700, italic: true })
})

it("sets a run to a weight as a named face or the bold flag", () => {
  expect(styledRun(run(), plain, { weight: 600, italic: false })).toEqual(run({ font: "Inter SemiBold" }))
  expect(styledRun(run({ font: "Inter SemiBold" }), plain, { weight: 700, italic: false })).toEqual(
    run({ font: "Inter", bold: true }),
  )
  expect(styledRun(run({ bold: true }), plain, { weight: 400, italic: true })).toEqual(
    run({ bold: false, italic: true }),
  )
  expect(styledRun(run({ font: "+mn-lt" }), plain, { weight: 700, italic: false }, { "+mn-lt": "Inter" })).toEqual(
    run({ font: "+mn-lt", bold: true }),
  )
})
