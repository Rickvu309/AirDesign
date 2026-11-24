import type { NodeId } from "./ids.js"
import type { WriteKey } from "./props.js"
import { type FieldFault, takeRejection } from "./read-kit.js"

export type { FieldFault }

export type Refusal = {
  readonly refused: "shape" | "limit" | "cycle" | "person" | "missing" | "stale" | "run-fenced" | "last-slide"
  readonly node?: NodeId
  readonly prop?: WriteKey
  readonly field?: string
  readonly fault?: FieldFault
  readonly form?: string
}

export function refuse(refused: Refusal["refused"], node?: NodeId, prop?: WriteKey): Refusal {
  const found = refused === "shape" || refused === "limit" ? takeRejection(refused) : undefined
  if (refused !== "shape" && refused !== "limit") takeRejection("shape")
  const carried = node === undefined && prop === undefined ? found : undefined
  return {
    refused,
    ...(node === undefined ? {} : { node }),
    ...(prop === undefined ? {} : { prop }),
    ...(carried?.field === undefined ? {} : { field: carried.field }),
    ...(carried?.fault === undefined ? {} : { fault: carried.fault }),
    ...(carried?.form === undefined ? {} : { form: carried.form }),
  }
}

export function isRefusal(result: unknown): result is Refusal {
  return typeof result === "object" && result !== null && "refused" in result
}
