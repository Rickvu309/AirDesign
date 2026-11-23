import type { NodeId } from "./ids.js"
import type { WriteKey } from "./props.js"

export type Refusal = {
  readonly refused: "shape" | "limit" | "cycle" | "person" | "missing" | "stale" | "run-fenced"
  readonly node?: NodeId
  readonly prop?: WriteKey
}

export function refuse(refused: Refusal["refused"], node?: NodeId, prop?: WriteKey): Refusal {
  return { refused, ...(node === undefined ? {} : { node }), ...(prop === undefined ? {} : { prop }) }
}

export function isRefusal(result: unknown): result is Refusal {
  return typeof result === "object" && result !== null && "refused" in result
}
