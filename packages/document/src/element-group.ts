import { readBox, type Box } from "./box.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { readElementId, shapeOf, slideKind, type ElementId, type SlideId } from "./element-id.js"
import { elementGone } from "./element-order.js"
import type { Kind } from "./kinds.js"
import { limits } from "./limits.js"
import { onlyKeys, record } from "./plain-object.js"
import { floorOf, openingElement, readFloor } from "./slide-floor.js"
import { slideMeasure } from "./slide-measure.js"
import type { SlideRefusal, SlideState } from "./slide-order.js"

export type Member = {
  readonly node: ElementId
  readonly box: Box
  readonly rot?: number
  readonly flipH?: true
  readonly flipV?: true
}

export type ElementGroup = {
  readonly slide: "element-group"
  readonly id: SlideId
  readonly element: IndexElement
  readonly members: readonly Member[]
}

export type ElementUngroup = { readonly slide: "element-ungroup"; readonly id: SlideId; readonly node: ElementId }

export type ElementRegroup = { readonly slide: "element-regroup"; readonly id: SlideId; readonly node: ElementId }

export type GroupCommand = ElementGroup | ElementUngroup | ElementRegroup

type Indexed = SlideState & { readonly index?: DeckIndex }

type Parent = ElementId | null | "unknown"

type Tree = {
  readonly parent: ReadonlyMap<ElementId, Parent>
  readonly dissolved: ReadonlySet<ElementId>
  readonly former: ReadonlyMap<ElementId, readonly ElementId[]>
  readonly made: ReadonlyMap<ElementId, ElementGroup>
}

export const groupable: readonly Kind[] = ["shape", "picture", "connector", "group", "table", "chart"]

const highestShape = 4294967295
const fullTurn = 21_600_000

export function groupCommand(command: { readonly slide: string }): command is GroupCommand {
  return command.slide === "element-group" || command.slide === "element-ungroup" || command.slide === "element-regroup"
}

export function groupNode(command: GroupCommand): ElementId {
  return command.slide === "element-group" ? command.element.node : command.node
}

function openingRows(state: Indexed): readonly IndexElement[] {
  return [...(state.index?.elements ?? []), ...state.order.flatMap((command) => floorOf(command))]
}

function childrenIn(parent: ReadonlyMap<ElementId, Parent>, node: ElementId): ElementId[] {
  const children: ElementId[] = []
  for (const [child, above] of parent) if (above === node) children.push(child)
  return children
}

const trees = new WeakMap<readonly unknown[], WeakMap<object, Tree>>()
const noIndex = {}

function foldTree(state: Indexed): Tree {
  const parent = new Map<ElementId, Parent>()
  for (const element of openingRows(state)) {
    if (parent.has(element.node)) continue
    parent.set(element.node, element.grouped ? (element.group ?? "unknown") : null)
  }
  const dissolved = new Set<ElementId>()
  const former = new Map<ElementId, readonly ElementId[]>()
  const made = new Map<ElementId, ElementGroup>()
  for (const command of state.order) {
    if (command.slide === "element-group") {
      const node = command.element.node
      parent.set(node, null)
      for (const member of command.members) parent.set(member.node, node)
      made.set(node, command)
      dissolved.delete(node)
      continue
    }
    if (command.slide === "element-ungroup") {
      const children = childrenIn(parent, command.node)
      const above = parent.get(command.node) ?? null
      for (const child of children) parent.set(child, above)
      former.set(command.node, children)
      dissolved.add(command.node)
      continue
    }
    if (command.slide !== "element-regroup") continue
    for (const child of former.get(command.node) ?? []) parent.set(child, command.node)
    dissolved.delete(command.node)
  }
  return { parent, dissolved, former, made }
}

function treeOf(state: Indexed): Tree {
  const byIndex = trees.get(state.order) ?? new WeakMap<object, Tree>()
  trees.set(state.order, byIndex)
  const key = state.index ?? noIndex
  const kept = byIndex.get(key)
  if (kept !== undefined) return kept
  const tree = foldTree(state)
  byIndex.set(key, tree)
  return tree
}

export function groupParent(state: Indexed, node: ElementId): ElementId | null | undefined {
  const above = treeOf(state).parent.get(node)
  return above === "unknown" ? undefined : above
}

export function groupedNow(state: Indexed, node: ElementId): boolean {
  const above = treeOf(state).parent.get(node)
  if (above === undefined) return openingElement(state, node)?.grouped ?? false
  return above !== null
}

export function groupChildren(state: Indexed, node: ElementId): readonly ElementId[] {
  return childrenIn(treeOf(state).parent, node)
}

export function formerChildren(state: Indexed, node: ElementId): readonly ElementId[] {
  return treeOf(state).former.get(node) ?? []
}

export function groupDissolved(state: Indexed, node: ElementId): boolean {
  return treeOf(state).dissolved.has(node)
}

export function madeGroup(state: Indexed, node: ElementId): ElementGroup | undefined {
  return treeOf(state).made.get(node)
}

export function groupFrame(state: Indexed, node: ElementId): Box | null {
  const made = madeGroup(state, node)
  if (made !== undefined) return made.element.box
  return openingElement(state, node)?.frame ?? null
}

export function groupFormed(state: Indexed, node: ElementId): boolean {
  return openingElement(state, node)?.kind === "group" && !elementGone(state, node)
}

function indexComplete(state: Indexed): boolean {
  return state.index !== undefined && state.index.total === state.index.elements.length
}

function animated(state: Indexed, slide: SlideId, node: ElementId): boolean {
  return slideMeasure(state, slide)?.animated.includes(shapeOf(node).shape) === true
}

function memberBounds(members: readonly Member[]): Box {
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const member of members) {
    const { x, y, cx, cy } = member.box
    const radians = ((member.rot ?? 0) / 60_000) * (Math.PI / 180)
    const halfWidth = (Math.abs(cx * Math.cos(radians)) + Math.abs(cy * Math.sin(radians))) / 2
    const halfHeight = (Math.abs(cx * Math.sin(radians)) + Math.abs(cy * Math.cos(radians))) / 2
    const middleX = x + cx / 2
    const middleY = y + cy / 2
    left = Math.min(left, middleX - halfWidth)
    top = Math.min(top, middleY - halfHeight)
    right = Math.max(right, middleX + halfWidth)
    bottom = Math.max(bottom, middleY + halfHeight)
  }
  const x = Math.floor(left + 1e-6)
  const y = Math.floor(top + 1e-6)
  return { x, y, cx: Math.ceil(right - 1e-6) - x, cy: Math.ceil(bottom - 1e-6) - y }
}

export function groupBounds(members: readonly Member[]): Box {
  return memberBounds(members)
}

function sameBox(left: Box | null, right: Box): boolean {
  return left !== null && left.x === right.x && left.y === right.y && left.cx === right.cx && left.cy === right.cy
}

function freshGroup(element: IndexElement, id: SlideId): boolean {
  const number = Number(shapeOf(element.node).shape)
  return (
    shapeOf(element.node).slide === id &&
    Number.isInteger(number) &&
    number > 1 &&
    number <= highestShape &&
    element.kind === "group" &&
    element.value === null &&
    !element.grouped &&
    element.group === undefined &&
    element.frame === undefined &&
    element.role === undefined &&
    element.opening === undefined
  )
}

function memberRefusal(state: Indexed, id: SlideId, node: ElementId): SlideRefusal | null {
  if (shapeOf(node).slide !== id || slideKind(node) !== null || elementGone(state, node)) return "dead"
  if (groupedNow(state, node)) return "group-box"
  const opening = openingElement(state, node)
  if (opening === undefined) return indexComplete(state) ? "dead" : null
  if (!groupable.includes(opening.kind) || opening.role !== undefined) return "kind"
  return animated(state, id, node) ? "locked" : null
}

function madeRefusal(state: Indexed, command: ElementGroup): SlideRefusal | null {
  const { element, members } = command
  if (!freshGroup(element, command.id)) return "dead"
  if (openingElement(state, element.node) !== undefined || elementGone(state, element.node)) return "present"
  for (const member of members) {
    const refusal = memberRefusal(state, command.id, member.node)
    if (refusal !== null) return refusal
  }
  return sameBox(element.box, memberBounds(members)) ? null : "dead"
}

function ungroupRefusal(state: Indexed, command: ElementUngroup): SlideRefusal | null {
  if (elementGone(state, command.node)) return "dead"
  if (groupedNow(state, command.node)) return "group-box"
  const opening = openingElement(state, command.node)
  if (opening === undefined) return indexComplete(state) ? "dead" : null
  if (opening.kind !== "group") return "kind"
  if (groupFrame(state, command.node) === null) return "kind"
  return animated(state, command.id, command.node) ? "locked" : null
}

function regroupRefusal(state: Indexed, command: ElementRegroup): SlideRefusal | null {
  if (!groupDissolved(state, command.node)) return "dead"
  for (const child of formerChildren(state, command.node)) {
    if (elementGone(state, child)) return "dead"
    if (groupedNow(state, child)) return "group-box"
  }
  return null
}

export function groupRefusal(state: Indexed, command: GroupCommand): SlideRefusal | null {
  if (shapeOf(groupNode(command)).slide !== command.id) return "dead"
  if (command.slide === "element-group") return madeRefusal(state, command)
  if (command.slide === "element-ungroup") return ungroupRefusal(state, command)
  return regroupRefusal(state, command)
}

function readTurn(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 && raw < fullTurn ? raw : null
}

function readMember(raw: unknown, id: SlideId): Member | undefined {
  const row = record(raw)
  if (row === null) return undefined
  const keys = ["node", "box", "rot", "flipH", "flipV"].filter(
    (key) => key === "node" || key === "box" || row[key] !== undefined,
  )
  if (!onlyKeys(row, keys)) return undefined
  const node = readElementId(row.node)
  const box = readBox(row.box)
  const rot = readTurn(row.rot)
  if (node === undefined || shapeOf(node).slide !== id || box === null || rot === null) return undefined
  if ((row.flipH !== undefined && row.flipH !== true) || (row.flipV !== undefined && row.flipV !== true))
    return undefined
  return {
    node,
    box,
    ...(rot === undefined ? {} : { rot }),
    ...(row.flipH === true ? { flipH: true } : {}),
    ...(row.flipV === true ? { flipV: true } : {}),
  }
}

export function readGroupCommand(raw: Record<string, unknown>, id: SlideId): GroupCommand | undefined {
  if (raw.slide === "element-group") {
    const element = readFloor([raw.element], id)?.[0]
    if (element === undefined || !Array.isArray(raw.members)) return undefined
    if (raw.members.length < 2 || raw.members.length > limits.batch) return undefined
    const members: Member[] = []
    for (const item of raw.members) {
      const member = readMember(item, id)
      if (member === undefined || member.node === element.node || members.some((kept) => kept.node === member.node))
        return undefined
      members.push(member)
    }
    return { slide: "element-group", id, element, members }
  }
  const node = readElementId(raw.node)
  if (node === undefined || shapeOf(node).slide !== id) return undefined
  if (raw.slide === "element-ungroup") return { slide: "element-ungroup", id, node }
  if (raw.slide === "element-regroup") return { slide: "element-regroup", id, node }
  return undefined
}
