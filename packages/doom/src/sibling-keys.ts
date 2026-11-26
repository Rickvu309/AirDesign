import type { NodeId } from "./ids.js"
import { type OrderKey, orderKeyBetween } from "./order-key.js"

export type Keyed = { readonly id: NodeId; readonly at: OrderKey }

export type SiblingKeys = { readonly keys: readonly OrderKey[]; readonly shifted: readonly Keyed[] }

function keysBetween(low: OrderKey | null, high: OrderKey | null, count: number): OrderKey[] {
  const made: OrderKey[] = []
  for (let at = low; made.length < count; made.push(at)) at = orderKeyBetween(at, high)
  return made
}

function keysAt(siblings: readonly Keyed[], index: number, count: number): SiblingKeys {
  const low = siblings[index - 1]?.at ?? null
  let end = index
  while (low !== null && end < siblings.length && siblings[end]!.at <= low) end += 1
  const high = siblings[end]?.at ?? null
  const made = keysBetween(low, high, count + end - index)
  return {
    keys: made.slice(0, count),
    shifted: siblings.slice(index, end).map((each, offset) => ({ id: each.id, at: made[count + offset]! })),
  }
}

function keysInsideTie(siblings: readonly Keyed[], index: number, count: number): SiblingKeys | null {
  const previous = siblings[index - 1]
  const next = siblings[index]
  if (previous === undefined || next === undefined || previous.at !== next.at) return null
  const tie = previous.at
  let start = index - 1
  while (start > 0 && siblings[start - 1]!.at === tie) start -= 1
  let end = start
  while (end < siblings.length && siblings[end]!.at <= tie) end += 1
  const outerLow = siblings[start - 1]?.at ?? null
  const outerHigh = siblings[end]?.at ?? null
  if (outerLow !== null && outerHigh !== null && outerLow >= outerHigh) return null
  const memberKeys = keysBetween(outerLow, outerHigh, end - start)
  const gap = index - start
  return {
    keys: keysBetween(memberKeys[gap - 1] ?? null, memberKeys[gap] ?? null, count),
    shifted: siblings.slice(start, end).map((each, offset) => ({ id: each.id, at: memberKeys[offset]! })),
  }
}

export function siblingKeys(siblings: readonly Keyed[], index: number, count: number): SiblingKeys {
  return keysInsideTie(siblings, index, count) ?? keysAt(siblings, index, count)
}
