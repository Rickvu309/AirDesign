import { limits } from "./limits.js"
import { type OrderKey, readOrderKey } from "./order-key.js"
import { type Chart, readChart } from "./chart.js"
import { type Geometry, readGeometry } from "./geometry.js"
import { type NodeId, type Rev, readNodeId, readRev } from "./ids.js"
import { type Cell, type Layout, type Sizing, readCell, readLayout, readSizing } from "./layout.js"
import {
  type Effect,
  type EffectStyleName,
  type Paint,
  type Px,
  type StrokeStyle,
  effectStyleNames,
  px,
  readEffectList,
  readPaint,
  readStrokeStyle,
  size,
} from "./paint.js"
import {
  type Reader,
  boolean,
  finite,
  integer,
  list,
  literal,
  object,
  oneOf,
  quad,
  reject,
  rejected,
  words,
} from "./read-kit.js"
import type { Refusal } from "./refusal.js"
import { type Text, readText } from "./text.js"
import { type Theme, type ThemeKey, readTheme } from "./theme.js"

export const nodeTypes = ["deck", "slideRow", "slide", "frame", "shape"] as const
export type NodeType = (typeof nodeTypes)[number]

export type Origin = {
  readonly part: string
  readonly index: number
  readonly rev: Rev
  readonly refs: readonly NodeId[]
}

export type Props = {
  readonly type: NodeType
  readonly parent: { readonly id: NodeId; readonly at: OrderKey } | null
  readonly name: string
  readonly hidden: boolean
  readonly locked: boolean
  readonly box: {
    readonly x: Px
    readonly y: Px
    readonly w: Px
    readonly h: Px
    readonly rotation: number
    readonly flipH: boolean
    readonly flipV: boolean
  }
  readonly sizing: Sizing
  readonly cell: Cell
  readonly absolute: boolean
  readonly opacity: number
  readonly fills: readonly Paint[]
  readonly strokes: readonly Paint[]
  readonly stroke: StrokeStyle
  readonly radius: Px | readonly [Px, Px, Px, Px]
  readonly effects: readonly Effect[] | EffectStyleName
  readonly geometry: Geometry
  readonly text: Text
  readonly layout: Layout
  readonly clip: boolean
  readonly chart: Chart
  readonly link: string | NodeId
  readonly role: "title" | "subtitle" | "body" | "number" | "footer"
  readonly slideLayout: NodeId
  readonly notes: Text
  readonly transition: { readonly kind: "none" | "fade" | "push" | "smartMove"; readonly ms: number }
  readonly skipped: boolean
  readonly theme: Theme
  readonly size: { readonly w: Px; readonly h: Px }
  readonly origin: Origin
}
export type PropName = keyof Props
export type WriteKey = PropName | ThemeKey

export type PropSpec<K extends PropName> = {
  readonly read: (raw: unknown) => Props[K] | Refusal
  readonly control: "none" | "number" | "color" | "paints" | "text" | "choice" | "toggle" | "box" | "custom"
  readonly describe: string | null
  readonly pptx: "native" | "picture" | "dropped"
  readonly conflict: "last" | "base"
}

export const accepts = {
  deck: ["type", "name", "theme", "size"],
  slideRow: ["type", "parent", "name", "hidden"],
  slide: ["type", "parent", "name", "hidden", "fills", "layout", "slideLayout", "notes", "transition", "skipped"],
  frame: [
    "type",
    "parent",
    "name",
    "hidden",
    "locked",
    "box",
    "sizing",
    "cell",
    "absolute",
    "opacity",
    "fills",
    "strokes",
    "stroke",
    "radius",
    "effects",
    "layout",
    "clip",
    "chart",
    "link",
    "origin",
  ],
  shape: [
    "type",
    "parent",
    "name",
    "hidden",
    "locked",
    "box",
    "sizing",
    "cell",
    "absolute",
    "opacity",
    "fills",
    "strokes",
    "stroke",
    "radius",
    "effects",
    "geometry",
    "text",
    "link",
    "role",
    "origin",
  ],
} as const satisfies Readonly<Record<NodeType, readonly PropName[]>>

export const holds = {
  deck: ["slideRow"],
  slideRow: ["slide"],
  slide: ["frame", "shape"],
  frame: ["frame", "shape"],
  shape: [],
} as const satisfies Readonly<Record<NodeType, readonly NodeType[]>>

const refusing =
  <T>(reader: Reader<T>) =>
  (raw: unknown): T | Refusal => {
    try {
      return reader(raw)
    } catch (thrown) {
      return { refused: rejected(thrown) }
    }
  }

function spec<K extends PropName>(
  reader: Reader<Props[K]>,
  control: PropSpec<K>["control"],
  describe: string | null,
  pptx: PropSpec<K>["pptx"],
  conflict: PropSpec<K>["conflict"] = "last",
): PropSpec<K> {
  return { read: refusing(reader), control, describe, pptx, conflict }
}

const readOrder: Reader<OrderKey> = (raw) => readOrderKey(raw) ?? reject()
const readId: Reader<NodeId> = (raw) => readNodeId(raw) ?? reject()
const readOptionalParent: Reader<Props["parent"]> = oneOf<Props["parent"]>(
  (raw) => (raw === null ? null : reject()),
  object({ id: readId, at: readOrder }),
)
const corner = px(0, 100_000)
const readBox = object({
  x: px(),
  y: px(),
  w: size,
  h: size,
  rotation: finite(-3600, 3600),
  flipH: boolean,
  flipV: boolean,
})
const readOrigin = object({
  part: words(500, 1),
  index: integer(0, 1_000_000),
  rev: (raw) => readRev(raw) ?? reject(),
  refs: list(readId, 400),
})

export const props: { readonly [K in PropName]: PropSpec<K> } = {
  type: spec(literal(nodeTypes), "none", null, "native"),
  parent: spec(readOptionalParent, "none", null, "native"),
  name: spec(words(limits.name), "text", "The layer's name in the layers panel.", "native"),
  hidden: spec(boolean, "toggle", "Whether the layer is hidden.", "native"),
  locked: spec(boolean, "toggle", null, "dropped"),
  box: spec(readBox, "box", "Position, size, rotation and flips on the slide, in pixels.", "native"),
  sizing: spec(readSizing, "choice", null, "dropped"),
  cell: spec(readCell, "custom", null, "dropped"),
  absolute: spec(boolean, "toggle", null, "dropped"),
  opacity: spec(finite(0, 1), "number", "How see-through the layer is, from 0 to 1.", "native"),
  fills: spec(list(readPaint, 32), "paints", "What paints inside the layer, bottom first.", "native", "base"),
  strokes: spec(list(readPaint, 32), "paints", "What paints along the layer's outline.", "native", "base"),
  stroke: spec(readStrokeStyle, "custom", "Outline weight, alignment and dash.", "native"),
  radius: spec(
    oneOf<Px | readonly [Px, Px, Px, Px]>(corner, quad(corner)),
    "number",
    "Corner radius: one number, or four.",
    "native",
  ),
  effects: spec(
    oneOf<readonly Effect[] | EffectStyleName>(readEffectList, literal(effectStyleNames)),
    "choice",
    "An effect style name, or a list of shadows and blurs.",
    "native",
    "base",
  ),
  geometry: spec(readGeometry, "custom", null, "native"),
  text: spec(readText, "text", "The words in the layer, with their styling.", "native", "base"),
  layout: spec(readLayout, "custom", "How a frame lays out what is inside it.", "dropped"),
  clip: spec(boolean, "toggle", null, "dropped"),
  chart: spec(readChart, "custom", "The data a chart frame draws.", "picture"),
  link: spec(words(limits.address, 1), "text", null, "native"),
  role: spec(literal(["title", "subtitle", "body", "number", "footer"]), "choice", null, "native"),
  slideLayout: spec(readId, "none", null, "dropped"),
  notes: spec(readText, "text", "A slide's presenter notes.", "native", "base"),
  transition: spec(
    object({ kind: literal(["none", "fade", "push", "smartMove"]), ms: integer(0, 60_000) }),
    "choice",
    null,
    "native",
  ),
  skipped: spec(boolean, "toggle", null, "native"),
  theme: spec(readTheme, "custom", null, "native"),
  size: spec(object({ w: finite(1, 100_000), h: finite(1, 100_000) }), "none", null, "native"),
  origin: spec(readOrigin, "none", null, "dropped"),
}
