import type { AgentChange, AgentLook } from "./agent-change.js"
import { type Draft, type Values, living, put, stop } from "./agent-draft.js"
import { insertLinkedRun } from "./agent-insert.js"
import { askedArrow, iconName, layoutOf, surfaceOf, textOfLook } from "./agent-look.js"
import { laneOf, lineEnds } from "./agent-line-ends.js"
import { gapFor, slideSize, themeOf } from "./agent-place.js"
import { notesText } from "./notes-text.js"
import { resizedBy } from "./agent-resize.js"
import { bakeLayout } from "./bake-layout.js"
import { measureWith } from "./measure.js"
import { type NodeId, readNodeId } from "./ids.js"
import type { Geometry } from "./geometry.js"
import type { Node } from "./doom.js"
import { descendantsOf, propOf, slideOf, slidesOf } from "./doom-walk.js"

type SetChange = Extract<AgentChange, { op: "set" }>

const estimate = measureWith({})

const neverOnSet = ["rows"] as const
const wordsOnly = [
  "language",
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
    "lane",
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
    "lane",
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
        stop("shape", undefined, "target", "form", "A node id, a slide role, or every slide's role."),
      "target",
    )
  const slide = living(draft, role[1] as NodeId, "target")
  if (slide.type !== "slide") stop("shape", slide.id, "target", "form", "A slide id, then .title, .subtitle or .body.")
  const found = descendantsOf(draft.doom, slide.id).find(
    (node) => node.type === "shape" && propOf(node, "role") === role[2],
  )
  return found ?? stop("missing", slide.id, "target")
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
  const lined = (["startArrow", "arrow", "from", "to", "route", "lane"] as const).find(
    (field) => change[field] !== undefined,
  )
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
  const ends = lineEnds(draft, { self: node.id, slide: slideOf(draft.doom, node.id) }, placed, change)
  return {
    ...placed,
    ...ends,
    ...(change.route === undefined ? {} : { route: change.route }),
    arrows: [change.startArrow ?? geometry.arrows[0], askedArrow(change.arrow, geometry.arrows[1])],
    ...(change.lane === undefined ? {} : { channels: laneOf(ends.start, ends.end, change.lane) }),
  }
}

export function compileSet(draft: Draft, change: SetChange): void {
  if (change.insert !== undefined && change.target.startsWith("*."))
    stop("shape", undefined, "insert", "needs", "a text layer")
  if (change.target.startsWith("*.")) return setEverySlide(draft, change, change.target.slice(2))
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
    box: draft.reading.boxes?.get(node.id) ?? propOf(node, "box"),
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
