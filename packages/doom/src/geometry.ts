import { type NodeId, readNodeId } from "./ids.js"
import { type Px, px } from "./paint.js"
import {
  type Reader,
  boolean,
  finite,
  list,
  literal,
  matching,
  object,
  oneOf,
  pair,
  reject,
  variant,
} from "./read-kit.js"

export type End =
  | { readonly x: Px; readonly y: Px }
  | { readonly node: NodeId; readonly site: "t" | "r" | "b" | "l" | "c" }
export const lineArrowheads = ["none", "arrow", "triangle", "circle"] as const
export type Arrow = (typeof lineArrowheads)[number]
export const pathLimit = 4_000
export const readPathData: Reader<string> = matching(
  /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\- ]+$/,
  pathLimit,
  `SVG path data, up to ${pathLimit} characters.`,
)

export type Channel = { readonly axis: "x" | "y"; readonly at: Px }
export const readChannel: Reader<Channel> = object({ axis: literal(["x", "y"]), at: px() })

export type Geometry =
  | { readonly kind: "rect" }
  | { readonly kind: "ellipse" }
  | { readonly kind: "preset"; readonly name: string; readonly adjust?: readonly number[] }
  | { readonly kind: "path"; readonly d: string; readonly fillStroke?: boolean }
  | { readonly kind: "icon"; readonly name: string }
  | {
      readonly kind: "line"
      readonly start: End
      readonly end: End
      readonly route: "straight" | "elbow" | "curve"
      readonly arrows: readonly [Arrow, Arrow]
      readonly channels?: readonly Channel[]
    }

const readEnd: Reader<End> = oneOf<End>(
  object({ x: px(), y: px() }),
  object({
    node: (raw) => readNodeId(raw) ?? reject(),
    site: literal(["t", "r", "b", "l", "c"]),
  }),
)

const readArrow = literal<Arrow>(lineArrowheads)

export const readGeometry: Reader<Geometry> = variant("kind", {
  rect: object({}),
  ellipse: object({}),
  preset: object({ name: matching(/^[A-Za-z0-9]+$/, 40) }, { adjust: list(finite(-1_000_000, 1_000_000), 12) }),
  path: object({ d: readPathData }, { fillStroke: boolean }),
  icon: object({ name: matching(/^[a-z0-9-]+\/[a-z0-9-]+$/, 80) }),
  line: object(
    {
      start: readEnd,
      end: readEnd,
      route: literal(["straight", "elbow", "curve"]),
      arrows: pair(readArrow),
    },
    { channels: list(readChannel, 8, 1) },
  ),
})
