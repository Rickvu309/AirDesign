import { fillWritten } from "./blip-edit.js"
import { spliceBytes, type ByteEdit } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { shownCrop, type CropRect } from "./picture-read.js"
import { whole, type ElementAt, type Parts } from "./xml-codec.js"

import { srcRectXml, writtenPictureMode } from "./picture-mode.js"

const sides = ["l", "t", "r", "b"] as const

function rectXml(rect: CropRect): string {
  return sides.some((side) => rect[side] !== 0) ? srcRectXml(rect) : ""
}

function writtenCrop(parts: Parts, at: ElementAt, rect: CropRect): Parts {
  return fillWritten(writtenPictureMode(parts, at, "crop"), at, (found) => {
    const inside = found.children[found.fill.index] ?? []
    const held = inside.find((each) => each.kind === "a:srcRect")
    const xml = encodeUtf8(rectXml(rect))
    let edit: ByteEdit
    if (held !== undefined) edit = { start: held.start, end: held.end, next: xml }
    else if (found.fill.selfClosing)
      edit = {
        start: found.fill.openEnd - 2,
        end: found.fill.openEnd,
        next: encodeUtf8(`>${rectXml(rect)}</p:blipFill>`),
      }
    else {
      const at = found.blip === undefined ? found.fill.openEnd : found.blip.end
      edit = { start: at, end: at, next: xml }
    }
    return spliceBytes(found.bytes, [edit])
  })
}

export const cropFieldXml = whole({ read: shownCrop, write: writtenCrop })
