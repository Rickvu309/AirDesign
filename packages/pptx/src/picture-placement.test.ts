import { expect, it } from "vitest"
import { picturePlacement } from "./picture-placement.js"

it("covers or contains without distorting the picture", () => {
  expect(picturePlacement("fill", { width: 200, height: 100 }, { width: 100, height: 100 })).toEqual({
    l: -50000,
    t: 0,
    r: -50000,
    b: 0,
  })
  expect(picturePlacement("fit", { width: 200, height: 100 }, { width: 100, height: 100 })).toEqual({
    l: 0,
    t: 25000,
    r: 0,
    b: 25000,
  })
  expect(picturePlacement("fit", { width: 100, height: 200 }, { width: 100, height: 100 })).toEqual({
    l: 25000,
    t: 0,
    r: 25000,
    b: 0,
  })
})
