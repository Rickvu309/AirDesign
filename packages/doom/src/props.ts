import { readLanguage } from "./language.js"
import { limits } from "./limits.js"
import { type OrderKey, readOrderKey } from "./order-key.js"
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
  Reject,
  reject,
  words,
} from "./read-kit.js"
import { readLink } from "./link.js"
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
  readonly mask: boolean
  readonly link: string | NodeId
  readonly role: "title" | "subtitle" | "body" | "number" | "footer"
  readonly notes: Text
  readonly transition: { readonly kind: "none" | "fade" | "push" | "smartMove"; readonly ms: number }
  readonly skipped: boolean
  readonly theme: Theme
  readonly size: { readonly w: Px; readonly h: Px }
  readonly nameFollows: boolean
  readonly language: string
  readonly origin: Origin
}
export type PropName = keyof Props
export type WriteKey = PropName | ThemeKey

export type PropSpec<K extends PropName> = {
  readonly read: (raw: unknown) => Props[K] | Refusal
  readonly conflict: "last" | "base"
}

export const accepts = {
  deck: ["type", "name", "theme", "size", "nameFollows", "language"],
  slideRow: ["type", "parent", "name", "hidden"],
  slide: ["type", "parent", "name", "hidden", "fills", "layout", "notes", "transition", "skipped"],
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
    "mask",
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
    "mask",
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
      if (!(thrown instanceof Reject)) throw thrown
      return { refused: thrown.kind }
    }
  }

function spec<K extends PropName>(reader: Reader<Props[K]>, conflict: PropSpec<K>["conflict"] = "last"): PropSpec<K> {
  return { read: refusing(reader), conflict }
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
  type: spec(literal(nodeTypes)),
  parent: spec(readOptionalParent),
  name: spec((raw) => {
    const name = words(limits.name)(raw)
    return name.trim() === "" ? reject() : name
  }),
  hidden: spec(boolean),
  locked: spec(boolean),
  box: spec(readBox),
  sizing: spec(readSizing),
  cell: spec(readCell),
  absolute: spec(boolean),
  opacity: spec(finite(0, 1)),
  fills: spec(list(readPaint, 32), "base"),
  strokes: spec(list(readPaint, 32), "base"),
  stroke: spec(readStrokeStyle),
  radius: spec(oneOf<Px | readonly [Px, Px, Px, Px]>(corner, quad(corner))),
  effects: spec(oneOf<readonly Effect[] | EffectStyleName>(readEffectList, literal(effectStyleNames)), "base"),
  geometry: spec(readGeometry),
  text: spec(readText, "base"),
  layout: spec(readLayout),
  clip: spec(boolean),
  mask: spec(boolean),
  link: spec(readLink),
  role: spec(literal(["title", "subtitle", "body", "number", "footer"])),
  notes: spec(readText, "base"),
  transition: spec(object({ kind: literal(["none", "fade", "push", "smartMove"]), ms: integer(0, 60_000) })),
  skipped: spec(boolean),
  theme: spec(readTheme),
  size: spec(object({ w: finite(1, 100_000), h: finite(1, 100_000) })),
  nameFollows: spec(boolean),
  language: spec(readLanguage),
  origin: spec(readOrigin),
}
