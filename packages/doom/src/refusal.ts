import type { NodeId } from "./ids.js"
import type { WriteKey } from "./props.js"
import type { TextStyleName } from "./text.js"

export type Refusal = {
  readonly refused: "shape" | "limit" | "cycle" | "person" | "missing" | "stale" | "run-fenced" | "last-slide"
  readonly node?: NodeId
  readonly prop?: WriteKey
  readonly field?: string
  readonly fault?: "missing" | "unknown" | "form" | "needs"
  readonly form?: string
  readonly needs?: string
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
