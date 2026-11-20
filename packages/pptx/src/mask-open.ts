import { spliceBytes, type ByteEdit } from "./element-span.js"
import { attributeEdit } from "./markup-attribute.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"
import { requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { xmlAttribute, xmlText } from "./shape-write.js"

const slideFile = /^ppt\/slides\/slide\d+\.xml$/

function opened(bytes: Uint8Array): Uint8Array {
  const { elements } = requireMarkup(bytes)
  const stands = elements.filter((each) => each.kind === "adm:stand")
  if (stands.length === 0) return bytes
  const edits: ByteEdit[] = []
  for (const stand of stands) {
    const digest = paintAttribute(stand, "digest") ?? ""
    const picture = paintAttribute(stand, "picture")
    let markup = ""
    if (picture !== null) {
      try {
        const shape = shapeById(elements, picture)
        if (shape.kind === "p:pic") {
          markup = decodeUtf8(bytes.subarray(shape.start, shape.end))
          edits.push({ start: shape.start, end: shape.end, next: new Uint8Array() })
        }
      } catch {
        markup = ""
      }
    }
    for (const id of (paintAttribute(stand, "hid") ?? "").split(" ")) {
      const identity = elements.find((each) => each.kind === "p:cNvPr" && each.id === id)
      const edit = identity === undefined ? null : attributeEdit(bytes, identity, "hidden", null)
      if (edit !== null) edits.push(edit)
    }
    const cache = `<adm:baked digest="${xmlAttribute(digest)}">${xmlText(markup)}</adm:baked>`
    edits.push({ start: stand.start, end: stand.end, next: encodeUtf8(cache) })
  }
  return spliceBytes(bytes, edits)
}

export function openedMasks(parts: ReadonlyMap<string, Uint8Array>): ReadonlyMap<string, Uint8Array> {
  let next: Map<string, Uint8Array> | null = null
  for (const [part, bytes] of parts) {
    if (!slideFile.test(part)) continue
    const written = opened(bytes)
    if (written === bytes) continue
    next ??= new Map(parts)
    next.set(part, written)
  }
  return next ?? parts
}
