import type { NodeId } from "./ids.js"
import { type OrderKey, orderKeyBetween } from "./order-key.js"

export type Keyed = { readonly id: NodeId; readonly at: OrderKey }

export type SiblingKeys = { readonly keys: readonly OrderKey[]; readonly shifted: readonly Keyed[] }

export function siblingKeys(siblings: readonly Keyed[], index: number, count: number): SiblingKeys {
  const low = siblings[index - 1]?.at ?? null
  let end = index
  while (low !== null && end < siblings.length && siblings[end]!.at <= low) end += 1
  const high = siblings[end]?.at ?? null
  const made: OrderKey[] = []
  for (let at = low; made.length < count + end - index; made.push(at)) at = orderKeyBetween(at, high)
  return {
    keys: made.slice(0, count),
    shifted: siblings.slice(index, end).map((each, offset) => ({ id: each.id, at: made[count + offset]! })),
  }
}
