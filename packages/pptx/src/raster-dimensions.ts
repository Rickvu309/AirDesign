import { markupDocument } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import { decodeUtf8 } from "./package-bytes.js"

export function rasterDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0
  let height = 0
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47) {
    width = view.getUint32(16)
    height = view.getUint32(20)
  } else if (bytes.length >= 10 && decodeUtf8(bytes.subarray(0, 3)) === "GIF") {
    width = view.getUint16(6, true)
    height = view.getUint16(8, true)
  } else if (bytes.length >= 4 && view.getUint16(0) === 0xffd8) {
    let at = 2
    while (at + 4 <= bytes.length) {
      if (bytes[at] !== 0xff) break
      const marker = bytes[at + 1] ?? 0
      const length = view.getUint16(at + 2)
      if (length < 2 || at + 2 + length > bytes.length) break
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) &&
        length >= 7
      ) {
        height = view.getUint16(at + 5)
        width = view.getUint16(at + 7)
        break
      }
      at += 2 + length
    }
  } else {
    const svg = markupDocument(bytes).elements.find((element) => element.kind === "svg")
    const box = svg === undefined ? [] : (paintAttribute(svg, "viewBox") ?? "").trim().split(/[ ,]+/).map(Number)
    width = box[2] ?? 0
    height = box[3] ?? 0
  }
  return width > 0 && height > 0 ? { width, height } : null
}
