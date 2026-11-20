import { spliceBytes } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { insertAt, moveBytes, requireMarkup } from "./part-markup.js"
import { nextShapeId } from "./shape-id.js"
import { shapeById } from "./shape-tree.js"

function replaceShapeId(piece: Uint8Array, from: string, to: string): Uint8Array {
  const document = requireMarkup(piece)
  const mark = document.elements.find((element) => element.kind === "p:cNvPr" && element.id === from)
  if (mark === undefined) throw new Error("shape")
  const id = mark.attributes.find((item) => item.name === "id")
  if (id === undefined) throw new Error("shape")
  return spliceBytes(piece, [{ start: id.valueStart, end: id.valueEnd, next: encodeUtf8(to) }])
}

export function orderShape(bytes: Uint8Array, shape: string, before: string): Uint8Array {
  if (shape === before) throw new Error("shape")
  const document = requireMarkup(bytes)
  return moveBytes(bytes, shapeById(document.elements, shape), shapeById(document.elements, before))
}

export function cloneShape(bytes: Uint8Array, shape: string, id?: number): Uint8Array {
  const document = requireMarkup(bytes)
  const found = shapeById(document.elements, shape)
  let piece: Uint8Array = new Uint8Array(bytes.subarray(found.start, found.end))
  const marks = requireMarkup(piece).elements.filter((element) => element.kind === "p:cNvPr" && element.id !== null)
  let next = Math.max(nextShapeId(decodeUtf8(bytes)), id === undefined ? 0 : id + 1)
  for (const mark of marks.slice().reverse()) {
    if (mark.id === null) continue
    piece = replaceShapeId(piece, mark.id, String(id !== undefined && mark.id === shape ? id : next))
    if (id === undefined || mark.id !== shape) next += 1
  }
  return insertAt(bytes, found.end, piece)
}
