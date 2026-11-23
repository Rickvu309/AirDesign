import { deriveChart } from "./derive-chart.js"
import { deckOf } from "./deck-of.js"
import type { NodeId } from "./ids.js"
import { lineRoute } from "./line-ends.js"
import type { Measure } from "./measure.js"
import { scalePath } from "./path-scale.js"
import { textArea } from "./preset-geometry.js"
import type { StrokeStyle } from "./paint.js"
import type { PropName, Props } from "./props.js"
import { resolveEffects, resolvePaints, resolveRadius } from "./resolve-paint.js"
import { resolveText } from "./resolve-text.js"
import type { Box, Resolved, ResolvedGeometry, ResolvedPaint } from "./resolved.js"
import type { Node, Doom } from "./doom.js"
import { solveLayout } from "./solve-layout.js"
import type { Theme } from "./theme.js"

type Context = {
  readonly doom: Doom
  readonly theme: Theme
  readonly measure: Measure
  readonly boxes: ReadonlyMap<NodeId, Box>
}

const prop = <K extends PropName>(node: Node, key: K): Props[K] | undefined => (node as Partial<Props>)[key]
const plainStroke: StrokeStyle = { weight: 1, align: "inside", dash: "solid" }

function geometryOf(context: Context, node: Node, box: Box): ResolvedGeometry {
  const geometry = prop(node, "geometry")
  if (geometry === undefined || geometry.kind === "rect" || geometry.kind === "ellipse" || geometry.kind === "icon")
    return geometry ?? { kind: "rect" }
  if (geometry.kind === "preset") return { kind: "preset", name: geometry.name, adjust: geometry.adjust ?? [] }
  if (geometry.kind === "path") return { kind: "path", d: scalePath(geometry.d, box.w, box.h) }
  const parent = (node as { parent?: { id: NodeId } | null }).parent?.id
  const { from, to, points } = lineRoute(context.doom, context.boxes, parent, geometry)
  const local = (point: { readonly x: number; readonly y: number }) => ({ x: point.x - box.x, y: point.y - box.y })
  return {
    kind: "line",
    from: local(from),
    to: local(to),
    points: points.map(local),
    route: geometry.route,
    arrows: geometry.arrows,
  }
}

type Kept = {
  readonly theme: Theme
  readonly measure: Measure
  readonly box: Box
  readonly children: readonly Resolved[]
  readonly resolved: Resolved
}

const kept = new WeakMap<Node, Kept>()

const sameBox = (left: Box, right: Box) =>
  left.x === right.x &&
  left.y === right.y &&
  left.w === right.w &&
  left.h === right.h &&
  left.rotation === right.rotation &&
  left.flipH === right.flipH &&
  left.flipV === right.flipV

const sameList = (left: readonly Resolved[], right: readonly Resolved[]) =>
  left.length === right.length && left.every((each, at) => each === right[at])

const reads = (node: Node) => prop(node, "geometry")?.kind === "line"

function resolveNode(context: Context, node: Node, box: Box): Resolved {
  const { theme } = context
  const children = [
    ...(node.type === "frame" && prop(node, "chart") !== undefined
      ? deriveChart(node.id, prop(node, "chart")!, box, theme, context.measure)
      : []),
    ...nodesOf(context, node.id),
  ]
  const before = kept.get(node)
  if (
    before !== undefined &&
    !reads(node) &&
    before.theme === theme &&
    before.measure === context.measure &&
    sameBox(before.box, box) &&
    sameList(before.children, children)
  )
    return before.resolved
  const resolved = resolveFresh(context, node, box, children)
  if (!reads(node)) kept.set(node, { theme, measure: context.measure, box, children, resolved })
  return resolved
}

function resolveFresh(context: Context, node: Node, box: Box, children: readonly Resolved[]): Resolved {
  const { theme } = context
  const strokes = resolvePaints(prop(node, "strokes"), theme)
  const text = node.type === "shape" ? prop(node, "text") : undefined
  return {
    id: node.id,
    type: node.type === "frame" ? "frame" : "shape",
    box,
    opacity: prop(node, "opacity") ?? 1,
    fills: resolvePaints(prop(node, "fills"), theme),
    strokes,
    stroke: strokes.length === 0 ? null : (prop(node, "stroke") ?? plainStroke),
    radius: resolveRadius(prop(node, "radius")),
    effects: resolveEffects(prop(node, "effects"), theme),
    geometry: node.type === "shape" ? geometryOf(context, node, box) : null,
    text:
      text === undefined || text.chars === ""
        ? null
        : resolveText(text, theme, textArea(prop(node, "geometry"), box.w, box.h), context.measure),
    clip: prop(node, "clip") ?? false,
    children,
    derived: false,
  }
}

function nodesOf(context: Context, parent: NodeId): readonly Resolved[] {
  return (context.doom.children.get(parent) ?? []).flatMap((id) => {
    const node = context.doom.nodes.get(id)
    const box = context.boxes.get(id)
    if (node === undefined || box === undefined || prop(node, "hidden") === true) return []
    return node.type === "frame" || node.type === "shape" ? [resolveNode(context, node, box)] : []
  })
}

export function resolveSlide(doom: Doom, slide: NodeId, measure: Measure): readonly Resolved[] {
  const { theme } = deckOf(doom)
  return nodesOf({ doom, theme, measure, boxes: solveLayout(doom, slide, measure) }, slide)
}

export function slideBackground(doom: Doom, slide: NodeId): readonly ResolvedPaint[] {
  const { theme } = deckOf(doom)
  const node = doom.nodes.get(slide)
  const own = node === undefined ? [] : resolvePaints(prop(node, "fills"), theme)
  return own.length > 0 ? own : [{ kind: "solid", color: theme.colors.background, opacity: 1 }]
}
