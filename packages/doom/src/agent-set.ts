import type { AgentChange, AgentLook } from "./agent-change.js"
import { type Draft, type Values, Stop, living, put, stop } from "./agent-draft.js"
import { insertLinkedRun } from "./agent-insert.js"
import { askedArrow, chartOf, colorOf, iconName, layoutOf, surfaceOf, textOfLook } from "./agent-look.js"
import { lineEnds } from "./agent-line-ends.js"
import { gapFor, slideSize, themeOf } from "./agent-place.js"
import { notesText } from "./notes-text.js"
import { resizedBy } from "./agent-resize.js"
import { regenerateComponent } from "./component/join-instance.js"
import { resolveComponent } from "./component/library.js"
import { isRefusal } from "./refusal.js"
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
    "transition",
    ...wordsOnly,
  ],
  shape: ["layout", "gap", "notes", "clip", "skipped", "transition"],
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
  const pathField = change.d !== undefined ? "d" : change.fillStroke !== undefined ? "fillStroke" : undefined
  if (pathField !== undefined && geometry?.kind !== "path") stop("shape", node.id, pathField, "needs", "a path")
  if (change.icon !== undefined) {
    if (geometry?.kind !== "icon") stop("shape", node.id, "icon", "needs", "an icon")
    return { kind: "icon", name: iconName(change.icon) }
  }
  const lined = (["startArrow", "arrow", "from", "to", "route"] as const).find((field) => change[field] !== undefined)
  if (lined !== undefined && geometry?.kind !== "line") stop("shape", node.id, lined, "needs", "a line")
  if (pathField !== undefined && geometry?.kind === "path") {
    return {
      ...geometry,
      ...(change.d === undefined ? {} : { d: change.d }),
      ...(change.fillStroke === undefined ? {} : { fillStroke: change.fillStroke }),
    }
  }
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

const componentFields = ["data", "variant", "tokens"] as const

function setComponent(draft: Draft, change: SetChange, field: (typeof componentFields)[number]): void {
  const { target, data, variant, tokens, op: _op, ...other } = change
  const extra = Object.entries(other).find(([, value]) => value !== undefined)
  if (extra !== undefined)
    stop(
      "shape",
      undefined,
      extra[0],
      "form",
      "Set data, variant and tokens together. Use another change for layer styling.",
    )
  const id = readNodeId(target) ?? stop("shape", undefined, "target", "form", "A linked component instance id.")
  const node = living(draft, id, "target")
  const instance = propOf(node, "instance") ?? stop("shape", id, field, "needs", "a linked component instance")
  const definition = resolveComponent(instance.component)
  if (definition === undefined) stop("shape", id, "target", "form", "A component available in this build.")
  const updated = regenerateComponent(
    draft.doom,
    id,
    {
      ...(data === undefined ? {} : { data }),
      ...(variant === undefined ? {} : { variant }),
      ...(tokens === undefined ? {} : { tokens }),
    },
    draft.reading.measure ?? estimate,
    definition,
  )
  if (isRefusal(updated)) throw new Stop(updated)
  draft.writes.push(...updated.writes)
}

export function compileSet(draft: Draft, change: SetChange): void {
  if (change.component !== undefined)
    stop("shape", undefined, "component", "unknown", "Set data, variant or tokens on an instance.")
  const componentField = componentFields.find((field) => change[field] !== undefined)
  if (componentField !== undefined) return setComponent(draft, change, componentField)
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
  const stroked =
    geometry?.kind === "line" || geometry?.kind === "icon" || geometry?.kind === "path" ? "center" : "inside"
  const current = now.text
  if (change.insert !== undefined && change.text !== undefined)
    stop("shape", node.id, "insert", "form", "Insert or text, not both.")
  if (change.insert !== undefined && current === undefined) stop("shape", node.id, "insert", "needs", "a text layer")
  const held =
    change.insert === undefined || current === undefined
      ? current
      : insertLinkedRun(current, change.insert.at, change.insert.text, change.insert.link)
  if (node.type === "shape" && change.padding !== undefined && held === undefined && change.text === undefined)
    stop("shape", node.id, "padding", "needs", "a text layer")
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
    ...(change.transition === undefined ? {} : { transition: change.transition }),
  }
  if (layout?.mode === "none" && now.layout !== undefined && now.layout.mode !== "none")
    draft.writes.push(
      ...(draft.reading.bake?.(node.id) ?? bakeLayout(draft.doom, node.id, draft.reading.measure ?? estimate)).filter(
        (write) => write.node !== node.id || !(write.prop in values),
      ),
    )
  put(draft, node.id, values)
  if (change.link === "none") draft.writes.push({ node: node.id, prop: "link", value: null })
}
