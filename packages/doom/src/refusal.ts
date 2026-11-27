import type { NodeId } from "./ids.js"
import type { WriteKey } from "./props.js"
import type { TextStyleName } from "./text.js"

type ExpectCode =
  | "node-id"
  | "node-id-or-null"
  | "theme-color"
  | "font-name"
  | "icon-name"
  | "target-role"
  | "hex"
  | "stroke"
  | "fill"
  | "nonempty-string"
  | "string"
  | "safe-string"
  | "object"
  | "list"
  | "boolean"
  | "pair"
  | "quad"
  | "link"
  | "link-or-none"
  | "language-tag"
  | "padding"
  | "crop-sides"
  | "single-line"
  | "end-arrow"
  | "move-nodes"
  | "layer"
  | "unlocked-layer"
  | "slide-sibling"
  | "slide-place"
  | "slide"
  | "read-slide-id"
  | "read-slide-group"
  | "populated-slide-group"
  | "group-slide-or-null"
  | "other-slide-group"
  | "other-slide-or-null"
  | "slide-group-or-new"
  | "slide-or-group"
  | "after-slide"
  | "before-or-after-group"
  | "before-group-only"
  | "first-in-group"
  | "copyable-node"
  | "valid-piece"
  | "slide-or-frame"
  | "deck-look"
  | "grid-rows"
  | "nonempty-grid"
  | "needs-rows"
  | "destination-slide"
  | "after-sibling"
  | "same-parent"
  | "frame"
  | "target"
  | "slide-role"
  | "needs-text"
  | "crop-fit"
  | "insert-or-text"
  | "needs-layout"
  | "line-attachment"
  | "path-data"
  | "horizontal-align"
  | "picture-fill"
  | "named-icon"
  | "batch"

export type Expectation =
  | { readonly code: ExpectCode }
  | { readonly code: "number-range" | "integer-range"; readonly min: number; readonly max: number }
  | { readonly code: "list-min"; readonly min: number }
  | { readonly code: "one-of"; readonly options: readonly string[] }
  | { readonly code: "path-length"; readonly max: number }

export type Refusal = {
  readonly refused: "shape" | "limit" | "cycle" | "person" | "missing" | "stale" | "run-fenced" | "last-slide"
  readonly node?: NodeId
  readonly prop?: WriteKey
  readonly field?: string
  readonly fault?: "missing" | "unknown" | "form" | "needs"
  readonly expect?: Expectation
  readonly grid?: GridShortfall
}

export type GridCell = {
  readonly row: number
  readonly col: number
  readonly word: string
  readonly needs: number
  readonly room: number
}

export type GridShortfall =
  | { readonly cell: GridCell; readonly more: number; readonly style: TextStyleName }
  | { readonly rows: number; readonly needs: number; readonly room: number; readonly style: TextStyleName }

export function refuse(refused: Refusal["refused"], node?: NodeId, prop?: WriteKey): Refusal {
  return {
    refused,
    ...(node === undefined ? {} : { node }),
    ...(prop === undefined ? {} : { prop }),
  }
}

export function isRefusal(result: unknown): result is Refusal {
  return typeof result === "object" && result !== null && "refused" in result
}
