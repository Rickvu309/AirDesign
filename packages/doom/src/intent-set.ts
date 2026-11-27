import type { Intent, IntentLook } from "./intent-read.js"
import { type Draft, type Values, living, put, stop } from "./intent-draft.js"
import { insertLinkedRun } from "./intent-insert.js"
import { askedArrow, iconName, layoutOf, surfaceOf, textOfLook } from "./intent-look.js"
import { laneOf, lineEnds } from "./intent-line-ends.js"
import { gapFor, slideSize, themeOf } from "./intent-place.js"
import { notesText } from "./notes-text.js"
import { resizedBy } from "./intent-resize.js"
import { bakeLayout } from "./bake-layout.js"
import { measureWith } from "./measure.js"
import { type NodeId, readNodeId } from "./ids.js"
import type { Geometry } from "./geometry.js"
import type { Node } from "./doom.js"
import { boxOf, descendantsOf, propOf, slideOf, slidesOf } from "./doom-walk.js"

type SetIntent = Extract<Intent, { op: "set" }>

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
const unfit: Readonly<Record<"slide" | "frame" | "shape", readonly (keyof IntentLook)[]>> = {
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
    return living(draft, readNodeId(target) ?? stop("shape", undefined, "target", "form", { code: "target" }), "target")
  const slide = living(draft, role[1] as NodeId, "target")
  if (slide.type !== "slide") stop("shape", slide.id, "target", "form", { code: "slide-role" })
  const found = descendantsOf(draft.doom, slide.id).find(
    (node) => node.type === "shape" && propOf(node, "role") === role[2],
  )
  return found ?? stop("missing", slide.id, "target")
}

function setEverySlide(draft: Draft, intent: SetIntent, role: string): void {
  const slides = slidesOf(draft.doom).filter((slide) =>
    descendantsOf(draft.doom, slide.id).some((node) => propOf(node, "role") === role),
  )
  if (slides.length === 0) stop("missing", undefined, "target")
  for (const slide of slides) compileSet(draft, { ...intent, target: `${slide.id}.${role}` })
}

function geometryOf(draft: Draft, node: Node, intent: SetIntent): Geometry | undefined {
  const geometry = propOf(node, "geometry")
  const pathField = intent.d !== undefined ? "d" : intent.fillStroke !== undefined ? "fillStroke" : undefined
  if (pathField !== undefined && geometry?.kind !== "path")
    stop("shape", node.id, pathField, "needs", { code: "needs-path" })
  if (intent.icon !== undefined) {
    if (geometry?.kind !== "icon") stop("shape", node.id, "icon", "needs", { code: "needs-icon" })
    return { kind: "icon", name: iconName(intent.icon) }
  }
  const lined = (["startArrow", "arrow", "from", "to", "route", "lane"] as const).find(
    (field) => intent[field] !== undefined,
  )
  if (lined !== undefined && geometry?.kind !== "line") stop("shape", node.id, lined, "needs", { code: "needs-line" })
  if (pathField !== undefined && geometry?.kind === "path") {
    return {
      ...geometry,
      ...(intent.d === undefined ? {} : { d: intent.d }),
      ...(intent.fillStroke === undefined ? {} : { fillStroke: intent.fillStroke }),
    }
  }
  if (geometry?.kind !== "line") return undefined
  const box = intent.box === undefined ? undefined : { ...boxOf(node, draft.reading.boxes), ...intent.box }
  const pointed = "x" in geometry.start && "x" in geometry.end
  if (lined === undefined && !(box !== undefined && pointed)) return undefined
  const placed =
    box !== undefined && pointed
      ? { ...geometry, start: { x: box.x, y: box.y }, end: { x: box.x + box.w, y: box.y + box.h } }
      : geometry
  const ends = lineEnds(draft, { self: node.id, slide: slideOf(draft.doom, node.id) }, placed, intent)
  return {
    ...placed,
    ...ends,
    ...(intent.route === undefined ? {} : { route: intent.route }),
    arrows: [intent.startArrow ?? geometry.arrows[0], askedArrow(intent.arrow, geometry.arrows[1])],
    ...(intent.lane === undefined ? {} : { channels: laneOf(ends.start, ends.end, intent.lane) }),
  }
}

export function compileSet(draft: Draft, intent: SetIntent): void {
  if (intent.insert !== undefined && intent.target.startsWith("*."))
    stop("shape", undefined, "insert", "needs", { code: "needs-text" })
  if (intent.target.startsWith("*.")) return setEverySlide(draft, intent, intent.target.slice(2))
  const node = targetNode(draft, intent.target)
  if (node.type !== "slide" && node.type !== "frame" && node.type !== "shape")
    stop("shape", node.id, "target", "form", { code: "copyable-node" })
  for (const field of [...neverOnSet, ...unfit[node.type]])
    if (intent[field] !== undefined) stop("shape", node.id, field, "unknown")
  const fitting = intent.fit !== undefined || intent.crop !== undefined
  if (fitting && !(propOf(node, "fills") ?? []).some((paint) => paint.kind === "image"))
    stop("shape", node.id, intent.crop === undefined ? "fit" : "crop", "needs", { code: "needs-image" })
  if (intent.crop !== undefined && intent.fit !== undefined && intent.fit !== "crop")
    stop("shape", node.id, "crop", "form", { code: "crop-fit" })
  const outline = propOf(node, "geometry")?.kind
  if (intent.shape !== undefined && (outline === "line" || outline === "icon" || outline === "path"))
    stop("shape", node.id, "shape", "needs", { code: "needs-preset" })
  if (intent.link !== undefined && propOf(node, "text") === undefined)
    stop("shape", node.id, "link", "needs", { code: "needs-text" })
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
  if (intent.insert !== undefined && intent.text !== undefined)
    stop("shape", node.id, "insert", "form", { code: "insert-or-text" })
  if (intent.insert !== undefined && current === undefined)
    stop("shape", node.id, "insert", "needs", { code: "needs-text" })
  const held =
    intent.insert === undefined || current === undefined
      ? current
      : insertLinkedRun(current, intent.insert.at, intent.insert.text, intent.insert.link)
  if (node.type === "shape" && intent.padding !== undefined && held === undefined && intent.text === undefined)
    stop("shape", node.id, "padding", "needs", { code: "needs-text" })
  const worded = node.type === "shape" ? textOfLook(intent, held, "body", themeOf(draft)) : undefined
  const written = worded ?? (intent.insert === undefined ? undefined : held)
  const text = resizedBy(written ?? now.text, intent.box, now.box) ?? written
  const layout =
    node.type === "frame" ? layoutOf(intent, now.layout, gapFor(slideSize(draft).w, draft.placement)) : undefined
  const asked = (["layout", "gap", "padding", "align"] as const).find(
    (field) => node.type === "frame" && intent[field] !== undefined,
  )
  if (asked !== undefined && layout === undefined) stop("shape", node.id, asked, "needs", { code: "needs-layout" })
  const shaped = geometryOf(draft, node, intent)
  const values: Values = {
    ...surfaceOf(
      intent,
      draft.placement.strokeWeight,
      now,
      stroked,
      intent.effectOpacity === undefined && intent.blur === undefined && intent.innerShadow === undefined
        ? undefined
        : themeOf(draft),
    ),
    ...(text === undefined ? {} : { text }),
    ...(layout === undefined ? {} : { layout }),
    ...(shaped === undefined ? {} : { geometry: shaped }),
    ...(intent.notes === undefined ? {} : { notes: notesText(intent.notes) }),
    ...(intent.skipped === undefined ? {} : { skipped: intent.skipped }),
    ...(intent.transition === undefined ? {} : { transition: intent.transition }),
  }
  if (layout?.mode === "none" && now.layout !== undefined && now.layout.mode !== "none")
    draft.writes.push(
      ...(draft.reading.bake?.(node.id) ?? bakeLayout(draft.doom, node.id, draft.reading.measure ?? estimate)).filter(
        (write) => write.node !== node.id || !(write.prop in values),
      ),
    )
  put(draft, node.id, values)
  if (intent.link === "none") draft.writes.push({ node: node.id, prop: "link", value: null })
}
