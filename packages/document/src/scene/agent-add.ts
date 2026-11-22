import type { AgentAdd, AgentChange, AgentLook } from "./agent-change.js"
import { type Draft, create, living, stop } from "./agent-draft.js"
import { chartOf, iconName, layoutOf, solid, surfaceOf, textOfLook } from "./agent-look.js"
import { addGrid, addPattern } from "./agent-patterns.js"
import { type Area, areaFor, gapFor, slideSize, themeOf } from "./agent-place.js"
import type { Box } from "./scene-walk.js"
import { descendantsOf, get, isLaidOut, slideOf, zeroBox } from "./scene-walk.js"
import type { Node } from "./scene.js"
import { textHeight } from "./text-estimate.js"

type Add = Extract<AgentChange, { op: "add" }>

const common = ["box", "name", "hidden", "opacity", "effect"] as const
const painted = ["fill", "stroke", "strokeWidth", "radius"] as const
const words = ["text", "textStyle", "align", "color"] as const
const patternFields = ["box", "name", "hidden", "items"] as const

const takes: Readonly<Record<AgentAdd, readonly (keyof AgentLook)[]>> = {
  text: [...common, ...painted, ...words],
  shape: [...common, ...painted, ...words],
  line: [...common, "stroke", "strokeWidth", "arrow"],
  frame: [...common, ...painted, "layout", "gap", "padding", "align", "rows"],
  picture: [...common, "fill", "stroke", "strokeWidth", "radius"],
  icon: [...common, "icon", "stroke", "strokeWidth"],
  chart: [...common, ...painted, "chart"],
  kpi: patternFields,
  cards: patternFields,
  compare: patternFields,
  timeline: patternFields,
  flow: patternFields,
  matrix: [...patternFields, "axes"],
}

const iconSide = 96
const lineWeight = 3
const iconWeightShare = 12

const boxOf = (area: Area, h: number = area.h): Box => ({ ...zeroBox, x: area.x, y: area.y, w: area.w, h })
const givenBox = (look: AgentLook, area: Area, h?: number): Box =>
  look.box === undefined ? boxOf(area, h) : { ...zeroBox, ...look.box }

function checkFields(change: Add): void {
  const allowed = new Set<string>(["op", "kind", "slide", "into", ...takes[change.kind]])
  for (const [key, value] of Object.entries(change))
    if (value !== undefined && !allowed.has(key)) stop("shape", undefined, key)
}

const inkOn = (fill: AgentLook["fill"]) =>
  fill === undefined || (typeof fill === "string" && fill.startsWith("accent")) ? "background" : undefined

function addWords(draft: Draft, parent: Node, slide: Node, change: Add, kind: "text" | "shape"): void {
  if (kind === "text" && change.text === undefined) stop("shape", undefined, "text")
  const labelled = kind === "shape"
  const ink = change.color ?? inkOn(change.fill)
  const look: AgentLook =
    labelled && change.text !== undefined
      ? { ...change, align: change.align ?? "center", ...(ink === undefined ? {} : { color: ink }) }
      : change
  const made = textOfLook(look, undefined, "body")
  if (kind === "text" && made !== undefined && change.box === undefined && isLaidOut(parent)) {
    create(draft, "shape", parent.id, {
      ...surfaceOf(change),
      geometry: { kind: "rect" },
      sizing: { w: "fill", h: "hug" },
      text: made,
    })
    return
  }
  const area = areaFor(draft, parent, change.box)
  const fixed = change.box !== undefined || labelled
  const high =
    fixed || made === undefined
      ? area.h
      : Math.min(area.h, Math.max(1, Math.round(textHeight(made, themeOf(draft), area.w))))
  const filled = kind === "shape" && change.fill === undefined && change.stroke === undefined
  const titled =
    kind === "text" &&
    made?.style === "title" &&
    !descendantsOf(draft.scene, slide.id).some((node) => get(node, "role") === "title")
  create(draft, "shape", parent.id, {
    ...surfaceOf(change),
    ...(filled ? { fills: [solid("accent1")] } : {}),
    box: givenBox(change, area, high),
    geometry: { kind: "rect" },
    ...(titled ? { role: "title" as const } : {}),
    ...(made === undefined
      ? {}
      : { text: { ...made, resize: fixed ? "fixed" : "height", ...(labelled ? { alignV: "center" as const } : {}) } }),
  })
}

function addLine(draft: Draft, parent: Node, change: Add): void {
  const area = areaFor(draft, parent, change.box)
  const box = change.box === undefined ? boxOf(area, 0) : givenBox(change, area)
  create(draft, "shape", parent.id, {
    ...surfaceOf(
      { ...change, stroke: change.stroke ?? "text2", strokeWidth: change.strokeWidth ?? lineWeight },
      {},
      "center",
    ),
    box,
    geometry: {
      kind: "line",
      start: { x: box.x, y: box.y },
      end: { x: box.x + box.w, y: box.y + box.h },
      route: "straight",
      arrows: ["none", change.arrow === true ? "arrow" : "none"],
    },
  })
}

function addFrame(draft: Draft, parent: Node, change: Add): void {
  if (change.rows !== undefined) return addGrid(draft, parent, change)
  const area = areaFor(draft, parent, change.box)
  const layout = layoutOf(change, undefined, gapFor(slideSize(draft).w))
  create(draft, "frame", parent.id, {
    ...surfaceOf(change),
    box: givenBox(change, area),
    ...(layout === undefined ? {} : { layout }),
  })
}

function addPicture(draft: Draft, parent: Node, change: Add): void {
  if (typeof change.fill !== "object") stop("shape", undefined, "fill")
  const area = areaFor(draft, parent, change.box)
  create(draft, "shape", parent.id, { ...surfaceOf(change), box: givenBox(change, area), geometry: { kind: "rect" } })
}

function addIcon(draft: Draft, parent: Node, change: Add): void {
  if (change.icon === undefined) stop("shape", undefined, "icon")
  const area = areaFor(draft, parent, change.box)
  const side = Math.min(iconSide, area.w, area.h)
  const box = change.box === undefined ? boxOf({ ...area, w: side }, side) : givenBox(change, area)
  const weight = Math.max(2, Math.round(Math.min(box.w, box.h) / iconWeightShare))
  create(draft, "shape", parent.id, {
    ...surfaceOf(
      { ...change, stroke: change.stroke ?? "accent1", strokeWidth: change.strokeWidth ?? weight },
      {},
      "center",
    ),
    box,
    geometry: { kind: "icon", name: iconName(change.icon) },
  })
}

function addChart(draft: Draft, parent: Node, change: Add): void {
  if (change.chart === undefined) stop("shape", undefined, "chart")
  const area = areaFor(draft, parent, change.box)
  create(draft, "frame", parent.id, { ...surfaceOf(change), box: givenBox(change, area), chart: chartOf(change.chart) })
}

export function compileAdd(draft: Draft, change: Add): void {
  const slide = living(draft, change.slide, "slide")
  if (slide.type !== "slide") stop("shape", slide.id, "slide")
  const parent = change.into === undefined ? slide : living(draft, change.into, "into")
  if (change.into !== undefined && (parent.type !== "frame" || slideOf(draft.scene, parent.id) !== slide.id))
    stop("missing", parent.id, "into")
  if (get(parent, "chart") !== undefined) stop("shape", parent.id, "into")
  checkFields(change)
  switch (change.kind) {
    case "text":
    case "shape":
      return addWords(draft, parent, slide, change, change.kind)
    case "line":
      return addLine(draft, parent, change)
    case "frame":
      return addFrame(draft, parent, change)
    case "picture":
      return addPicture(draft, parent, change)
    case "icon":
      return addIcon(draft, parent, change)
    case "chart":
      return addChart(draft, parent, change)
    default:
      return addPattern(draft, parent, change)
  }
}
