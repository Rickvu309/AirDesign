import { scene } from "@airdesign/document"
import { propOf } from "./node-props"

export type Section = "box" | "sizing" | "layout" | "appearance" | "text" | "fills" | "strokes" | "effects" | "chart"

const placement: Readonly<Partial<Record<scene.PropName, Section>>> = {
  box: "box",
  sizing: "sizing",
  layout: "layout",
  opacity: "appearance",
  radius: "appearance",
  clip: "appearance",
  text: "text",
  fills: "fills",
  strokes: "strokes",
  stroke: "strokes",
  effects: "effects",
  chart: "chart",
}

const order: readonly Section[] = [
  "box",
  "chart",
  "sizing",
  "layout",
  "appearance",
  "text",
  "fills",
  "strokes",
  "effects",
]

export type PanelNode = { readonly id: scene.NodeId; readonly type: scene.NodeType }

function acceptedBy(type: scene.NodeType): readonly scene.PropName[] {
  return scene.accepts[type]
}

function applies(view: scene.Scene, id: scene.NodeId, prop: scene.PropName): boolean {
  const node = view.nodes.get(id)
  if (node === undefined) return false
  const geometry = propOf(node, "geometry")
  if (geometry?.kind === "line")
    return prop === "strokes" || prop === "stroke" || prop === "opacity" || prop === "effects"
  if (geometry?.kind === "icon") return prop !== "fills" && prop !== "radius"
  if (prop === "text") return propOf(node, "text") !== undefined
  if (prop === "chart") return propOf(node, "chart") !== undefined
  if (propOf(node, "chart") !== undefined && (prop === "layout" || prop === "sizing")) return false
  if (prop === "radius") return node.type === "frame" || geometry === undefined || geometry.kind === "rect"
  return acceptedBy(node.type).includes(prop)
}

export function sectionsFor(view: scene.Scene, ids: readonly scene.NodeId[]): readonly Section[] {
  const nodes = ids.filter((id) => view.nodes.get(id) !== undefined)
  if (nodes.length === 0) return []
  const found = new Set<Section>()
  for (const prop of Object.keys(placement) as scene.PropName[]) {
    const section = placement[prop]
    if (section === undefined || scene.props[prop].control === "none") continue
    if (nodes.every((id) => applies(view, id, prop))) found.add(section)
  }
  if (nodes.length > 1) found.delete("box")
  if (nodes.length > 1) found.delete("chart")
  return order.filter((each) => found.has(each))
}

export type Shown<T> = { readonly mixed: boolean; readonly value: T | undefined }

export function shownOf<K extends scene.PropName>(
  view: scene.Scene,
  ids: readonly scene.NodeId[],
  prop: K,
): Shown<scene.Props[K]> {
  const values = ids.flatMap((id) => (view.nodes.has(id) ? [propOf(view.nodes.get(id), prop)] : []))
  const [first] = values
  const same = values.every((value) => JSON.stringify(value) === JSON.stringify(first))
  return { mixed: !same, value: same ? first : undefined }
}
