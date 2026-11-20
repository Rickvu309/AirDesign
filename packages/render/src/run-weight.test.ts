import type { TextRun } from "@airdesign/document"
import { expect, it } from "vitest"
import { weightedRun } from "./run-weight.js"

const inter = [
  { style: "normal", weight: "100 900" },
  { style: "italic", weight: "100 900" },
]
const faces = (family: string) => (family === "Inter" ? inter : undefined)
const plain = { typeface: "Inter", bold: false, italic: false }
const run = (more: Partial<TextRun> = {}): TextRun => ({ from: 0, text: "A", ...more })

it("steps a run to the family's next weight, as a named face or the bold flag", () => {
  expect(weightedRun(run(), plain, 1, faces)).toEqual(run({ font: "Inter Medium" }))
  expect(weightedRun(run({ font: "Inter SemiBold" }), plain, 1, faces)).toEqual(run({ font: "Inter", bold: true }))
  expect(weightedRun(run({ bold: true }), plain, 1, faces)).toEqual(run({ font: "Inter ExtraBold", bold: false }))
  expect(weightedRun(run({ font: "Inter Light", italic: true }), plain, -1, faces)).toEqual(
    run({ font: "Inter ExtraLight", italic: true }),
  )
})

it("keeps a run at either end, and steps a family with no served faces between Regular and Bold", () => {
  const black = run({ font: "Inter Black" })
  expect(weightedRun(black, plain, 1, faces)).toBe(black)
  expect(weightedRun(run(), { ...plain, typeface: "Arial" }, 1, faces)).toEqual(run({ bold: true }))
  expect(weightedRun(run({ bold: true }), { ...plain, typeface: "Arial" }, 1, faces)).toEqual(run({ bold: true }))
})

it("keeps a template font token when the step lands on Regular or Bold", () => {
  const themed = run({ font: "+mn-lt" })
  expect(weightedRun(themed, plain, 1, faces, { "+mn-lt": "Inter" })).toEqual(run({ font: "Inter Medium" }))
  expect(weightedRun(run({ font: "+mn-lt", bold: true }), plain, -1, faces, { "+mn-lt": "Inter" })).toEqual(
    run({ font: "Inter SemiBold", bold: false }),
  )
  expect(
    weightedRun(run({ font: "+mn-lt" }), { ...plain, typeface: "Arial" }, 1, faces, { "+mn-lt": "Arial" }),
  ).toEqual(run({ font: "+mn-lt", bold: true }))
})
