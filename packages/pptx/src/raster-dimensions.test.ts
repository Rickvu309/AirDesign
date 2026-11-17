import { expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { rasterDimensions } from "./raster-dimensions.js"

it("reads PNG, GIF and JPEG dimensions without decoding pixels", () => {
  const png = new Uint8Array(24)
  const view = new DataView(png.buffer)
  view.setUint32(0, 0x89504e47)
  view.setUint32(16, 200)
  view.setUint32(20, 100)
  expect(rasterDimensions(png)).toEqual({ width: 200, height: 100 })
  expect(rasterDimensions(new Uint8Array([...encodeUtf8("GIF89a"), 200, 0, 100, 0]))).toEqual({
    width: 200,
    height: 100,
  })
  expect(rasterDimensions(new Uint8Array([255, 216, 255, 192, 0, 7, 8, 0, 100, 0, 200]))).toEqual({
    width: 200,
    height: 100,
  })
  expect(rasterDimensions(new Uint8Array([255, 216, 255, 192, 0, 7]))).toBeNull()
})

it("reads SVG dimensions through its native viewBox", () => {
  expect(rasterDimensions(encodeUtf8('<svg viewBox="0 0 200 100"/>'))).toEqual({ width: 200, height: 100 })
  expect(rasterDimensions(new Uint8Array())).toBeNull()
})
