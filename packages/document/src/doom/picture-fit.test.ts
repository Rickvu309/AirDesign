import { describe, expect, it } from "vitest"
import { pictureFit } from "./picture-fit.js"

describe("the size of a picture placed in an area", () => {
  it("keeps a small picture at its own size", () => {
    expect(pictureFit({ width: 400, height: 200 }, { w: 1920, h: 1080 })).toEqual({ w: 400, h: 200 })
  })

  it("scales a large picture down to fit, keeping its shape", () => {
    const fitted = pictureFit({ width: 4000, height: 3000 }, { w: 1920, h: 1080 })
    expect(fitted.h).toBe(1080)
    expect(fitted.w / fitted.h).toBeCloseTo(4 / 3, 2)
  })

  it("fits a wide picture to the width of a narrow area", () => {
    expect(pictureFit({ width: 3000, height: 1000 }, { w: 600, h: 600 })).toEqual({ w: 600, h: 200 })
  })

  it("never returns an empty size", () => {
    expect(pictureFit({ width: 0, height: 0 }, { w: 0, h: 0 })).toEqual({ w: 1, h: 1 })
  })
})
