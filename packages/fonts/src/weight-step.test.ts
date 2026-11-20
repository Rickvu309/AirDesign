import { expect, it } from "vitest"
import { listedStyles, steppedWeight } from "./weight-step.js"

const inter = [
  { style: "normal", weight: "100 900" },
  { style: "italic", weight: "100 900" },
]

it("lists a served family's styles once its faces load, and Regular and Bold with italics otherwise", () => {
  expect(listedStyles("Inter", () => inter)).toHaveLength(18)
  expect(listedStyles("Inter", () => undefined)).toEqual([
    { weight: 400, italic: false },
    { weight: 400, italic: true },
    { weight: 700, italic: false },
    { weight: 700, italic: true },
  ])
  const asked: string[] = []
  expect(listedStyles("Arial", (family) => (asked.push(family), inter))).toHaveLength(4)
  expect(asked).toEqual([])
})

it("steps to the next weight in the same slant and stops at either end", () => {
  const styles = listedStyles("Inter", () => [{ style: "normal", weight: "300 700" }])
  expect(steppedWeight({ weight: 400, italic: false }, styles, 1)).toEqual({ weight: 500, italic: false })
  expect(steppedWeight({ weight: 300, italic: false }, styles, -1)).toBeNull()
  expect(steppedWeight({ weight: 700, italic: false }, styles, 1)).toBeNull()
  expect(steppedWeight({ weight: 400, italic: true }, styles, 1)).toBeNull()
})
