import { readBox, type Box } from "./box.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { readElementId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { elementGone } from "./element-order.js"
import type { Kind } from "./kinds.js"
import { limits } from "./limits.js"
import { onlyKeys, record } from "./plain-object.js"
import { floorOf, openingElement, readFloor } from "./slide-floor.js"
import type { SlideState } from "./slide-order.js"

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
  readonly backdrop?: IndexElement
}

export type ElementUngroup = { readonly slide: "element-ungroup"; readonly id: SlideId; readonly node: ElementId }

export type ElementRegroup = { readonly slide: "element-regroup"; readonly id: SlideId; readonly node: ElementId }

export type ElementJoin = {
  readonly slide: "element-join"
  readonly id: SlideId
  readonly member: Member
  readonly frame: ElementId | null
  readonly before: ElementId | null
}

export type GroupCommand = ElementGroup | ElementUngroup | ElementRegroup | ElementJoin

type Indexed = SlideState & { readonly index?: DeckIndex }

type Parent = ElementId | null | "unknown"

type Tree = {
  readonly parent: ReadonlyMap<ElementId, Parent>
  readonly dissolved: ReadonlySet<ElementId>
  readonly former: ReadonlyMap<ElementId, readonly ElementId[]>
  readonly made: ReadonlyMap<ElementId, ElementGroup>
  readonly joined: ReadonlyMap<ElementId, Member>
  readonly flow: ReadonlyMap<ElementId, readonly ElementId[]>
  readonly vacated: ReadonlySet<ElementId>
  readonly rejoined: ReadonlySet<ElementId>
}

export const groupable: readonly Kind[] = ["shape", "connector", "group", "table", "chart"]

const fullTurn = 21_600_000

export function groupCommand(command: { readonly slide: string }): command is GroupCommand {
  return (
    command.slide === "element-group" ||
    command.slide === "element-ungroup" ||
    command.slide === "element-regroup" ||
    command.slide === "element-join"
  )
}

export function groupNode(command: GroupCommand): ElementId {
  if (command.slide === "element-join") return command.member.node
  return command.slide === "element-group" ? command.element.node : command.node
}

function flowWith(flow: readonly ElementId[], node: ElementId, before: ElementId | null): readonly ElementId[] {
  const rest = flow.filter((each) => each !== node)
  const at = before === null ? -1 : rest.indexOf(before)
  return at < 0 ? [...rest, node] : [...rest.slice(0, at), node, ...rest.slice(at)]
}

function replacedIn(
  flow: readonly ElementId[],
  out: readonly ElementId[],
  into: readonly ElementId[],
): readonly ElementId[] {
  const at = flow.findIndex((each) => out.includes(each))
  const kept = flow.filter((each) => !out.includes(each))
  if (at < 0) return [...kept, ...into]
  const before = flow.slice(0, at).filter((each) => !out.includes(each)).length
  return [...kept.slice(0, before), ...into, ...kept.slice(before)]
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
  const flow = new Map<ElementId, readonly ElementId[]>()
  const opened = new Map<ElementId, IndexElement>()
  for (const element of openingRows(state)) {
    if (parent.has(element.node)) continue
    opened.set(element.node, element)
    parent.set(element.node, element.grouped ? (element.group ?? "unknown") : null)
    if (element.framing !== undefined) flow.set(element.node, element.framing.children)
  }
  for (const [node, element] of opened) {
    const above = element.grouped ? element.group : undefined
    if (above === undefined || opened.get(above)?.framing !== undefined) continue
    flow.set(above, [...(flow.get(above) ?? []), node])
  }
  const dissolved = new Set<ElementId>()
  const former = new Map<ElementId, readonly ElementId[]>()
  const made = new Map<ElementId, ElementGroup>()
  const joined = new Map<ElementId, Member>()
  const vacated = new Set<ElementId>()
  const rejoined = new Set<ElementId>()
  for (const command of state.order) {
    if (command.slide === "element-clone") {
      if (command.element.group !== undefined) rejoined.add(command.element.group)
      for (const copy of [command.element, ...(command.layers ?? []).map((layer) => layer.element)])
        if (copy.kind === "group" && copy.framing === undefined) rejoined.add(copy.node)
    }
    if (command.slide === "element-group") {
      const node = command.element.node
      const held = new Set(command.members.map((member) => parent.get(member.node)))
      const [holder] = held
      const filed = parent.get(node)
      const replayed = holder === node
      const above = replayed ? filed : held.size === 1 ? holder : null
      const inside = typeof above === "string" && above !== "unknown" && above !== node ? above : null
      parent.set(node, inside)
      if (inside !== null && !replayed) {
        flow.set(
          inside,
          replacedIn(
            flow.get(inside) ?? [],
            command.members.map((member) => member.node),
            [node],
          ),
        )
        joined.set(node, { node, box: command.element.box ?? { x: 0, y: 0, cx: 0, cy: 0 } })
      }
      if (command.backdrop !== undefined) parent.set(command.backdrop.node, node)
      for (const member of command.members) {
        parent.set(member.node, node)
        joined.delete(member.node)
      }
      made.set(node, command)
      flow.set(
        node,
        command.members.map((member) => member.node),
      )
      dissolved.delete(node)
      continue
    }
    if (command.slide === "element-join") {
      const node = command.member.node
      const left = parent.get(node)
      if (left !== undefined && left !== null && left !== "unknown") {
        vacated.add(left)
        flow.set(
          left,
          (flow.get(left) ?? []).filter((each) => each !== node),
        )
      }
      parent.set(node, command.frame)
      joined.set(node, command.member)
      if (command.frame !== null) flow.set(command.frame, flowWith(flow.get(command.frame) ?? [], node, command.before))
      for (const group of [left, command.frame])
        if (typeof group === "string" && group !== "unknown") rejoined.add(group)
      continue
    }
    if (command.slide === "element-ungroup") {
      const children = childrenIn(parent, command.node)
      const above = parent.get(command.node) ?? null
      for (const child of children) parent.set(child, above)
      if (typeof above === "string" && above !== "unknown") {
        const ordered = (flow.get(command.node) ?? []).filter((child) => children.includes(child))
        flow.set(above, replacedIn(flow.get(above) ?? [], [command.node], ordered))
        for (const child of ordered) {
          const member = made.get(command.node)?.members.find((each) => each.node === child)
          if (member !== undefined) joined.set(child, member)
        }
      }
      former.set(command.node, children)
      dissolved.add(command.node)
      continue
    }
    if (command.slide !== "element-regroup") continue
    const back = former.get(command.node) ?? []
    for (const child of back) parent.set(child, command.node)
    const above = parent.get(command.node)
    if (typeof above === "string" && above !== "unknown")
      flow.set(above, replacedIn(flow.get(above) ?? [], back, [command.node]))
    dissolved.delete(command.node)
  }
  return { parent, dissolved, former, made, joined, flow, vacated, rejoined }
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

export function joinedMember(state: Indexed, node: ElementId): Member | undefined {
  const tree = treeOf(state)
  const member = tree.joined.get(node)
  return member === undefined || tree.parent.get(node) === null ? undefined : member
}

export function groupEmptied(state: Indexed, node: ElementId): boolean {
  const tree = treeOf(state)
  return (
    tree.vacated.has(node) &&
    plainGroup(state, node) &&
    childrenIn(tree.parent, node).every((child) => elementGone(state, child))
  )
}

export function groupRejoined(state: Indexed, node: ElementId): boolean {
  return treeOf(state).rejoined.has(node)
}

export function rejoinedGroups(state: Indexed): readonly ElementId[] {
  return [...treeOf(state).rejoined]
}

export function groupFlow(state: Indexed, node: ElementId): readonly ElementId[] {
  const tree = treeOf(state)
  return (tree.flow.get(node) ?? []).filter((child) => tree.parent.get(child) === node && !elementGone(state, child))
}

export function plainGroup(state: Indexed, node: ElementId): boolean {
  return groupFormed(state, node) && !groupDissolved(state, node) && frameBackdrop(state, node) === null
}

export function groupDissolved(state: Indexed, node: ElementId): boolean {
  return treeOf(state).dissolved.has(node)
}

export function madeGroup(state: Indexed, node: ElementId): ElementGroup | undefined {
  return treeOf(state).made.get(node)
}

export type FrameSource = { readonly backdrop: ElementId; readonly box: Box; readonly members: readonly Member[] }

function filedMember(state: Indexed, node: ElementId, dx: number, dy: number): readonly Member[] {
  const box = openingElement(state, node)?.box
  return box === undefined || box === null ? [] : [{ node, box: { ...box, x: box.x + dx, y: box.y + dy } }]
}

export function frameSource(state: Indexed, node: ElementId): FrameSource | null {
  const made = madeGroup(state, node)
  if (made?.backdrop !== undefined && made.element.box !== null)
    return { backdrop: made.backdrop.node, box: made.element.box, members: made.members }
  const filed = made === undefined ? openingElement(state, node) : undefined
  if (filed?.framing === undefined || filed.box === null) return null
  const space = filed.frame ?? filed.box
  const [dx, dy] = [filed.box.x - space.x, filed.box.y - space.y]
  const members = filed.framing.children.flatMap((child) => filedMember(state, child, dx, dy))
  return { backdrop: filed.framing.backdrop, box: filed.box, members }
}

export function frameMembers(state: Indexed, node: ElementId): readonly Member[] {
  const tree = treeOf(state)
  const source = frameSource(state, node)
  return (tree.flow.get(node) ?? []).flatMap((child) => {
    if (tree.parent.get(child) !== node || elementGone(state, child)) return []
    const member = tree.joined.get(child) ?? source?.members.find((each) => each.node === child)
    return member === undefined ? [] : [member]
  })
}

export function frameBackdrop(state: Indexed, node: ElementId): ElementId | null {
  const backdrop = frameSource(state, node)?.backdrop
  return backdrop === undefined || groupDissolved(state, node) || elementGone(state, node) ? null : backdrop
}

export function groupFrame(state: Indexed, node: ElementId): Box | null {
  const made = madeGroup(state, node)
  if (made !== undefined) return made.element.box
  return openingElement(state, node)?.frame ?? null
}

export function groupFormed(state: Indexed, node: ElementId): boolean {
  return openingElement(state, node)?.kind === "group" && !elementGone(state, node)
}

function memberBounds(members: readonly Member[], scaleX = 1, scaleY = 1): Box {
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const member of members) {
    const { x, y, cx, cy } = member.box
    const radians = ((member.rot ?? 0) / 60_000) * (Math.PI / 180)
    const [cos, sin] = [Math.abs(Math.cos(radians)), Math.abs(Math.sin(radians))]
    const halfWidth = (cx * scaleX * cos + cy * scaleY * sin) / 2 / scaleX
    const halfHeight = (cx * scaleX * sin + cy * scaleY * cos) / 2 / scaleY
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

export function groupBounds(members: readonly Member[], scaleX = 1, scaleY = 1): Box {
  return memberBounds(members, scaleX, scaleY)
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
    const backdrop = raw.backdrop === undefined ? undefined : readFloor([raw.backdrop], id)?.[0]
    if (raw.backdrop !== undefined && backdrop === undefined) return undefined
    const fewest = backdrop === undefined ? 2 : 1
    if (raw.members.length < fewest || raw.members.length > limits.batch) return undefined
    const members: Member[] = []
    for (const item of raw.members) {
      const member = readMember(item, id)
      if (
        member === undefined ||
        member.node === element.node ||
        member.node === backdrop?.node ||
        members.some((kept) => kept.node === member.node)
      )
        return undefined
      members.push(member)
    }
    return { slide: "element-group", id, element, members, ...(backdrop === undefined ? {} : { backdrop }) }
  }
  if (raw.slide === "element-join") {
    const member = readMember(raw.member, id)
    const frame = raw.frame === null ? null : readElementId(raw.frame)
    const before = raw.before === null ? null : readElementId(raw.before)
    if (member === undefined || frame === undefined || before === undefined) return undefined
    if ((frame !== null && shapeOf(frame).slide !== id) || (before !== null && shapeOf(before).slide !== id))
      return undefined
    return { slide: "element-join", id, member, frame, before }
  }
  const node = readElementId(raw.node)
  if (node === undefined || shapeOf(node).slide !== id) return undefined
  if (raw.slide === "element-ungroup") return { slide: "element-ungroup", id, node }
  if (raw.slide === "element-regroup") return { slide: "element-regroup", id, node }
  return undefined
}
