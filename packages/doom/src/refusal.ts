import type { NodeId } from "./ids.js"
import type { WriteKey } from "./props.js"
import type { FieldFault } from "./read-kit.js"

export type Refusal = {
  readonly refused: "shape" | "limit" | "cycle" | "person" | "missing" | "stale" | "run-fenced" | "last-slide"
  readonly node?: NodeId
  readonly prop?: WriteKey
  readonly field?: string
  readonly fault?: FieldFault
  readonly form?: string
  readonly needs?: string
}

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
