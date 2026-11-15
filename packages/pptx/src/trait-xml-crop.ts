import { fillWritten } from "./blip-edit.js"
import { spliceBytes, type ByteEdit } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { shownCrop, type CropRect } from "./picture-read.js"
import { whole, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

const sides = ["l", "t", "r", "b"] as const

function rectXml(rect: CropRect): string {
  const named = sides.filter((side) => rect[side] !== 0).map((side) => ` ${side}="${String(rect[side])}"`)
  return named.length === 0 ? "" : `<a:srcRect${named.join("")}/>`
}

function writtenCrop(parts: Parts, at: ElementAt, rect: CropRect): Parts {
  return fillWritten(parts, at, (found) => {
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

export const cropXml: TraitXml<"crop"> = {
  slot: null,
  fields: { rect: whole({ read: shownCrop, write: writtenCrop }) },
}
