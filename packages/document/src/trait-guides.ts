import { trait } from "./trait-decl.js"
import { choice, count, emu, flag, hex, list, readValue, record, size } from "./value-kind.js"

export const guideLimit = 200

export const layoutGuideLimit = 20

const guide = record({ axis: choice(["x", "y"]), offset: emu })

const layoutGuide = record({
  pattern: choice(["grid", "columns", "rows"]),
  count: count(1, 100),
  align: choice(["stretch", "start", "center", "end"]),
  size,
  offset: size,
  gutter: size,
  color: hex,
  opacity: count(0, 100),
  shown: flag,
})

export const guides = trait(
  "own",
  { version: 2, shape: "26d56cee" },
  { ruler: list(guide, 0, guideLimit), layout: list(layoutGuide, 0, layoutGuideLimit) },
)

export type Guide = { readonly axis: "x" | "y"; readonly offset: number }

export type LayoutGuide = {
  readonly pattern: "grid" | "columns" | "rows"
  readonly count: number
  readonly align: "stretch" | "start" | "center" | "end"
  readonly size: number
  readonly offset: number
  readonly gutter: number
  readonly color: string
  readonly opacity: number
  readonly shown: boolean
}

export function readGuideList(raw: unknown): readonly Guide[] | null {
  return readValue(guides.fields.ruler, raw)
}

export function readLayoutGuides(raw: unknown): readonly LayoutGuide[] | null {
  return readValue(guides.fields.layout, raw)
}
