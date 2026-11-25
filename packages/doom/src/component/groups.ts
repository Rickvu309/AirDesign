import type { End } from "../geometry.js"
import { nodeId, type NodeId } from "../ids.js"
import type { Props } from "../props.js"
import { naming, reject } from "../read-kit.js"
import type { FittingContext } from "./fit-text.js"
import { keyString, type PartKey } from "./instance.js"
import type { ComponentNode, ComponentTree } from "./nodes.js"

export type ComponentGroup = {
  readonly id: NodeId
  readonly key: PartKey
  readonly type: "frame"
  readonly props: Pick<Props, "name" | "box" | "sizing">
  readonly group?: NodeId
}

export type Grouping = {
  readonly groups: Map<string, { readonly key: PartKey; readonly field: string; readonly within: string | undefined }>
  readonly memberOf: Map<string, string>
}

export function groupsOf(
  children: readonly ComponentNode[],
  { groups, memberOf }: Grouping,
  seen: ReadonlyMap<string, unknown>,
  charge: FittingContext["charge"],
): { readonly groups: readonly ComponentGroup[]; readonly holderOf: ReadonlyMap<string, NodeId> } {
  const within = new Map<string, string | undefined>()
  for (const [key, group] of groups) {
    naming(group.field, () => {
      if (key === keyString(["root"])) reject("shape", 'The key ["root"] is reserved.')
      if (seen.has(key)) reject("shape", `Duplicate emitted key ${key}.`)
    })
    within.set(key, group.within)
  }
  const holder = new Map(children.map((child) => [keyString(child.key), memberOf.get(keyString(child.key))]))
  for (const group of [...groups.keys()].reverse()) {
    charge(holder.size + within.size)
    if ([...holder.values(), ...within.values()].filter((each) => each === group).length >= 2) continue
    const outer = within.get(group)
    within.delete(group)
    for (const [key, each] of holder) if (each === group) holder.set(key, outer)
    for (const [key, each] of within) if (each === group) within.set(key, outer)
  }
  const boxes = new Map<string, Props["box"]>()
  for (const child of children) {
    const { x, y, w, h } = child.props.box
    for (let group = holder.get(keyString(child.key)); group !== undefined; group = within.get(group)) {
      const known = boxes.get(group) ?? child.props.box
      const left = Math.min(x, known.x)
      const top = Math.min(y, known.y)
      const right = Math.max(x + w, known.x + known.w)
      const bottom = Math.max(y + h, known.y + known.h)
      boxes.set(group, { ...known, x: left, y: top, w: right - left, h: bottom - top })
    }
  }
  const ids = new Map<string, NodeId>()
  for (const child of children) {
    const chain: string[] = []
    for (let group = holder.get(keyString(child.key)); group !== undefined; group = within.get(group))
      chain.unshift(group)
    for (const group of chain) if (!ids.has(group)) ids.set(group, nodeId(`component:${seen.size + ids.size + 2}`))
  }
  return {
    groups: [...ids].map(([key, id]): ComponentGroup => {
      const outer = within.get(key)
      const part = groups.get(key)!.key
      return {
        id,
        key: part,
        type: "frame",
        props: { name: part.join(" / "), box: boxes.get(key)!, sizing: { w: "hug", h: "hug" } },
        ...(outer === undefined ? {} : { group: ids.get(outer)! }),
      }
    }),
    holderOf: new Map(
      [...holder].flatMap(([key, group]) => (group === undefined ? [] : [[key, ids.get(group)!] as const])),
    ),
  }
}

export type ComponentLayer = {
  readonly id: NodeId
  readonly type: "frame" | "shape"
  readonly parent: NodeId
  readonly props: ComponentNode["props"] | ComponentGroup["props"]
}

export function componentLayers(tree: ComponentTree): readonly ComponentLayer[] {
  const groups = new Map(tree.groups.map((group) => [group.id, group]))
  const origin = (holder: NodeId | undefined) => {
    const group = holder === undefined ? undefined : groups.get(holder)
    return group === undefined ? { x: 0, y: 0 } : { x: group.props.box.x, y: group.props.box.y }
  }
  const layers: ComponentLayer[] = []
  const placed = new Set<NodeId>()
  const shift = <T extends { readonly box: Props["box"] }>(props: T, holder: NodeId | undefined): T => {
    const { x, y } = origin(holder)
    return { ...props, box: { ...props.box, x: props.box.x - x, y: props.box.y - y } }
  }
  const place = (holder: NodeId | undefined) => {
    const group = holder === undefined ? undefined : groups.get(holder)
    if (group === undefined || placed.has(group.id)) return
    place(group.group)
    placed.add(group.id)
    layers.push({ id: group.id, type: "frame", parent: group.group ?? tree.id, props: shift(group.props, group.group) })
  }
  for (const child of tree.children) {
    place(child.group)
    const { x, y } = origin(child.group)
    const geometry = child.props.geometry
    const end = (point: End): End => ("node" in point ? point : { x: point.x - x, y: point.y - y })
    const props =
      geometry.kind === "line"
        ? { ...child.props, geometry: { ...geometry, start: end(geometry.start), end: end(geometry.end) } }
        : child.props
    layers.push({ id: child.id, type: "shape", parent: child.group ?? tree.id, props: shift(props, child.group) })
  }
  return layers
}
