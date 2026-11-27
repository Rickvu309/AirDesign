import type { Intent, IntentLook } from "./intent-read.js"
import type { LayerKind } from "./kind-fields.js"
import { shapeGeometry } from "./preset-geometry.js"
import { type Draft, create, fitKind, living, put, stop } from "./intent-draft.js"
import { askedArrow, iconName, layoutOf, solid, surfaceOf, textOfLook, turnOf, type Now } from "./intent-look.js"
import { addGrid } from "./intent-grid.js"
import type { StartRules } from "./start-rules.js"
import { type Area, areaFor, cardRadiusFor, gapFor, slideSize, themeOf } from "./intent-place.js"
import { laneOf, lineEnds, spanOfEnds } from "./intent-line-ends.js"
import { pictureFit } from "./picture-fit.js"
import type { StrokeStyle } from "./paint.js"
import type { Box } from "./doom-walk.js"
import type { Geometry } from "./geometry.js"
import { descendantsOf, isLaidOut, propOf, slideOf, zeroBox } from "./doom-walk.js"
import type { Node } from "./doom.js"
import type { Text } from "./text.js"
import { textHeight } from "./text-estimate.js"

type Add = Extract<Intent, { op: "insert"; kind: LayerKind }>

const titleStyles: ReadonlySet<Text["style"]> = new Set(["display", "title"])
function surfaced(draft: Draft, look: IntentLook, now: Now = {}, align: StrokeStyle["align"] = "inside") {
  const themed = look.effectOpacity !== undefined || look.blur !== undefined || look.innerShadow !== undefined
  return surfaceOf(look, draft.placement.strokeWeight, now, align, themed ? themeOf(draft) : undefined)
}

const givenBox = (look: IntentLook, area: Area, h: number = area.h, grows = false): Box => ({
  ...zeroBox,
  ...(look.box === undefined ? { x: area.x, y: area.y, w: area.w, h } : { ...look.box, ...(grows ? { h } : {}) }),
  ...turnOf(look),
})

function emptyPlaceholderOf(
  draft: Draft,
  slide: Node,
  role: "title" | "subtitle",
  starts: StartRules,
): Node | undefined {
  return descendantsOf(draft.doom, slide.id).find((node) => {
    const chars = propOf(node, "text")?.chars
    return propOf(node, "role") === role && (chars === "" || chars === starts[role].chars)
  })
}

function emptyPlaceholderFor(
  draft: Draft,
  slide: Node,
  style: Text["style"],
  boxed: boolean,
  starts: StartRules,
): Node | undefined {
  if (titleStyles.has(style)) return emptyPlaceholderOf(draft, slide, "title", starts)
  return boxed ? undefined : emptyPlaceholderOf(draft, slide, "subtitle", starts)
}

const inkOn = (fill: IntentLook["fill"]) =>
  fill === undefined || (typeof fill === "string" && fill.startsWith("accent")) ? "background" : undefined

function addWords(
  draft: Draft,
  parent: Node,
  slide: Node,
  intent: Add,
  kind: "text" | "shape" | "path",
  starts: StartRules | undefined,
): void {
  if (kind === "text" && intent.text === undefined)
    stop("shape", undefined, "text", "missing", { code: "nonempty-string" })
  const labelled = kind !== "text"
  const geometry =
    kind === "path"
      ? {
          kind: "path" as const,
          d: intent.d ?? stop("shape", undefined, "d", "missing", { code: "path-data" }),
          ...(intent.fillStroke === undefined ? {} : { fillStroke: intent.fillStroke }),
        }
      : shapeGeometry(intent.shape ?? "rect")
  const ink = intent.color ?? inkOn(intent.fill)
  const look: IntentLook =
    labelled && intent.text !== undefined
      ? { ...intent, align: intent.align ?? "center", ...(ink === undefined ? {} : { color: ink }) }
      : intent
  const made = textOfLook(look, undefined, "body", themeOf(draft))
  if (intent.link !== undefined && intent.link !== "none" && made === undefined)
    stop("shape", undefined, "link", "needs", { code: "needs-text" })
  if (kind === "text" && made !== undefined && intent.box === undefined && isLaidOut(parent)) {
    create(draft, "shape", parent.id, {
      ...surfaced(draft, intent),
      geometry: { kind: "rect" },
      sizing: { w: "fill", h: "hug" },
      text: made,
    })
    return
  }
  const empty =
    kind === "text" && made !== undefined && starts !== undefined
      ? emptyPlaceholderFor(draft, slide, made.style, intent.box !== undefined, starts)
      : undefined
  if (empty !== undefined) {
    const held = propOf(empty, "text") as Text
    const { textStyle: _, ...unstyled } = intent
    const next = textOfLook(unstyled, held, held.style, themeOf(draft)) as Text
    put(draft, empty.id, {
      ...surfaced(draft, intent, {
        fills: propOf(empty, "fills"),
        stroke: propOf(empty, "stroke"),
        box: propOf(empty, "box"),
      }),
      text: { ...held, chars: next.chars, spans: next.spans, paras: next.paras, alignV: next.alignV },
    })
    return
  }
  const area =
    kind === "text" && intent.box === undefined ? areaFor(draft, parent, undefined) : areaFor(draft, parent, intent.box)
  const grows = !labelled && made !== undefined
  const wordsHigh = (w: number) => Math.max(1, Math.round(textHeight(made!, themeOf(draft), w)))
  const high = !grows
    ? area.h
    : intent.box === undefined
      ? Math.min(area.h, wordsHigh(area.w))
      : wordsHigh(intent.box.w)
  const filled = labelled && intent.fill === undefined && intent.stroke === undefined
  const titled =
    kind === "text" &&
    made !== undefined &&
    titleStyles.has(made.style) &&
    !descendantsOf(draft.doom, slide.id).some((node) => propOf(node, "role") === "title")
  create(draft, "shape", parent.id, {
    ...surfaced(draft, intent, {}, kind === "path" ? "center" : "inside"),
    ...(kind === "shape" && intent.radius === undefined
      ? { radius: cardRadiusFor(slideSize(draft).w, draft.placement) }
      : {}),
    ...(filled ? { fills: [solid("accent1")] } : {}),
    box: givenBox(intent, area, high, grows),
    geometry,
    ...(titled ? { role: "title" as const } : {}),
    ...(made === undefined
      ? {}
      : {
          text: {
            ...made,
            resize: labelled ? "fixed" : "height",
            ...(labelled ? { alignV: intent.alignV ?? "center" } : {}),
          },
        }),
  })
}

function lineGeometry(draft: Draft, parent: Node, box: Box, intent: Add): Extract<Geometry, { kind: "line" }> {
  const ends = lineEnds(
    draft,
    { self: null, slide: slideOf(draft.doom, parent.id) },
    {
      kind: "line",
      start: { x: box.x, y: box.y },
      end: { x: box.x + box.w, y: box.y + box.h },
      route: "straight",
      arrows: ["none", "none"],
    },
    intent,
  )
  return {
    kind: "line",
    ...ends,
    route: intent.route ?? "straight",
    arrows: [intent.startArrow ?? "none", askedArrow(intent.arrow, "none")],
    ...(intent.lane === undefined ? {} : { channels: laneOf(ends.start, ends.end, intent.lane) }),
  }
}

function addLine(draft: Draft, parent: Node, intent: Add): void {
  const spanned = intent.box === undefined ? spanOfEnds(draft, parent, intent) : undefined
  const area = spanned ?? areaFor(draft, parent, intent.box)
  const box = givenBox(intent, area, spanned?.h ?? 0)
  create(draft, "shape", parent.id, {
    ...surfaced(
      draft,
      { ...intent, stroke: intent.stroke ?? "text2", strokeWidth: intent.strokeWidth ?? draft.placement.lineWeight },
      {},
      "center",
    ),
    box,
    geometry: lineGeometry(draft, parent, box, intent),
  })
}

function addFrame(draft: Draft, parent: Node, intent: Add): void {
  if (intent.rows !== undefined) return addGrid(draft, parent, intent)
  if (intent.align === "justify") stop("shape", undefined, "align", "form", { code: "horizontal-align" })
  const area = areaFor(draft, parent, intent.box)
  const layout = layoutOf(intent, undefined, gapFor(slideSize(draft).w, draft.placement))
  create(draft, "frame", parent.id, {
    ...surfaced(draft, intent),
    box: givenBox(intent, area),
    ...(layout === undefined ? {} : { layout }),
  })
}

const centred = (area: Area, size: { readonly w: number; readonly h: number }) => ({
  x: area.x + Math.round((area.w - size.w) / 2),
  y: area.y + Math.round((area.h - size.h) / 2),
  ...size,
})

function addPicture(draft: Draft, parent: Node, intent: Add): void {
  if (typeof intent.fill !== "object" || !("image" in intent.fill))
    stop("shape", undefined, "fill", "form", { code: "picture-fill" })
  const area = areaFor(draft, parent, intent.box)
  const natural = draft.reading.pictures?.get(intent.fill.image)
  const fitted =
    intent.box !== undefined || natural === undefined ? area : { ...area, ...centred(area, pictureFit(natural, area)) }
  create(draft, "shape", parent.id, {
    ...surfaced(draft, intent),
    box: givenBox(intent, fitted),
    geometry: shapeGeometry(intent.shape ?? "rect"),
  })
}

function addIcon(draft: Draft, parent: Node, intent: Add): void {
  if (intent.icon === undefined) stop("shape", undefined, "icon", "missing", { code: "named-icon" })
  const area = areaFor(draft, parent, intent.box)
  const side = Math.min(draft.placement.iconSide, area.w, area.h)
  const box = givenBox(intent, { ...area, w: side }, side)
  const weight = Math.max(2, Math.round(Math.min(box.w, box.h) / draft.placement.iconStrokeDivisor))
  create(draft, "shape", parent.id, {
    ...surfaced(
      draft,
      { ...intent, stroke: intent.stroke ?? "accent1", strokeWidth: intent.strokeWidth ?? weight },
      {},
      "center",
    ),
    box,
    geometry: { kind: "icon", name: iconName(intent.icon) },
  })
}

export function compileInsertLayer(draft: Draft, intent: Add, placeholders: StartRules | undefined): void {
  const parent = living(draft, intent.parent, "parent")
  if (parent.type !== "slide" && parent.type !== "frame")
    stop("shape", parent.id, "parent", "form", { code: "slide-or-frame" })
  const slideId = parent.type === "slide" ? parent.id : slideOf(draft.doom, parent.id)
  const slide = slideId === undefined ? stop("missing", parent.id, "parent") : living(draft, slideId, "parent")
  fitKind("insert", intent.kind, intent)
  compileKind(draft, parent, slide, intent, placeholders)
}

function compileKind(draft: Draft, parent: Node, slide: Node, intent: Add, starts: StartRules | undefined): void {
  switch (intent.kind) {
    case "text":
    case "shape":
    case "path":
      return addWords(draft, parent, slide, intent, intent.kind, starts)
    case "line":
      return addLine(draft, parent, intent)
    case "frame":
      return addFrame(draft, parent, intent)
    case "picture":
      return addPicture(draft, parent, intent)
    case "icon":
      return addIcon(draft, parent, intent)
  }
}
