import { mediaSize, mediaTypeOf } from "@airdesign/document"
import { drawablePicture } from "./picture-drawable.js"
import { encodeUtf8 } from "./package-bytes.js"
import { markupDocument } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"

export function rasterDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const media = mediaSize(bytes)
  if (media !== null) return { width: media.width, height: media.height }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0
  let height = 0
  const raster = mediaTypeOf(bytes) !== null
  if (!raster && bytes.length >= 26 && view.getUint16(0) === 0x424d) {
    width = view.getInt32(18, true)
    height = Math.abs(view.getInt32(22, true))
  } else if (!raster && bytes.find((byte) => ![9, 10, 13, 32].includes(byte)) === 60) {
    const svg = markupDocument(bytes).elements.find((element) => element.kind === "svg")
    const box = svg === undefined ? [] : (paintAttribute(svg, "viewBox") ?? "").trim().split(/[ ,]+/).map(Number)
    width = box[2] ?? Number.parseFloat(svg === undefined ? "" : (paintAttribute(svg, "width") ?? ""))
    height = box[3] ?? Number.parseFloat(svg === undefined ? "" : (paintAttribute(svg, "height") ?? ""))
  }
  if (width === 0 && height === 0) {
    const drawn = drawablePicture(bytes)
    if (drawn !== null) return rasterDimensions(typeof drawn.data === "string" ? encodeUtf8(drawn.data) : drawn.data)
  }
  return width > 0 && height > 0 ? { width, height } : null
}
