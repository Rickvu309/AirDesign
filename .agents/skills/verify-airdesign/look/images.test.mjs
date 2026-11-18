import { PNG } from "pngjs"
import { describe, expect, it, vi } from "vitest"
import { annotated, blank, copy, crop, inks, shrink } from "./images.mjs"

const at = (image, x, y) => [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)]

describe("images", () => {
  it("crops a finding's box with padding at the capture's scale", () => {
    const image = blank(200, 100)
    expect(crop(image, { x: 20, y: 10, width: 30, height: 10 }, 2, 5)).toMatchObject({ width: 80, height: 40 })
  })

  it("boxes a finding in its rank's color and leaves the rest of the page alone", () => {
    const image = blank(400, 300)
    const marked = annotated(image, [{ number: 1, rank: 1, box: { x: 50, y: 50, width: 40, height: 20 } }], 2)
    expect(at(marked, 100, 140)).toEqual(inks[1])
    expect(at(marked, 300, 250)).toEqual([255, 255, 255, 255])
    expect(at(image, 100, 140)).toEqual([255, 255, 255, 255])
  })

  it("copies every pixel without encoding a PNG, and drawing on the copy leaves the original alone", () => {
    const image = new PNG({ width: 3, height: 2 })
    image.data.set(Array.from({ length: 24 }, (_, index) => index * 10))
    const encode = vi.spyOn(PNG.sync, "write")
    const copied = copy(image)
    expect(encode).not.toHaveBeenCalled()
    encode.mockRestore()
    expect(copied).toMatchObject({ width: 3, height: 2 })
    expect([...copied.data]).toEqual([...image.data])
    copied.data.fill(0)
    expect(at(image, 2, 1)).toEqual([200, 210, 220, 230])
  })

  it("shrinks by averaging so a scale 2 capture becomes design size", () => {
    const image = new PNG({ width: 2, height: 2 })
    image.data.set([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255])
    expect(at(shrink(image, 2), 0, 0)).toEqual([128, 128, 128, 255])
  })
})
