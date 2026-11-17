import { openRegister } from "@airdesign/document"
import { expect, it } from "vitest"
import { bakePixels, bakeTouchedPictures, type BakeBox } from "./picture-bake"
import type { PictureImage } from "@/picture-fill"

const box: BakeBox = { width: 4_572_000, height: 3_048_000 }
const halfBlack = "00000080"

function image(extra: Partial<PictureImage> = {}): PictureImage {
  return {
    part: "ppt/media/a.png",
    contentType: "image/png",
    crop: { left: 0, top: 0, right: 0, bottom: 0 },
    tile: false,
    ...extra,
  }
}

it("sizes a baked picture from the frame, then the source, and caps the long side", () => {
  const plain = bakePixels(image(), box, { width: 1, height: 1 })
  expect(plain.width).toBe(960)
  expect(plain.height).toBe(640)
  expect(plain.draw).toEqual({ tile: false, x: 0, y: 0, width: 960, height: 640 })
  expect(plain.blur).toBe(0)
  const cropped = bakePixels(image({ crop: { left: 0.25, top: 0, right: 0.25, bottom: 0 } }), box, {
    width: 100,
    height: 50,
  })
  expect(cropped.draw).toEqual({ tile: false, x: -480, y: 0, width: 1920, height: 640 })
  const tiled = bakePixels(image({ tile: true }), box, { width: 10, height: 20 })
  expect(tiled.draw).toEqual({ tile: true, stepX: 20, stepY: 40 })
  const blurred = bakePixels(image({ blur: 20, overlay: { hex: "000000", alpha: 0.5 }, alpha: 0.6 }), box, {
    width: 1,
    height: 1,
  })
  expect(blurred.blur).toBe(40)
  expect(blurred.overlay).toBe(`#${halfBlack}`)
  expect(blurred.alpha).toBe(0.6)
  const capped = bakePixels(image(), { width: 914_400, height: 914_400 }, { width: 10_000, height: 10_000 })
  expect(capped.width).toBe(4096)
  expect(capped.height).toBe(4096)
})

it("leaves a deck alone when nobody set a blur or a colour overlay", async () => {
  const parts = new Map([["ppt/slides/slide1.xml", new Uint8Array([1])]])
  expect(await bakeTouchedPictures(parts, openRegister("", "clean"))).toBe(parts)
})
