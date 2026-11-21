import { markupDocument, withTransientMarkup } from "./element-span.js"
import { backdropXml, groupOpenXml, wrapGroup } from "./group-write.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes } from "./part-markup.js"
import { appendShape, type ShapeBox } from "./shape-write.js"
import { removeShape } from "./slide-route.js"
import {
  assembleSlideTree,
  buildSlideTree,
  groupSentinel,
  indexOfBytes,
  markPicture,
  shapeStub,
  type GroupNode,
  type LeafNode,
  type Segment,
  type ShapeNode,
  type SlideTree,
} from "./slide-tree.js"
import type { Parts } from "./xml-codec.js"

export type EditShapeOptions = {
  readonly touchesChildren?: boolean
}

const blipFillMarker = encodeUtf8("blipFill")
const startConnectionMarker = encodeUtf8("<a:stCxn")
const endConnectionMarker = encodeUtf8("<a:endCxn")
const groupCloseBytes = encodeUtf8("</p:grpSp>")
const highestShapeId = 4294967295

function samePartsMap(left: Parts, right: Parts): boolean {
  if (left === right) return true
  if (left.size !== right.size) return false
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false
  }
  return true
}

export class SlideEditor {
  private readonly originalParts: Parts
  private currentParts: Parts
  private readonly trees = new Map<string, SlideTree | null>()

  constructor(parts: Parts) {
    this.originalParts = parts
    this.currentParts = parts
  }

  private treeFor(part: string): SlideTree | null {
    if (this.trees.has(part)) return this.trees.get(part) ?? null
    const bytes = this.currentParts.get(part)
    if (bytes === undefined) return null
    const tree = buildSlideTree(part, bytes)
    this.trees.set(part, tree)
    return tree
  }

  private syncPart(part: string): void {
    const tree = this.trees.get(part)
    if (tree === undefined || tree === null) return
    const nextBytes = tree.dirty ? assembleSlideTree(tree) : tree.original
    const finalBytes = sameBytes(nextBytes, tree.original) ? tree.original : nextBytes
    const next = new Map(this.currentParts)
    next.set(part, finalBytes)
    this.currentParts = next
    this.trees.delete(part)
  }

  private syncAll(): void {
    if (this.trees.size === 0) return
    const next = new Map(this.currentParts)
    for (const [part, tree] of this.trees) {
      if (tree === null) continue
      const assembled = tree.dirty ? assembleSlideTree(tree) : tree.original
      next.set(part, sameBytes(assembled, tree.original) ? tree.original : assembled)
    }
    this.currentParts = samePartsMap(next, this.originalParts) ? this.originalParts : next
    this.trees.clear()
  }

  readShape<T>(part: string, shapeId: string, read: (bytes: Uint8Array) => T): T {
    const tree = this.treeFor(part)
    const node = tree?.byId.get(shapeId)
    if (tree !== null && node !== undefined && tree.idCounts.get(shapeId) === 1) {
      const built = shapeStub(tree, node)
      if (built !== null) return withTransientMarkup(() => read(built.stub))
    }
    this.syncPart(part)
    return read(partBytes(this.currentParts, part))
  }

  editShape(part: string, shapeId: string, edit: (parts: Parts) => Parts, options?: EditShapeOptions): void {
    const tree = this.treeFor(part)
    const node = tree?.byId.get(shapeId)
    if (
      tree === null ||
      node === undefined ||
      tree.idCounts.get(shapeId) !== 1 ||
      (node.kind === "group" && options?.touchesChildren === true && node.hasPicture)
    ) {
      this.editWhole(part, edit)
      return
    }
    const built = shapeStub(tree, node)
    if (built === null) {
      this.editWhole(part, edit)
      return
    }
    const { prefix, suffix, stub } = built
    const scoped = new Map(this.currentParts)
    scoped.set(part, stub)
    const after = withTransientMarkup(() => edit(scoped))
    if (after === scoped) return
    const afterStub = after.get(part)
    if (afterStub === undefined) {
      this.editWhole(part, edit)
      return
    }
    if (afterStub === stub) {
      this.currentParts = after
      return
    }
    const intact =
      afterStub.length >= prefix.length + suffix.length &&
      sameBytes(afterStub.subarray(0, prefix.length), prefix) &&
      sameBytes(afterStub.subarray(afterStub.length - suffix.length), suffix)
    if (!intact) {
      this.editWhole(part, edit)
      return
    }
    const inner = afterStub.subarray(prefix.length, afterStub.length - suffix.length)
    if (node.kind === "leaf") {
      if (!sameBytes(inner, node.bytes)) {
        node.bytes = inner
        tree.dirty = true
        if (!node.hasPicture && indexOfBytes(inner, blipFillMarker) >= 0) markPicture(node)
      }
      this.currentParts = after
      return
    }
    const sentinelAt = indexOfBytes(inner, groupSentinel)
    if (sentinelAt < 0) {
      this.editWhole(part, edit)
      return
    }
    const nextOpen = inner.subarray(0, sentinelAt)
    const nextClose = inner.subarray(sentinelAt + groupSentinel.length)
    if (!sameBytes(nextOpen, node.open) || !sameBytes(nextClose, node.close)) {
      node.open = nextOpen
      node.close = nextClose
      tree.dirty = true
    }
    this.currentParts = after
  }

  editWhole(part: string, edit: (parts: Parts) => Parts): void {
    if (this.trees.size > 1 || (this.trees.size === 1 && !this.trees.has(part))) this.syncAll()
    else this.syncPart(part)
    const before = this.currentParts
    const after = edit(before)
    if (after !== before) {
      this.currentParts = after
      this.trees.delete(part)
    }
  }

  editAny(edit: (parts: Parts) => Parts): void {
    this.syncAll()
    this.currentParts = edit(this.currentParts)
  }

  holds(part: string, shapes: readonly string[]): boolean {
    const tree = this.treeFor(part)
    if (tree !== null) return shapes.every((shape) => (tree.idCounts.get(shape) ?? 0) > 0)
    this.syncPart(part)
    const { elements } = markupDocument(partBytes(this.currentParts, part))
    return shapes.every((shape) => elements.some((mark) => mark.kind === "p:cNvPr" && mark.id === shape))
  }

  appendShape(part: string, id: number, xml: string, afterAppend?: (parts: Parts) => Parts): void {
    const tree = this.treeFor(part)
    if (tree === null) {
      this.editWhole(part, (parts) => {
        const current = partBytes(parts, part)
        const written = appendShape(decodeUtf8(current), () => xml, id)
        const nextBytes = encodeUtf8(written.xml)
        const next = new Map(parts)
        next.set(part, sameBytes(nextBytes, current) ? current : nextBytes)
        return afterAppend === undefined ? next : afterAppend(next)
      })
      return
    }
    if (!Number.isInteger(id) || id < 1 || id > highestShapeId) throw new Error("shape id")
    const idText = String(id)
    if (tree.allIds.has(idText)) throw new Error("shape id")
    const bytes = encodeUtf8(xml)
    const leaf: LeafNode = {
      kind: "leaf",
      id: idText,
      parent: null,
      bytes,
      hasPicture: indexOfBytes(bytes, blipFillMarker) >= 0,
    }
    if (indexOfBytes(bytes, startConnectionMarker) >= 0 || indexOfBytes(bytes, endConnectionMarker) >= 0) {
      tree.hasConnections = true
    }
    tree.items.push(leaf)
    tree.byId.set(idText, leaf)
    tree.idCounts.set(idText, (tree.idCounts.get(idText) ?? 0) + 1)
    tree.allIds.add(idText)
    tree.dirty = true
    if (afterAppend !== undefined) this.editShape(part, idText, afterAppend)
  }

  appendWithParts(
    part: string,
    id: number,
    build: (parts: Map<string, Uint8Array>, declared: boolean) => string,
    fallback: (parts: Parts) => Parts,
  ): void {
    const tree = this.treeFor(part)
    if (tree === null) {
      this.editWhole(part, fallback)
      return
    }
    if (!Number.isInteger(id) || id < 1 || id > highestShapeId) throw new Error("shape id")
    const idText = String(id)
    if (tree.allIds.has(idText)) throw new Error("shape id")
    const next = new Map(this.currentParts)
    const xml = build(next, tree.declaresRelationships)
    this.currentParts = next
    const bytes = encodeUtf8(xml)
    const leaf: LeafNode = {
      kind: "leaf",
      id: idText,
      parent: null,
      bytes,
      hasPicture: indexOfBytes(bytes, blipFillMarker) >= 0,
    }
    tree.items.push(leaf)
    tree.byId.set(idText, leaf)
    tree.idCounts.set(idText, (tree.idCounts.get(idText) ?? 0) + 1)
    tree.allIds.add(idText)
    tree.dirty = true
  }

  removeShape(part: string, shapeId: string): void {
    const tree = this.treeFor(part)
    const node = tree?.byId.get(shapeId)
    if (
      tree === null ||
      node === undefined ||
      node.kind !== "leaf" ||
      tree.hasTiming ||
      tree.hasConnections ||
      tree.idCounts.get(shapeId) !== 1
    ) {
      this.editWhole(part, (parts) => {
        const current = partBytes(parts, part)
        const nextBytes = removeShape(current, shapeId)
        const next = new Map(parts)
        next.set(part, sameBytes(nextBytes, current) ? current : nextBytes)
        return next
      })
      return
    }
    const container = node.parent === null ? tree.items : node.parent.items
    const at = container.indexOf(node)
    if (at < 0) {
      this.editWhole(part, (parts) => {
        const current = partBytes(parts, part)
        const nextBytes = removeShape(current, shapeId)
        const next = new Map(parts)
        next.set(part, sameBytes(nextBytes, current) ? current : nextBytes)
        return next
      })
      return
    }
    container.splice(at, 1)
    tree.byId.delete(shapeId)
    tree.idCounts.delete(shapeId)
    tree.allIds.delete(shapeId)
    tree.dirty = true
  }

  wrapGroup(part: string, id: number, box: ShapeBox, members: readonly string[], backdrop?: number): void {
    const tree = this.treeFor(part)
    if (tree === null || members.length === 0) {
      this.editWhole(part, (parts) => {
        const next = new Map(parts)
        next.set(part, wrapGroup(partBytes(parts, part), id, box, members, backdrop))
        return next
      })
      return
    }
    const found: ShapeNode[] = []
    for (const member of members) {
      const node = tree.byId.get(member)
      if (node === undefined || tree.idCounts.get(member) !== 1) {
        this.editWhole(part, (parts) => {
          const next = new Map(parts)
          next.set(part, wrapGroup(partBytes(parts, part), id, box, members, backdrop))
          return next
        })
        return
      }
      found.push(node)
    }
    const parent = found[0]!.parent
    const unique = new Set<ShapeNode>(found)
    if (unique.size !== found.length || found.some((node) => node.parent !== parent)) throw new Error("shape")
    const container = parent === null ? tree.items : parent.items
    const positions: number[] = []
    for (let index = 0; index < container.length; index += 1) {
      const segment = container[index]!
      if (segment.kind !== "raw" && unique.has(segment)) positions.push(index)
    }
    if (positions.length !== found.length) {
      this.editWhole(part, (parts) => {
        const next = new Map(parts)
        next.set(part, wrapGroup(partBytes(parts, part), id, box, members, backdrop))
        return next
      })
      return
    }
    const groupId = String(id)
    const children: Segment[] = []
    const group: GroupNode = {
      kind: "group",
      id: groupId,
      parent,
      open: encodeUtf8(groupOpenXml(id, box, backdrop !== undefined)),
      items: children,
      close: groupCloseBytes,
      hasPicture: false,
    }
    if (backdrop !== undefined) {
      const backdropId = String(backdrop)
      const backdropNode: LeafNode = {
        kind: "leaf",
        id: backdropId,
        parent: group,
        bytes: encodeUtf8(backdropXml(backdrop, box)),
        hasPicture: false,
      }
      children.push(backdropNode)
      tree.byId.set(backdropId, backdropNode)
      tree.idCounts.set(backdropId, (tree.idCounts.get(backdropId) ?? 0) + 1)
      tree.allIds.add(backdropId)
    }
    for (const pos of positions) {
      const memberNode = container[pos] as ShapeNode
      memberNode.parent = group
      if (memberNode.hasPicture) group.hasPicture = true
      children.push(memberNode)
    }
    const lastPos = positions[positions.length - 1]!
    container[lastPos] = group
    for (let index = positions.length - 2; index >= 0; index -= 1) container.splice(positions[index]!, 1)
    tree.byId.set(groupId, group)
    tree.idCounts.set(groupId, (tree.idCounts.get(groupId) ?? 0) + 1)
    tree.allIds.add(groupId)
    if (group.hasPicture && parent !== null) markPicture(parent)
    tree.dirty = true
  }

  flush(): Parts {
    this.syncAll()
    return this.currentParts
  }
}
