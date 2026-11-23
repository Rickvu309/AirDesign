import { type Box } from "./box.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { type ElementId, type SlideId } from "./element-id.js"
import { elementGone } from "./element-order.js"
import { floorOf, openingElement } from "./slide-floor.js"
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
  readonly children: ReadonlyMap<ElementId, readonly ElementId[]>
  readonly dissolved: ReadonlySet<ElementId>
  readonly former: ReadonlyMap<ElementId, readonly ElementId[]>
  readonly made: ReadonlyMap<ElementId, ElementGroup>
  readonly joined: ReadonlyMap<ElementId, Member>
  readonly flow: ReadonlyMap<ElementId, readonly ElementId[]>
  readonly vacated: ReadonlySet<ElementId>
  readonly rejoined: ReadonlySet<ElementId>
}

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
  const children = new Map<ElementId, ElementId[]>()
  for (const [child, above] of parent) {
    if (typeof above !== "string" || above === "unknown") continue
    const list = children.get(above)
    if (list === undefined) children.set(above, [child])
    else list.push(child)
  }
  return { parent, children, dissolved, former, made, joined, flow, vacated, rejoined }
}

function treeOf(state: Indexed): Tree {
  let byIndex = trees.get(state.order)
  if (byIndex === undefined) {
    byIndex = new WeakMap<object, Tree>()
    trees.set(state.order, byIndex)
  }
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

export function frameBackdrop(state: Indexed, node: ElementId): ElementId | null {
  const backdrop = frameSource(state, node)?.backdrop
  return backdrop === undefined || groupDissolved(state, node) || elementGone(state, node) ? null : backdrop
}

export function groupFormed(state: Indexed, node: ElementId): boolean {
  return openingElement(state, node)?.kind === "group" && !elementGone(state, node)
}
