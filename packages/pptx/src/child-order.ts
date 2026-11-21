import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { shapePart } from "./shape-id.js"

const lineChildren = [
  "a:noFill",
  "a:solidFill",
  "a:gradFill",
  "a:pattFill",
  "a:prstDash",
  "a:custDash",
  "a:round",
  "a:bevel",
  "a:miter",
  "a:headEnd",
  "a:tailEnd",
  "a:extLst",
] as const

export const childOrder = {
  "p:sp": ["p:nvSpPr", "p:spPr", "p:style", "p:txBody", "p:extLst"],
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
  "a:ln": lineChildren,
  "a:lnL": lineChildren,
  "a:lnR": lineChildren,
  "a:lnT": lineChildren,
  "a:lnB": lineChildren,
  "a:tc": ["a:txBody", "a:tcPr", "a:extLst"],
  "a:tcPr": [
    "a:lnL",
    "a:lnR",
    "a:lnT",
    "a:lnB",
    "a:lnTlToBr",
    "a:lnBlToTr",
    "a:cell3D",
    "a:noFill",
    "a:solidFill",
    "a:gradFill",
    "a:blipFill",
    "a:pattFill",
    "a:grpFill",
    "a:headers",
    "a:extLst",
  ],
  "p:grpSpPr": [
    "a:xfrm",
    "a:noFill",
    "a:solidFill",
    "a:gradFill",
    "a:blipFill",
    "a:pattFill",
    "a:grpFill",
    "a:effectLst",
    "a:effectDag",
    "a:scene3d",
    "a:extLst",
  ],
  "a:effectLst": [
    "a:blur",
    "a:fillOverlay",
    "a:glow",
    "a:innerShdw",
    "a:outerShdw",
    "a:prstShdw",
    "a:reflection",
    "a:softEdge",
  ],
  "p:txBody": ["a:bodyPr", "a:lstStyle", "a:p"],
  "a:bodyPr": [
    "a:prstTxWarp",
    "a:noAutofit",
    "a:normAutofit",
    "a:spAutoFit",
    "a:scene3d",
    "a:sp3d",
    "a:flatTx",
    "a:extLst",
  ],
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

const branchKinds = new Set(["mc:Choice", "mc:Fallback"])
const runKinds = new Set(["a:r", "a:br", "a:fld"])
const branchRanks = new Map<string, ReadonlyMap<string, number>>(
  Object.entries(childOrder).map(([parent, order]) => [parent, new Map(order.map((tag, position) => [tag, position]))]),
)

const checkedParts = new WeakMap<Uint8Array, readonly string[]>()

function partBranchOrderErrors(part: string, bytes: Uint8Array): readonly string[] {
  const checked = checkedParts.get(bytes)
  if (checked !== undefined) return checked
  const elements = markupDocument(bytes).elements
  const inside = new Set<number>()
  const reached = new Map<number, { readonly kind: string; readonly rank: number }>()
  const errors: string[] = []
  for (const element of elements) {
    const parent = elements[element.parent]
    const parentInside = parent !== undefined && inside.has(parent.index)
    if (parentInside || branchKinds.has(element.kind)) inside.add(element.index)
    if (!parentInside || parent === undefined) continue
    const rank = branchRanks.get(parent.kind)?.get(runKinds.has(element.kind) ? "a:r" : element.kind)
    if (rank === undefined) continue
    const before = reached.get(parent.index)
    if (before !== undefined && rank < before.rank) {
      errors.push(`Order: ${element.kind} after ${before.kind} in ${parent.kind} of a markup branch /${part}`)
      continue
    }
    reached.set(parent.index, { kind: element.kind, rank })
  }
  checkedParts.set(bytes, errors)
  return errors
}

export function branchOrderErrors(parts: ReadonlyMap<string, Uint8Array>): readonly string[] {
  const errors: string[] = []
  for (const [part, bytes] of parts) {
    if (shapePart.test(part)) errors.push(...partBranchOrderErrors(part, bytes))
  }
  return errors
}

export function insertChildAt<P extends OrderedParent>(
  parent: P,
  tag: ChildOf<P>,
  host: MarkupElement,
  children: readonly MarkupElement[],
): number {
  const insertRank = rank(parent, tag)
  let at = host.openEnd
  for (const child of children) {
    if (rank(parent, child.kind) <= insertRank) at = child.end
  }
  return at
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
