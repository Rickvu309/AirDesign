import { markupDocument } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"

export const childOrder = {
  "p:spPr": [
    "a:xfrm",
    "a:custGeom",
    "a:prstGeom",
    "a:noFill",
    "a:solidFill",
    "a:gradFill",
    "a:blipFill",
    "a:pattFill",
    "a:grpFill",
    "a:ln",
    "a:effectLst",
    "a:effectDag",
    "a:scene3d",
    "a:sp3d",
    "a:extLst",
  ],
  "p:txBody": ["a:bodyPr", "a:lstStyle", "a:p"],
  "a:p": ["a:pPr", "a:r", "a:br", "a:fld", "a:endParaRPr"],
  "a:rPr": [
    "a:ln",
    "a:noFill",
    "a:solidFill",
    "a:gradFill",
    "a:blipFill",
    "a:pattFill",
    "a:grpFill",
    "a:effectLst",
    "a:effectDag",
    "a:highlight",
    "a:uLnTx",
    "a:uLn",
    "a:uFillTx",
    "a:uFill",
    "a:latin",
    "a:ea",
    "a:cs",
    "a:sym",
    "a:hlinkClick",
    "a:hlinkMouseOver",
    "a:rtl",
    "a:extLst",
  ],
} as const

export type OrderedParent = keyof typeof childOrder
export type ChildOf<P extends OrderedParent> = (typeof childOrder)[P][number]

function rank(parent: OrderedParent, tag: string): number {
  const order: readonly string[] = childOrder[parent]
  const index = order.indexOf(tag)
  if (index < 0) throw new Error(`${parent} ${tag}`)
  return index
}

export function insertChild<P extends OrderedParent>(
  parent: P,
  tag: ChildOf<P>,
  element: string,
  parentXml: string,
): string {
  const parentBytes = encodeUtf8(parentXml)
  const parentDocument = markupDocument(parentBytes)
  const roots = parentDocument.elements.filter((item) => item.parent < 0)
  const root = roots[0]
  if (
    !parentDocument.wellFormed ||
    roots.length !== 1 ||
    root === undefined ||
    root.kind !== parent ||
    root.start !== 0
  ) {
    throw new Error(`parent ${parent}`)
  }
  if (root.selfClosing) throw new Error(`empty ${parent}`)
  if (root.end !== parentBytes.length) throw new Error(`trailing ${parent}`)
  const elementBytes = encodeUtf8(element)
  const elementDocument = markupDocument(elementBytes)
  const elementRoots = elementDocument.elements.filter((item) => item.parent < 0)
  const elementRoot = elementRoots[0]
  if (
    !elementDocument.wellFormed ||
    elementRoots.length !== 1 ||
    elementRoot === undefined ||
    elementRoot.kind !== tag ||
    elementRoot.start !== 0 ||
    elementRoot.end !== elementBytes.length
  ) {
    throw new Error(`element ${tag}`)
  }
  const insertRank = rank(parent, tag)
  let at = root.openEnd
  for (const child of parentDocument.elements) {
    if (child.parent !== root.index) continue
    if (rank(parent, child.kind) <= insertRank) at = child.end
  }
  const merged = new Uint8Array(at + elementBytes.length + parentBytes.length - at)
  merged.set(parentBytes.subarray(0, at), 0)
  merged.set(elementBytes, at)
  merged.set(parentBytes.subarray(at), at + elementBytes.length)
  return decodeUtf8(merged)
}
