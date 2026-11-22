import { deriveChart } from "./derive-chart.js"
import { deckOf } from "./deck-of.js"
import type { NodeId } from "./ids.js"
import { lineEnds } from "./line-ends.js"
import type { Measure } from "./measure.js"
import { scalePath } from "./path-scale.js"
import type { StrokeStyle } from "./paint.js"
import type { PropName, Props } from "./props.js"
import { resolveEffects, resolvePaints, resolveRadius } from "./resolve-paint.js"
import { resolveText } from "./resolve-text.js"
import type { Box, Resolved, ResolvedGeometry, ResolvedPaint } from "./resolved.js"
import type { Node, Scene } from "./scene.js"
import { solveLayout } from "./solve-layout.js"
import type { Theme } from "./theme.js"

type Context = {
  readonly scene: Scene
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
  const { from, to } = lineEnds(context.scene, context.boxes, parent, geometry)
  const nearer = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? "across" : "down"
  const facing = (end: typeof geometry.start) =>
    "node" in end ? (end.site === "t" || end.site === "b" ? "down" : "across") : nearer
  return {
    kind: "line",
    from: { x: from.x - box.x, y: from.y - box.y },
    to: { x: to.x - box.x, y: to.y - box.y },
    route: geometry.route,
    leaves: facing(geometry.start),
    arrives: facing(geometry.end),
    arrows: geometry.arrows,
  }
}

function resolveNode(context: Context, node: Node, box: Box): Resolved {
  const { theme } = context
  const strokes = resolvePaints(prop(node, "strokes"), theme)
  const text = node.type === "shape" ? prop(node, "text") : undefined
  const chart = node.type === "frame" ? prop(node, "chart") : undefined
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
    text: text === undefined || text.chars === "" ? null : resolveText(text, theme, box, context.measure),
    clip: prop(node, "clip") ?? false,
    children: [
      ...(chart === undefined ? [] : deriveChart(node.id, chart, box, theme, context.measure)),
      ...nodesOf(context, node.id),
    ],
    derived: false,
  }
}

function nodesOf(context: Context, parent: NodeId): readonly Resolved[] {
  return (context.scene.children.get(parent) ?? []).flatMap((id) => {
    const node = context.scene.nodes.get(id)
    const box = context.boxes.get(id)
    if (node === undefined || box === undefined || prop(node, "hidden") === true) return []
    return node.type === "frame" || node.type === "shape" ? [resolveNode(context, node, box)] : []
  })
}

export function resolveSlide(scene: Scene, slide: NodeId, measure: Measure): readonly Resolved[] {
  const { theme } = deckOf(scene)
  return nodesOf({ scene, theme, measure, boxes: solveLayout(scene, slide, measure) }, slide)
}

export function slideBackground(scene: Scene, slide: NodeId): readonly ResolvedPaint[] {
  const { theme } = deckOf(scene)
  const node = scene.nodes.get(slide)
  const own = node === undefined ? [] : resolvePaints(prop(node, "fills"), theme)
  return own.length > 0 ? own : [{ kind: "solid", color: theme.colors.background, opacity: 1 }]
}
