import type { AgentAdd, AgentChange, AgentLook } from "./agent-change.js"
import { type Draft, create, living, put, stop } from "./agent-draft.js"
import { chartOf, iconName, layoutOf, solid, surfaceOf, textOfLook } from "./agent-look.js"
import { addGrid, addPattern } from "./agent-patterns.js"
import { placeholderTitle } from "./placeholder-title.js"
import { placeholderSubtitle } from "./slide-placeholders.js"
import { type Area, areaFor, cardRadiusFor, gapFor, slideSize, themeOf } from "./agent-place.js"
import { pictureFit } from "./picture-fit.js"
import type { Box } from "./doom-walk.js"
import { descendantsOf, get, isLaidOut, slideOf, zeroBox } from "./doom-walk.js"
import type { Node } from "./doom.js"
import type { Text } from "./text.js"
import { textHeight } from "./text-estimate.js"

type Add = Extract<AgentChange, { op: "add" }>

const common = ["box", "name", "hidden", "opacity", "effect", "rotation", "flip"] as const
const painted = ["fill", "stroke", "strokeWidth", "radius", "dash"] as const
const words = [
  "text",
  "textStyle",
  "align",
  "color",
  "size",
  "font",
  "lineHeight",
  "letterSpacing",
  "case",
  "underline",
  "strike",
] as const
const patternFields = ["box", "name", "hidden", "items"] as const

const takes: Readonly<Record<AgentAdd, readonly (keyof AgentLook)[]>> = {
  text: [...common, ...painted, ...words],
  shape: [...common, ...painted, ...words],
  line: [...common, "stroke", "strokeWidth", "arrow", "dash"],
  frame: [...common, ...painted, "layout", "gap", "padding", "align", "rows"],
  picture: [...common, "fill", "stroke", "strokeWidth", "radius", "dash", "fit"],
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

function emptyPlaceholderOf(draft: Draft, slide: Node, role: "title" | "subtitle", prompt: string): Node | undefined {
  return descendantsOf(draft.doom, slide.id).find((node) => {
    const chars = get(node, "text")?.chars
    return get(node, "role") === role && (chars === "" || chars === prompt)
  })
}

function emptyPlaceholderFor(draft: Draft, slide: Node, style: Text["style"], boxed: boolean): Node | undefined {
  if (style === "title") return emptyPlaceholderOf(draft, slide, "title", placeholderTitle)
  return boxed ? undefined : emptyPlaceholderOf(draft, slide, "subtitle", placeholderSubtitle)
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
  const empty =
    kind === "text" && made !== undefined
      ? emptyPlaceholderFor(draft, slide, made.style, change.box !== undefined)
      : undefined
  if (empty !== undefined) {
    const held = get(empty, "text") as Text
    const { textStyle: _, ...unstyled } = change
    const { chars, spans, paras } = textOfLook(unstyled, held, held.style) as Text
    put(draft, empty.id, { text: { ...held, chars, spans, paras } })
    return
  }
  const area =
    kind === "text" && change.box === undefined ? areaFor(draft, parent, undefined) : areaFor(draft, parent, change.box)
  const fixed = change.box !== undefined || labelled
  const high =
    fixed || made === undefined
      ? area.h
      : Math.min(area.h, Math.max(1, Math.round(textHeight(made, themeOf(draft), area.w))))
  const filled = kind === "shape" && change.fill === undefined && change.stroke === undefined
  const titled =
    kind === "text" &&
    made?.style === "title" &&
    !descendantsOf(draft.doom, slide.id).some((node) => get(node, "role") === "title")
  create(draft, "shape", parent.id, {
    ...surfaceOf(change),
    ...(labelled && change.radius === undefined ? { radius: cardRadiusFor(slideSize(draft).w) } : {}),
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
  if (change.align === "justify") stop("shape", undefined, "align")
  const area = areaFor(draft, parent, change.box)
  const layout = layoutOf(change, undefined, gapFor(slideSize(draft).w))
  create(draft, "frame", parent.id, {
    ...surfaceOf(change),
    box: givenBox(change, area),
    ...(layout === undefined ? {} : { layout }),
  })
}

const centred = (area: Area, size: { readonly w: number; readonly h: number }) => ({
  x: area.x + Math.round((area.w - size.w) / 2),
  y: area.y + Math.round((area.h - size.h) / 2),
  ...size,
})

function addPicture(draft: Draft, parent: Node, change: Add): void {
  if (typeof change.fill !== "object" || !("image" in change.fill)) stop("shape", undefined, "fill")
  const area = areaFor(draft, parent, change.box)
  const natural = draft.reading.pictures?.get(change.fill.image)
  const fitted =
    change.box !== undefined || natural === undefined ? area : { ...area, ...centred(area, pictureFit(natural, area)) }
  create(draft, "shape", parent.id, { ...surfaceOf(change), box: givenBox(change, fitted), geometry: { kind: "rect" } })
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
  if (change.into !== undefined && (parent.type !== "frame" || slideOf(draft.doom, parent.id) !== slide.id))
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
