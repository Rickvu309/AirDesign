import type { Px, Sides } from "./paint.js"
import { readSides, size } from "./paint.js"
import { type Reader, boolean, finite, integer, list, literal, object, oneOf, variant } from "./read-kit.js"

export type Track = { readonly fr: number } | { readonly px: Px } | "hug"
export type Align9 = `${"top" | "center" | "bottom"}-${"left" | "center" | "right"}`
export type Layout =
  | { readonly mode: "none" }
  | {
      readonly mode: "row" | "column"
      readonly gap: Px
      readonly padding: Sides
      readonly align: Align9
      readonly wrap?: boolean
    }
  | {
      readonly mode: "grid"
      readonly columns: readonly Track[]
      readonly rows: readonly Track[]
      readonly gap: Px
      readonly padding: Sides
    }
export type Sizing = { readonly w: "fixed" | "hug" | "fill"; readonly h: "fixed" | "hug" | "fill" }
export type Cell = { readonly row: number; readonly col: number; readonly rowSpan?: number; readonly colSpan?: number }

const readTrack: Reader<Track> = oneOf<Track>(
  object({ fr: finite(0.01, 1_000) }),
  object({ px: size }),
  literal(["hug"]),
)

const readAlign: Reader<Align9> = literal<Align9>([
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center-center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
])

const flow = object({ gap: size, padding: readSides, align: readAlign }, { wrap: boolean })

export const readLayout: Reader<Layout> = variant("mode", {
  none: object({}),
  row: flow,
  column: flow,
  grid: object({ columns: list(readTrack, 24, 1), rows: list(readTrack, 64, 1), gap: size, padding: readSides }),
})

const sizeMode = literal(["fixed", "hug", "fill"] as const)

export const readSizing: Reader<Sizing> = object({ w: sizeMode, h: sizeMode })

export const readCell: Reader<Cell> = object(
  { row: integer(0, 999), col: integer(0, 999) },
  { rowSpan: integer(1, 1_000), colSpan: integer(1, 1_000) },
)
