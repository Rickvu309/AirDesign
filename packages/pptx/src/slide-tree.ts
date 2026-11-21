import { effectsUri } from "./effects-extension.js"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"
import { declaresRelationshipsBytes } from "./picture-write.js"
import { shapeIdsIn } from "./shape-id.js"
import { isShapeTag, shapeTags } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"

export type LeafNode = {
  readonly kind: "leaf"
  readonly id: string | null
  parent: GroupNode | null
  bytes: Uint8Array
  hasPicture: boolean
}

export type GroupNode = {
  readonly kind: "group"
  readonly id: string | null
  parent: GroupNode | null
  open: Uint8Array
  items: Segment[]
  close: Uint8Array
  hasPicture: boolean
}

export type RawSegment = {
  readonly kind: "raw"
  bytes: Uint8Array
}

export type Segment = LeafNode | GroupNode | RawSegment

export type ShapeNode = LeafNode | GroupNode

export type SlideTree = {
  readonly part: string
  readonly original: Uint8Array
  readonly shellPrefix: Uint8Array
  readonly shellSuffix: Uint8Array
  readonly stubPrefix: Uint8Array
  readonly stubSuffix: Uint8Array
  readonly items: Segment[]
  readonly byId: Map<string, ShapeNode>
  readonly idCounts: Map<string, number>
  readonly allIds: Set<string>
  readonly declaresRelationships: boolean
  readonly hasTiming: boolean
  hasConnections: boolean
  dirty: boolean
}

export type ShapeStub = {
  readonly prefix: Uint8Array
  readonly suffix: Uint8Array
  readonly stub: Uint8Array
}

export const groupSentinel = encodeUtf8("<!--__ad_children__-->")
const minimalShellBodyOpen = encodeUtf8("<p:cSld><p:spTree>")
const minimalShellSuffix = encodeUtf8("</p:spTree></p:cSld></p:sld>")
const animationTags = new Set([
  "p:timing",
  "p:spTgt",
  "p:inkTgt",
  "p:bldP",
  "p:bldDgm",
  "p:bldOleChart",
  "p:bldGraphic",
])
const connectionTags = new Set(["a:stCxn", "a:endCxn"])

function joinChunks(chunks: readonly Uint8Array[]): Uint8Array {
  let total = 0
  for (const chunk of chunks) total += chunk.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  const limit = haystack.length - needle.length
  const first = needle[0]
  if (first === undefined) return 0
  for (let at = haystack.indexOf(first); at >= 0 && at <= limit; at = haystack.indexOf(first, at + 1)) {
    let matched = true
    for (let offset = 1; offset < needle.length; offset += 1) {
      if (haystack[at + offset] !== needle[offset]) {
        matched = false
        break
      }
    }
    if (matched) return at
  }
  return -1
}

function childOf(children: MarkupChildren, parent: MarkupElement | undefined, kind: string): MarkupElement | undefined {
  return parent === undefined ? undefined : children[parent.index]?.find((each) => each.kind === kind)
}

function shapeIdOf(element: MarkupElement, children: MarkupChildren): string | null {
  if (!isShapeTag(element.kind)) return null
  const visual = childOf(children, element, shapeTags[element.kind].nonVisual)
  return childOf(children, visual, "p:cNvPr")?.id ?? null
}

function isStandGroup(group: MarkupElement, children: MarkupChildren): boolean {
  const properties = childOf(children, group, "p:grpSpPr")
  const list = childOf(children, properties, "a:extLst")
  const own =
    list === undefined ? undefined : children[list.index]?.find((each) => paintAttribute(each, "uri") === effectsUri)
  return childOf(children, own, "adf:stand") !== undefined
}

function pictureFlags(elements: readonly MarkupElement[]): Uint8Array {
  const flags = new Uint8Array(elements.length)
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const element = elements[index]!
    if (element.kind === "p:pic" || element.kind === "a:blipFill") flags[index] = 1
    if (flags[index] === 1 && element.parent >= 0) flags[element.parent] = 1
  }
  return flags
}

export function buildSlideTree(part: string, bytes: Uint8Array): SlideTree | null {
  const document = markupDocument(bytes)
  if (!document.wellFormed) return null
  const { elements } = document
  const children = markupChildren(elements)
  const root = elements[0]
  const spTree = childOf(children, childOf(children, root, "p:cSld"), "p:spTree")
  if (spTree === undefined || spTree.selfClosing || spTree.closeStart < 0) return null
  const idCounts = new Map<string, number>()
  let hasTiming = false
  let hasConnections = false
  for (const element of elements) {
    if (animationTags.has(element.kind)) hasTiming = true
    if (connectionTags.has(element.kind)) hasConnections = true
    if (element.kind !== "p:cNvPr" || element.id === null) continue
    idCounts.set(element.id, (idCounts.get(element.id) ?? 0) + 1)
  }
  const allIds = new Set(shapeIdsIn(bytes))
  const pictured = pictureFlags(elements)
  const byId = new Map<string, ShapeNode>()
  const partition = (
    container: MarkupElement,
    parent: GroupNode | null,
    keepTrailingExt: boolean,
  ): { readonly start: number; readonly end: number; readonly items: Segment[] } => {
    const direct = children[container.index] ?? []
    let startIndex = 0
    while (
      startIndex < direct.length &&
      (direct[startIndex]!.kind === "p:nvGrpSpPr" || direct[startIndex]!.kind === "p:grpSpPr")
    ) {
      startIndex += 1
    }
    let endIndex = direct.length
    if (keepTrailingExt) {
      while (endIndex > startIndex && direct[endIndex - 1]!.kind === "p:extLst") endIndex -= 1
    }
    const bodyStart = startIndex === 0 ? container.openEnd : direct[startIndex - 1]!.end
    const bodyEnd = endIndex === direct.length ? container.closeStart : direct[endIndex]!.start
    const items: Segment[] = []
    let cursor = bodyStart
    for (let index = startIndex; index < endIndex; index += 1) {
      const child = direct[index]!
      if (child.start > cursor) items.push({ kind: "raw", bytes: bytes.subarray(cursor, child.start) })
      if (child.kind === "p:grpSp" && !child.selfClosing && child.closeStart >= 0 && !isStandGroup(child, children)) {
        const id = shapeIdOf(child, children)
        const group: GroupNode = {
          kind: "group",
          id,
          parent,
          open: new Uint8Array(0),
          items: [],
          close: new Uint8Array(0),
          hasPicture: pictured[child.index] === 1,
        }
        const inner = partition(child, group, true)
        group.open = bytes.subarray(child.start, inner.start)
        group.items = inner.items
        group.close = bytes.subarray(inner.end, child.end)
        if (id !== null && !byId.has(id)) byId.set(id, group)
        items.push(group)
      } else {
        const id = isShapeTag(child.kind) ? shapeIdOf(child, children) : null
        const leaf: LeafNode = {
          kind: "leaf",
          id,
          parent,
          bytes: bytes.subarray(child.start, child.end),
          hasPicture: pictured[child.index] === 1,
        }
        if (id !== null && !byId.has(id)) byId.set(id, leaf)
        items.push(leaf)
      }
      cursor = child.end
    }
    if (cursor < bodyEnd) items.push({ kind: "raw", bytes: bytes.subarray(cursor, bodyEnd) })
    return { start: bodyStart, end: bodyEnd, items }
  }
  const top = partition(spTree, null, false)
  const shellPrefix = bytes.subarray(0, top.start)
  const shellSuffix = bytes.subarray(top.end)
  const stubPrefix =
    root !== undefined && root.kind === "p:sld" && !root.selfClosing
      ? joinChunks([bytes.subarray(root.start, root.openEnd), minimalShellBodyOpen])
      : shellPrefix
  const stubSuffix = root !== undefined && root.kind === "p:sld" && !root.selfClosing ? minimalShellSuffix : shellSuffix
  return {
    part,
    original: bytes,
    shellPrefix,
    shellSuffix,
    stubPrefix,
    stubSuffix,
    items: top.items,
    byId,
    idCounts,
    allIds,
    declaresRelationships: declaresRelationshipsBytes(bytes),
    hasTiming,
    hasConnections,
    dirty: false,
  }
}

function collectChunks(segments: readonly Segment[], out: Uint8Array[]): void {
  for (const segment of segments) {
    if (segment.kind === "raw" || segment.kind === "leaf") {
      if (segment.bytes.length > 0) out.push(segment.bytes)
      continue
    }
    out.push(segment.open)
    collectChunks(segment.items, out)
    out.push(segment.close)
  }
}

export function assembleSlideTree(tree: SlideTree): Uint8Array {
  const chunks: Uint8Array[] = [tree.shellPrefix]
  collectChunks(tree.items, chunks)
  chunks.push(tree.shellSuffix)
  return joinChunks(chunks)
}

function ancestorsOf(node: ShapeNode): readonly GroupNode[] {
  const chain: GroupNode[] = []
  for (let current = node.parent; current !== null; current = current.parent) chain.push(current)
  chain.reverse()
  return chain
}

export function markPicture(node: ShapeNode): void {
  node.hasPicture = true
  for (let current = node.parent; current !== null; current = current.parent) current.hasPicture = true
}

export function shapeStub(tree: SlideTree, node: ShapeNode): ShapeStub | null {
  let prefix: Uint8Array
  let suffix: Uint8Array
  if (node.parent === null) {
    prefix = tree.stubPrefix
    suffix = tree.stubSuffix
  } else {
    const ancestors = ancestorsOf(node)
    const prefixChunks: Uint8Array[] = [tree.stubPrefix]
    for (const group of ancestors) prefixChunks.push(group.open)
    const suffixChunks: Uint8Array[] = []
    for (let index = ancestors.length - 1; index >= 0; index -= 1) suffixChunks.push(ancestors[index]!.close)
    suffixChunks.push(tree.stubSuffix)
    prefix = joinChunks(prefixChunks)
    suffix = joinChunks(suffixChunks)
  }
  if (node.kind === "leaf") {
    return { prefix, suffix, stub: joinChunks([prefix, node.bytes, suffix]) }
  }
  if (indexOfBytes(node.open, groupSentinel) >= 0 || indexOfBytes(node.close, groupSentinel) >= 0) return null
  return { prefix, suffix, stub: joinChunks([prefix, node.open, groupSentinel, node.close, suffix]) }
}
