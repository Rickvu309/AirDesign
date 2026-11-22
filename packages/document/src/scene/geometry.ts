import { type NodeId, readNodeId } from "./ids.js"
import { type Px, px } from "./paint.js"
import { type Reader, finite, list, literal, matching, object, oneOf, pair, reject, variant } from "./read-kit.js"

export type End =
  | { readonly x: Px; readonly y: Px }
  | { readonly node: NodeId; readonly site: "t" | "r" | "b" | "l" | "c" }
export type Arrow = "none" | "arrow" | "triangle" | "circle"
export type Geometry =
  | { readonly kind: "rect" }
  | { readonly kind: "ellipse" }
  | { readonly kind: "preset"; readonly name: string; readonly adjust?: readonly number[] }
  | { readonly kind: "path"; readonly d: string }
  | { readonly kind: "icon"; readonly name: string }
  | {
      readonly kind: "line"
      readonly start: End
      readonly end: End
      readonly route: "straight" | "elbow" | "curve"
      readonly arrows: readonly [Arrow, Arrow]
    }

const readEnd: Reader<End> = oneOf<End>(
  object({ x: px(), y: px() }),
  object({
    node: (raw) => readNodeId(raw) ?? reject(),
    site: literal(["t", "r", "b", "l", "c"]),
  }),
)

const readArrow = literal<Arrow>(["none", "arrow", "triangle", "circle"])

export const readGeometry: Reader<Geometry> = variant("kind", {
  rect: object({}),
  ellipse: object({}),
  preset: object({ name: matching(/^[A-Za-z0-9]+$/, 40) }, { adjust: list(finite(-1_000_000, 1_000_000), 12) }),
  path: object({ d: matching(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\- ]+$/, 4_000) }),
  icon: object({ name: matching(/^[a-z0-9-]+\/[a-z0-9-]+$/, 80) }),
  line: object({
    start: readEnd,
    end: readEnd,
    route: literal(["straight", "elbow", "curve"]),
    arrows: pair(readArrow),
  }),
})
