import type { AgentChange, AgentLook } from "./agent-change.js"
import { type Draft, type Values, living, put, stop } from "./agent-draft.js"
import { chartOf, colorOf, iconName, layoutOf, surfaceOf, textOfLook } from "./agent-look.js"
import { gapFor, slideSize } from "./agent-place.js"
import { type NodeId, readNodeId } from "./ids.js"
import type { Geometry } from "./geometry.js"
import type { Node } from "./scene.js"
import { descendantsOf, get } from "./scene-walk.js"

type SetChange = Extract<AgentChange, { op: "set" }>

const neverOnSet = ["rows", "items", "axes"] as const
const unfit: Readonly<Record<"slide" | "frame" | "shape", readonly (keyof AgentLook)[]>> = {
  slide: [
    "stroke",
    "strokeWidth",
    "color",
    "radius",
    "effect",
    "opacity",
    "text",
    "textStyle",
    "align",
    "layout",
    "gap",
    "padding",
    "icon",
    "arrow",
    "chart",
    "box",
  ],
  frame: ["color", "text", "textStyle", "icon", "arrow"],
  shape: ["layout", "gap", "padding", "chart"],
}
const roleTarget = /^([a-z0-9]{1,16}:[0-9]{1,12})\.(title|subtitle|body)$/

function targetNode(draft: Draft, target: string): Node {
  const role = roleTarget.exec(target)
  if (role === null) return living(draft, readNodeId(target) ?? stop("shape", undefined, "target"), "target")
  const slide = living(draft, role[1] as NodeId, "target")
  if (slide.type !== "slide") stop("shape", slide.id, "target")
  const found = descendantsOf(draft.scene, slide.id).find(
    (node) => node.type === "shape" && get(node, "role") === role[2],
  )
  return found ?? stop("missing", slide.id, "target")
}

function setBar(draft: Draft, change: SetChange, at: number): void {
  const frame = living(draft, readNodeId(change.target.slice(0, at)) ?? stop("missing", undefined, "target"), "target")
  const chart = get(frame, "chart") ?? stop("shape", frame.id, "target")
  const bar = change.target.slice(at + 1)
  const known = chart.series.some((series) => chart.categories.some((category) => bar === `${series.name}:${category}`))
  if (!known) stop("missing", frame.id, "target")
  for (const [key, value] of Object.entries(change))
    if (value !== undefined && key !== "op" && key !== "target" && key !== "fill") stop("shape", frame.id, key)
  const fill = change.fill ?? stop("shape", frame.id, "fill")
  if (typeof fill === "object") stop("shape", frame.id, "fill")
  const { [change.target]: _was, ...others } = chart.points ?? {}
  put(draft, frame.id, {
    chart: { ...chart, points: fill === "none" ? others : { ...others, [change.target]: colorOf(fill) } },
  })
}

function geometryOf(node: Node, change: SetChange): Geometry | undefined {
  const geometry = get(node, "geometry")
  if (change.icon !== undefined) {
    if (geometry?.kind !== "icon") stop("shape", node.id, "icon")
    return { kind: "icon", name: iconName(change.icon) }
  }
  if (change.arrow !== undefined && geometry?.kind !== "line") stop("shape", node.id, "arrow")
  if (geometry?.kind !== "line") return undefined
  const box = change.box
  const pointed = "x" in geometry.start && "x" in geometry.end
  if (change.arrow === undefined && !(box !== undefined && pointed)) return undefined
  return {
    ...geometry,
    ...(box !== undefined && pointed
      ? { start: { x: box.x, y: box.y }, end: { x: box.x + box.w, y: box.y + box.h } }
      : {}),
    arrows: [geometry.arrows[0], change.arrow === undefined ? geometry.arrows[1] : change.arrow ? "arrow" : "none"],
  }
}

export function compileSet(draft: Draft, change: SetChange): void {
  const at = change.target.indexOf("#")
  if (at >= 0) return setBar(draft, change, at)
  const node = targetNode(draft, change.target)
  if (node.type !== "slide" && node.type !== "frame" && node.type !== "shape") stop("shape", node.id, "target")
  for (const field of [...neverOnSet, ...unfit[node.type]])
    if (change[field] !== undefined) stop("shape", node.id, field)
  const now = {
    stroke: get(node, "stroke"),
    box: get(node, "box"),
    layout: get(node, "layout"),
    text: get(node, "text"),
  }
  const geometry = get(node, "geometry")
  const stroked = geometry?.kind === "line" || geometry?.kind === "icon" ? "center" : "inside"
  const text = node.type === "shape" ? textOfLook(change, now.text, "body") : undefined
  const layout = node.type === "frame" ? layoutOf(change, now.layout, gapFor(slideSize(draft).w)) : undefined
  const asked = (["layout", "gap", "padding", "align"] as const).find(
    (field) => node.type === "frame" && change[field] !== undefined,
  )
  if (asked !== undefined && layout === undefined) stop("shape", node.id, asked)
  if (change.chart !== undefined && get(node, "chart") === undefined) stop("shape", node.id, "chart")
  const shaped = geometryOf(node, change)
  const values: Values = {
    ...surfaceOf(change, now, stroked),
    ...(text === undefined ? {} : { text }),
    ...(layout === undefined ? {} : { layout }),
    ...(shaped === undefined ? {} : { geometry: shaped }),
    ...(change.chart === undefined ? {} : { chart: chartOf(change.chart) }),
  }
  put(draft, node.id, values)
}
