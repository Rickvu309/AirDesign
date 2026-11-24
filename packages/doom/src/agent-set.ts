import type { AgentChange, AgentLook } from "./agent-change.js"
import { type Draft, type Values, living, put, stop } from "./agent-draft.js"
import { insertLinkedRun } from "./agent-insert.js"
import { askedArrow, chartOf, colorOf, iconName, layoutOf, surfaceOf, textOfLook } from "./agent-look.js"
import { lineEnds } from "./agent-line-ends.js"
import { gapFor, slideSize, themeOf } from "./agent-place.js"
import { notesText } from "./notes-text.js"
import { resizedBy } from "./agent-resize.js"
import { bakeLayout } from "./bake-layout.js"
import { measureWith } from "./measure.js"
import { chartKeepingPoints, chartWithPointColor } from "./chart.js"
import { type NodeId, readNodeId } from "./ids.js"
import type { Geometry } from "./geometry.js"
import type { Node } from "./doom.js"
import { descendantsOf, propOf, slideOf, slidesOf } from "./doom-walk.js"

type SetChange = Extract<AgentChange, { op: "set" }>

const estimate = measureWith({})

const neverOnSet = ["rows", "items", "axes"] as const
const wordsOnly = [
  "size",
  "font",
  "weight",
  "lineHeight",
  "letterSpacing",
  "case",
  "underline",
  "strike",
  "alignV",
  "spaceBefore",
  "spaceAfter",
] as const
const unfit: Readonly<Record<"slide" | "frame" | "shape", readonly (keyof AgentLook)[]>> = {
  slide: [
    ...wordsOnly,
    "blur",
    "locked",
    "shape",
    "dash",
    "fit",
    "crop",
    "rotation",
    "flip",
    "stroke",
    "strokeWidth",
    "color",
    "radius",
    "effect",
    "effectOpacity",
    "innerShadow",
    "clip",
    "mask",
    "opacity",
    "text",
    "insert",
    "textStyle",
    "align",
    "layout",
    "gap",
    "padding",
    "icon",
    "arrow",
    "startArrow",
    "from",
    "to",
    "route",
    "box",
  ],
  frame: [
    "color",
    "text",
    "insert",
    "textStyle",
    "icon",
    "arrow",
    "startArrow",
    "from",
    "to",
    "route",
    "notes",
    "shape",
    "skipped",
    "source",
    "transition",
    ...wordsOnly,
  ],
  shape: ["layout", "gap", "padding", "notes", "clip", "skipped", "source", "transition"],
}
const roleTarget = /^([a-z0-9]{1,16}:[0-9]{1,12})\.(title|subtitle|body)$/

function targetNode(draft: Draft, target: string): Node {
  const role = roleTarget.exec(target)
  if (role === null)
    return living(
      draft,
      readNodeId(target) ??
        stop("shape", undefined, "target", "form", "A node id, a slide role, every slide's role, or a chart bar."),
      "target",
    )
  const slide = living(draft, role[1] as NodeId, "target")
  if (slide.type !== "slide") stop("shape", slide.id, "target", "form", "A slide id, then .title, .subtitle or .body.")
  const found = descendantsOf(draft.doom, slide.id).find(
    (node) => node.type === "shape" && propOf(node, "role") === role[2],
  )
  return found ?? stop("missing", slide.id, "target")
}

function setBar(draft: Draft, change: SetChange, at: number): void {
  const frame = living(draft, readNodeId(change.target.slice(0, at)) ?? stop("missing", undefined, "target"), "target")
  const chart =
    propOf(frame, "chart") ?? stop("shape", frame.id, "target", "form", "A chart id, then #series:category.")
  const bar = change.target.slice(at + 1)
  const found = chart.series.flatMap((series, index) =>
    chart.categories.flatMap((category, place) => (bar === `${series.name}:${category}` ? [{ index, place }] : [])),
  )
  const mark = found[0] ?? stop("missing", frame.id, "target")
  if (found.length > 1)
    stop(
      "shape",
      frame.id,
      "target",
      "form",
      "Names one bar. To colour bars that share names, set chart with series points.",
    )
  for (const [key, value] of Object.entries(change))
    if (value !== undefined && key !== "op" && key !== "target" && key !== "fill")
      stop("shape", frame.id, key, "unknown", "fill.")
  const fill = change.fill ?? stop("shape", frame.id, "fill", "missing", "A theme colour, a hex or none.")
  if (typeof fill === "object") stop("shape", frame.id, "fill", "form", "A theme colour, a hex or none.")
  put(draft, frame.id, {
    chart: chartWithPointColor(chart, mark.index, mark.place, fill === "none" ? null : colorOf(fill)),
  })
}

function setEverySlide(draft: Draft, change: SetChange, role: string): void {
  const slides = slidesOf(draft.doom).filter((slide) =>
    descendantsOf(draft.doom, slide.id).some((node) => propOf(node, "role") === role),
  )
  if (slides.length === 0) stop("missing", undefined, "target")
  for (const slide of slides) compileSet(draft, { ...change, target: `${slide.id}.${role}` })
}

function geometryOf(draft: Draft, node: Node, change: SetChange): Geometry | undefined {
  const geometry = propOf(node, "geometry")
  if (change.icon !== undefined) {
    if (geometry?.kind !== "icon") stop("shape", node.id, "icon", "needs", "an icon")
    return { kind: "icon", name: iconName(change.icon) }
  }
  const lined = (["startArrow", "arrow", "from", "to", "route"] as const).find((field) => change[field] !== undefined)
  if (lined !== undefined && geometry?.kind !== "line") stop("shape", node.id, lined, "needs", "a line")
  if (geometry?.kind !== "line") return undefined
  const box = change.box
  const pointed = "x" in geometry.start && "x" in geometry.end
  if (lined === undefined && !(box !== undefined && pointed)) return undefined
  const placed =
    box !== undefined && pointed
      ? { ...geometry, start: { x: box.x, y: box.y }, end: { x: box.x + box.w, y: box.y + box.h } }
      : geometry
  return {
    ...placed,
    ...lineEnds(draft, { self: node.id, slide: slideOf(draft.doom, node.id) }, placed, change),
    ...(change.route === undefined ? {} : { route: change.route }),
    arrows: [change.startArrow ?? geometry.arrows[0], askedArrow(change.arrow, geometry.arrows[1])],
  }
}

export function compileSet(draft: Draft, change: SetChange): void {
  if (change.insert !== undefined && (change.target.startsWith("*.") || change.target.includes("#")))
    stop("shape", undefined, "insert", "needs", "a text layer")
  if (change.target.startsWith("*.")) return setEverySlide(draft, change, change.target.slice(2))
  const at = change.target.indexOf("#")
  if (at >= 0) return setBar(draft, change, at)
  const node = targetNode(draft, change.target)
  if (node.type !== "slide" && node.type !== "frame" && node.type !== "shape")
    stop("shape", node.id, "target", "form", "A slide, a frame or a shape.")
  for (const field of [...neverOnSet, ...unfit[node.type]])
    if (change[field] !== undefined) stop("shape", node.id, field, "unknown")
  const fitting = change.fit !== undefined || change.crop !== undefined
  if (fitting && !(propOf(node, "fills") ?? []).some((paint) => paint.kind === "image"))
    stop("shape", node.id, change.crop === undefined ? "fit" : "crop", "needs", "an image fill")
  if (change.crop !== undefined && change.fit !== undefined && change.fit !== "crop")
    stop("shape", node.id, "crop", "form", "fit crop, or no fit.")
  const outline = propOf(node, "geometry")?.kind
  if (change.shape !== undefined && (outline === "line" || outline === "icon" || outline === "path"))
    stop("shape", node.id, "shape", "needs", "a preset outline")
  if (change.link !== undefined && propOf(node, "text") === undefined)
    stop("shape", node.id, "link", "needs", "a text layer")
  const now = {
    fills: propOf(node, "fills"),
    stroke: propOf(node, "stroke"),
    box: propOf(node, "box"),
    layout: propOf(node, "layout"),
    text: propOf(node, "text"),
    effects: propOf(node, "effects"),
  }
  const geometry = propOf(node, "geometry")
  const stroked = geometry?.kind === "line" || geometry?.kind === "icon" ? "center" : "inside"
  const current = now.text
  if (change.insert !== undefined && change.text !== undefined)
    stop("shape", node.id, "insert", "form", "Insert or text, not both.")
  if (change.insert !== undefined && current === undefined) stop("shape", node.id, "insert", "needs", "a text layer")
  const held =
    change.insert === undefined || current === undefined
      ? current
      : insertLinkedRun(current, change.insert.at, change.insert.text, change.insert.link)
  const worded = node.type === "shape" ? textOfLook(change, held, "body", themeOf(draft)) : undefined
  const written = worded ?? (change.insert === undefined ? undefined : held)
  const text = resizedBy(written ?? now.text, change.box, now.box) ?? written
  const layout = node.type === "frame" ? layoutOf(change, now.layout, gapFor(slideSize(draft).w)) : undefined
  const asked = (["layout", "gap", "padding", "align"] as const).find(
    (field) => node.type === "frame" && change[field] !== undefined,
  )
  if (asked !== undefined && layout === undefined) stop("shape", node.id, asked, "needs", "a row or column layout")
  if (change.chart !== undefined && propOf(node, "chart") === undefined)
    stop("shape", node.id, "chart", "needs", "a chart layer")
  const shaped = geometryOf(draft, node, change)
  const values: Values = {
    ...surfaceOf(
      change,
      now,
      stroked,
      change.effectOpacity === undefined && change.blur === undefined && change.innerShadow === undefined
        ? undefined
        : themeOf(draft),
    ),
    ...(text === undefined ? {} : { text }),
    ...(layout === undefined ? {} : { layout }),
    ...(shaped === undefined ? {} : { geometry: shaped }),
    ...(change.chart === undefined ? {} : { chart: chartKeepingPoints(propOf(node, "chart"), chartOf(change.chart)) }),
    ...(change.notes === undefined ? {} : { notes: notesText(change.notes) }),
    ...(change.skipped === undefined ? {} : { skipped: change.skipped }),
    ...(change.source === undefined ? {} : { source: change.source }),
    ...(change.transition === undefined ? {} : { transition: change.transition }),
  }
  if (layout?.mode === "none" && now.layout !== undefined && now.layout.mode !== "none")
    draft.writes.push(
      ...bakeLayout(draft.doom, node.id, estimate).filter((write) => write.node !== node.id || !(write.prop in values)),
    )
  put(draft, node.id, values)
  if (change.link === "none") draft.writes.push({ node: node.id, prop: "link", value: null })
}
