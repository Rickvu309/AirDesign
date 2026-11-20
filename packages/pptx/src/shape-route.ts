import { spliceBytes } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { insertAt, moveBytes, requireMarkup } from "./part-markup.js"
import { copyName } from "./layer-names.js"
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

export function copyNamed(piece: Uint8Array, shape: string): Uint8Array {
  const mark = requireMarkup(piece).elements.find((element) => element.kind === "p:cNvPr" && element.id === shape)
  const name = mark?.attributes.find((item) => item.name === "name")
  if (name === undefined || copyName(name.value, shape) === name.value) return piece
  const next = encodeUtf8(copyName(name.value, shape))
  return spliceBytes(piece, [{ start: name.valueStart, end: name.valueEnd, next }])
}

export function orderShape(bytes: Uint8Array, shape: string, before: string): Uint8Array {
  if (shape === before) throw new Error("shape")
  const document = requireMarkup(bytes)
  return moveBytes(bytes, shapeById(document.elements, shape), shapeById(document.elements, before))
}

const connectionEnds = new Set(["a:stCxn", "a:endCxn"])

function reconnected(piece: Uint8Array, copies: ReadonlyMap<string, string>): Uint8Array {
  const edits = requireMarkup(piece).elements.flatMap((element) => {
    if (!connectionEnds.has(element.kind)) return []
    const id = element.attributes.find((item) => item.name === "id")
    const copy = id === undefined ? undefined : copies.get(id.value)
    return id === undefined || copy === undefined
      ? []
      : [{ start: id.valueStart, end: id.valueEnd, next: encodeUtf8(copy) }]
  })
  return spliceBytes(piece, edits)
}

export function cloneShape(
  bytes: Uint8Array,
  shape: string,
  id?: number,
  ids: ReadonlyMap<string, number> = new Map(),
): Uint8Array {
  const document = requireMarkup(bytes)
  const found = shapeById(document.elements, shape)
  let piece: Uint8Array = new Uint8Array(bytes.subarray(found.start, found.end))
  const marks = requireMarkup(piece).elements.filter((element) => element.kind === "p:cNvPr" && element.id !== null)
  const named = [...ids.values(), ...(id === undefined ? [] : [id])]
  let next = Math.max(nextShapeId(decodeUtf8(bytes)), ...named.map((each) => each + 1))
  const copies = new Map<string, string>()
  for (const mark of marks.slice().reverse()) {
    if (mark.id === null) continue
    const given = id !== undefined && mark.id === shape ? id : ids.get(mark.id)
    const copy = given ?? next
    piece = replaceShapeId(piece, mark.id, String(copy))
    copies.set(mark.id, String(copy))
    if (given === undefined) next += 1
  }
  const top = copies.get(shape)
  const renamed = top === undefined ? piece : copyNamed(piece, top)
  return insertAt(bytes, found.end, reconnected(renamed, copies))
}
