import { expect, test } from "vitest"
import { gridAddFits } from "./grid-add-placement"

test("each slide dimension and both gaps must fit the screen-sized add mark", () => {
  const exact = { width: 192, height: 108, columnGap: 24, rowGap: 61.56 }
  expect(gridAddFits(exact)).toBe(true)
  expect(gridAddFits({ ...exact, columnGap: 23.99 })).toBe(false)
  expect(gridAddFits({ ...exact, rowGap: 23.99 })).toBe(false)
  expect(gridAddFits({ ...exact, height: 23.99 })).toBe(false)
  expect(gridAddFits({ ...exact, width: 23.99 })).toBe(false)
})
