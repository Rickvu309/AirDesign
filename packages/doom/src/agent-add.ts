import type { AgentAdd, AgentChange, AgentLook } from "./agent-change.js"
import { shapeGeometry } from "./preset-geometry.js"
import { type Draft, Stop, create, living, nextKey, put, stop } from "./agent-draft.js"
import { askedArrow, iconName, layoutOf, solid, surfaceOf, textOfLook, turnOf, type Now } from "./agent-look.js"
import { addGrid } from "./agent-grid.js"
import { placeholderTitle } from "./placeholder-title.js"
import { placeholderSubtitle } from "./slide-placeholders.js"
import {
  type Area,
  alignedWithTitle,
  areaFor,
  cardRadiusFor,
  fitScale,
  freeArea,
  gapFor,
  slideSize,
  themeOf,
} from "./agent-place.js"
import { lineEnds } from "./agent-line-ends.js"
import { pictureFit } from "./picture-fit.js"
import type { StrokeStyle } from "./paint.js"
import type { Box } from "./doom-walk.js"
import { descendantsOf, isLaidOut, propOf, slideOf, zeroBox } from "./doom-walk.js"
import type { Node } from "./doom.js"
import type { Text } from "./text.js"
import { componentLibrary } from "./component/library.js"
import { linkedOwner } from "./component/instance-ownership.js"
import { placeComponent } from "./component/join-instance.js"
import { deckComponent } from "./component/deck-component.js"
import { readNodeId } from "./ids.js"
import { isRefusal } from "./refusal.js"
import { measureWith } from "./measure.js"
import { textHeight } from "./text-estimate.js"

type Add = Extract<AgentChange, { op: "add" }>

const common = [
  "box",
  "name",
  "hidden",
  "opacity",
  "effect",
  "effectOpacity",
  "blur",
  "innerShadow",
  "rotation",
  "flip",
  "mask",
] as const
const painted = ["fill", "stroke", "strokeWidth", "radius", "dash"] as const
const words = [
  "text",
  "textStyle",
  "language",
  "align",
  "color",
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
  "padding",
] as const

const takes: Readonly<Record<AgentAdd, readonly (keyof AgentLook)[]>> = {
  text: [...common, ...painted, ...words, "link"],
  shape: [...common, ...painted, ...words, "shape", "link"],
  path: [...common, ...painted, ...words, "d", "fillStroke", "link"],
  line: [...common, "stroke", "strokeWidth", "arrow", "startArrow", "dash", "from", "to", "route"],
  frame: [...common, ...painted, "layout", "gap", "padding", "align", "rows", "clip"],
  picture: [...common, "fill", "stroke", "strokeWidth", "radius", "dash", "fit", "crop"],
  icon: [...common, "icon", "stroke", "strokeWidth"],
  component: ["component", "box", "data", "variant", "tokens", "rotation", "flip"],
}

const titleStyles: ReadonlySet<Text["style"]> = new Set(["display", "title"])
const iconSide = 96
const lineWeight = 3
const iconWeightShare = 12

function surfaced(draft: Draft, look: AgentLook, now: Now = {}, align: StrokeStyle["align"] = "inside") {
  const themed = look.effectOpacity !== undefined || look.blur !== undefined || look.innerShadow !== undefined
  return surfaceOf(look, now, align, themed ? themeOf(draft) : undefined)
}

const givenBox = (look: AgentLook, area: Area, h: number = area.h, grows = false): Box => ({
  ...zeroBox,
  ...(look.box === undefined ? { x: area.x, y: area.y, w: area.w, h } : { ...look.box, ...(grows ? { h } : {}) }),
  ...turnOf(look),
})

function checkFields(change: Add): void {
  const allowed = new Set<string>(["op", "kind", "slide", "into", ...takes[change.kind]])
  for (const [key, value] of Object.entries(change))
    if (value !== undefined && !allowed.has(key))
      stop("shape", undefined, key, "unknown", `One of ${[...allowed].join(", ")}.`)
}

function emptyPlaceholderOf(draft: Draft, slide: Node, role: "title" | "subtitle", prompt: string): Node | undefined {
  return descendantsOf(draft.doom, slide.id).find((node) => {
    const chars = propOf(node, "text")?.chars
    return propOf(node, "role") === role && (chars === "" || chars === prompt)
  })
}

function emptyPlaceholderFor(draft: Draft, slide: Node, style: Text["style"], boxed: boolean): Node | undefined {
  if (titleStyles.has(style)) return emptyPlaceholderOf(draft, slide, "title", placeholderTitle)
  return boxed ? undefined : emptyPlaceholderOf(draft, slide, "subtitle", placeholderSubtitle)
}

const inkOn = (fill: AgentLook["fill"]) =>
  fill === undefined || (typeof fill === "string" && fill.startsWith("accent")) ? "background" : undefined

function addWords(draft: Draft, parent: Node, slide: Node, change: Add, kind: "text" | "shape" | "path"): void {
  if (kind === "text" && change.text === undefined) stop("shape", undefined, "text", "missing", "A non-empty string.")
  const labelled = kind !== "text"
  const geometry =
    kind === "path"
      ? {
          kind: "path" as const,
          d: change.d ?? stop("shape", undefined, "d", "missing", "SVG path data."),
          ...(change.fillStroke === undefined ? {} : { fillStroke: change.fillStroke }),
        }
      : shapeGeometry(change.shape ?? "rect")
  const ink = change.color ?? inkOn(change.fill)
  const look: AgentLook =
    labelled && change.text !== undefined
      ? { ...change, align: change.align ?? "center", ...(ink === undefined ? {} : { color: ink }) }
      : change
  const made = textOfLook(look, undefined, "body", themeOf(draft))
  if (change.link !== undefined && change.link !== "none" && made === undefined)
    stop("shape", undefined, "link", "needs", "a text layer")
  if (kind === "text" && made !== undefined && change.box === undefined && isLaidOut(parent)) {
    create(draft, "shape", parent.id, {
      ...surfaced(draft, change),
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
    const held = propOf(empty, "text") as Text
    const { textStyle: _, ...unstyled } = change
    const next = textOfLook(unstyled, held, held.style, themeOf(draft)) as Text
    put(draft, empty.id, {
      ...surfaced(draft, change, {
        fills: propOf(empty, "fills"),
        stroke: propOf(empty, "stroke"),
        box: propOf(empty, "box"),
      }),
      text: { ...held, chars: next.chars, spans: next.spans, paras: next.paras, alignV: next.alignV },
    })
    return
  }
  const area =
    kind === "text" && change.box === undefined ? areaFor(draft, parent, undefined) : areaFor(draft, parent, change.box)
  const grows = !labelled && made !== undefined
  const wordsHigh = (w: number) => Math.max(1, Math.round(textHeight(made!, themeOf(draft), w)))
  const high = !grows
    ? area.h
    : change.box === undefined
      ? Math.min(area.h, wordsHigh(area.w))
      : wordsHigh(change.box.w)
  const filled = labelled && change.fill === undefined && change.stroke === undefined
  const titled =
    kind === "text" &&
    made !== undefined &&
    titleStyles.has(made.style) &&
    !descendantsOf(draft.doom, slide.id).some((node) => propOf(node, "role") === "title")
  create(draft, "shape", parent.id, {
    ...surfaced(draft, change, {}, kind === "path" ? "center" : "inside"),
    ...(kind === "shape" && change.radius === undefined ? { radius: cardRadiusFor(slideSize(draft).w) } : {}),
    ...(filled ? { fills: [solid("accent1")] } : {}),
    box: givenBox(change, area, high, grows),
    geometry,
    ...(titled ? { role: "title" as const } : {}),
    ...(made === undefined
      ? {}
      : {
          text: {
            ...made,
            resize: labelled ? "fixed" : "height",
            ...(labelled ? { alignV: change.alignV ?? "center" } : {}),
          },
        }),
  })
}

function addLine(draft: Draft, parent: Node, change: Add): void {
  const area = areaFor(draft, parent, change.box)
  const box = givenBox(change, area, 0)
  create(draft, "shape", parent.id, {
    ...surfaced(
      draft,
      { ...change, stroke: change.stroke ?? "text2", strokeWidth: change.strokeWidth ?? lineWeight },
      {},
      "center",
    ),
    box,
    geometry: {
      kind: "line",
      ...lineEnds(
        draft,
        { self: null, slide: slideOf(draft.doom, parent.id) },
        {
          kind: "line",
          start: { x: box.x, y: box.y },
          end: { x: box.x + box.w, y: box.y + box.h },
          route: "straight",
          arrows: ["none", "none"],
        },
        change,
      ),
      route: change.route ?? "straight",
      arrows: [change.startArrow ?? "none", askedArrow(change.arrow, "none")],
    },
  })
}

function addFrame(draft: Draft, parent: Node, change: Add): void {
  if (change.rows !== undefined) return addGrid(draft, parent, change)
  if (change.align === "justify") stop("shape", undefined, "align", "form", "left, center or right.")
  const area = areaFor(draft, parent, change.box)
  const layout = layoutOf(change, undefined, gapFor(slideSize(draft).w))
  create(draft, "frame", parent.id, {
    ...surfaced(draft, change),
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
  if (typeof change.fill !== "object" || !("image" in change.fill))
    stop("shape", undefined, "fill", "form", "An object with image: an https address, or an asset read from the deck.")
  const area = areaFor(draft, parent, change.box)
  const natural = draft.reading.pictures?.get(change.fill.image)
  const fitted =
    change.box !== undefined || natural === undefined ? area : { ...area, ...centred(area, pictureFit(natural, area)) }
  create(draft, "shape", parent.id, {
    ...surfaced(draft, change),
    box: givenBox(change, fitted),
    geometry: { kind: "rect" },
  })
}

function addIcon(draft: Draft, parent: Node, change: Add): void {
  if (change.icon === undefined)
    stop("shape", undefined, "icon", "missing", "An icon name such as star, arrow-right or trending-up.")
  const area = areaFor(draft, parent, change.box)
  const side = Math.min(iconSide, area.w, area.h)
  const box = givenBox(change, { ...area, w: side }, side)
  const weight = Math.max(2, Math.round(Math.min(box.w, box.h) / iconWeightShare))
  create(draft, "shape", parent.id, {
    ...surfaced(
      draft,
      { ...change, stroke: change.stroke ?? "accent1", strokeWidth: change.strokeWidth ?? weight },
      {},
      "center",
    ),
    box,
    geometry: { kind: "icon", name: iconName(change.icon) },
  })
}

const estimate = measureWith({})

const maxComponentScale = 2

function addComponent(draft: Draft, parent: Node, change: Add): void {
  const id = change.component ?? stop("shape", undefined, "component", "missing", "A template id.")
  const node = readNodeId(id)
  const definition = componentLibrary.get(id) ?? (node === undefined ? undefined : deckComponent(draft.doom, node))
  if (definition === undefined) stop("shape", undefined, "component", "form", "A template id.")
  const { sample } = definition.spec
  const data = change.data ?? sample?.data ?? stop("shape", undefined, "data", "missing", "Rows by collection.")
  const natural = sample === undefined ? undefined : { width: sample.w, height: sample.h }
  let box = change.box ?? freeArea(draft, parent, natural) ?? stop("limit", parent.id, "box")
  if (change.box === undefined && natural !== undefined) {
    const aligned = parent.type === "slide" ? alignedWithTitle(draft, parent, box) : box
    const scale = Math.min(maxComponentScale, fitScale(natural, aligned))
    const fitted = centred(aligned, { w: Math.round(natural.width * scale), h: Math.round(natural.height * scale) })
    box =
      aligned === box
        ? fitted
        : { ...fitted, x: aligned.x, w: definition.spec.chart === undefined ? fitted.w : aligned.w }
  }
  const source = "id" in definition ? definition : { node: definition.node, revision: definition.revision }
  const placed = placeComponent(draft.doom, source, {
    frame: draft.mint(),
    parent: { id: parent.id, at: nextKey(draft, parent.id) },
    box: givenBox(change, box),
    data,
    ...(change.variant === undefined ? {} : { variant: change.variant }),
    ...(change.tokens === undefined ? {} : { tokens: change.tokens }),
    measure: draft.reading.measure ?? estimate,
  })
  if (isRefusal(placed)) throw new Stop(placed)
  draft.writes.push(...placed)
}

export function compileAdd(draft: Draft, change: Add): void {
  const slide = living(draft, change.slide, "slide")
  if (slide.type !== "slide") stop("shape", slide.id, "slide", "form", "A slide id.")
  const parent = change.into === undefined ? slide : living(draft, change.into, "into")
  if (change.into !== undefined && (parent.type !== "frame" || slideOf(draft.doom, parent.id) !== slide.id))
    stop("missing", parent.id, "into")
  if (linkedOwner(draft.doom.nodes, parent.id) !== undefined)
    stop("shape", parent.id, "into", "form", "This layer is linked. Use detach to make it a plain layer.")
  checkFields(change)
  compileKind(draft, parent, slide, change)
}

function compileKind(draft: Draft, parent: Node, slide: Node, change: Add): void {
  switch (change.kind) {
    case "text":
    case "shape":
    case "path":
      return addWords(draft, parent, slide, change, change.kind)
    case "line":
      return addLine(draft, parent, change)
    case "frame":
      return addFrame(draft, parent, change)
    case "picture":
      return addPicture(draft, parent, change)
    case "icon":
      return addIcon(draft, parent, change)
    case "component":
      return addComponent(draft, parent, change)
  }
}
