import fc from "fast-check"
import { it } from "vitest"
import { orderKeyBetween, type OrderKey } from "./order-key.js"

function beforeKey(keys: OrderKey[], index: number): OrderKey | null {
  if (index === 0) {
    return null
  }
  return keys[index - 1] ?? null
}

function afterKey(keys: OrderKey[], index: number): OrderKey | null {
  if (index === keys.length) {
    return null
  }
  return keys[index] ?? null
}

it("sorts strictly between its bounds, including repeated insertion at one spot", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 0, max: 64 }), { minLength: 1, maxLength: 24 }),
      fc.integer({ min: 0, max: 64 }),
      fc.integer({ min: 2, max: 16 }),
      (slots, rawSpot, repeats) => {
        const keys: OrderKey[] = []
        for (const slot of slots) {
          const index = keys.length === 0 ? 0 : slot % (keys.length + 1)
          const before = beforeKey(keys, index)
          const after = afterKey(keys, index)
          const key = orderKeyBetween(before, after)
          if (before !== null && !(before < key)) {
            return false
          }
          if (after !== null && !(key < after)) {
            return false
          }
          keys.splice(index, 0, key)
        }
        const spot = rawSpot % (keys.length + 1)
        const lower = beforeKey(keys, spot)
        const upper = afterKey(keys, spot)
        let cursor = lower
        for (let count = 0; count < repeats; count += 1) {
          const key = orderKeyBetween(cursor, upper)
          if (lower !== null && !(lower < key)) {
            return false
          }
          if (upper !== null && !(key < upper)) {
            return false
          }
          if (cursor !== null && !(cursor < key)) {
            return false
          }
          cursor = key
        }
        for (let index = 1; index < keys.length; index += 1) {
          const previous = keys[index - 1]
          const current = keys[index]
          if (previous === undefined || current === undefined || !(previous < current)) {
            return false
          }
        }
        return new Set(keys).size === keys.length
      },
    ),
  )
})

it("appends from 0 through 200 in strict order", () => {
  let previous: OrderKey | null = null
  for (let count = 0; count <= 200; count += 1) {
    const key = orderKeyBetween(previous, null)
    if (previous !== null && !(previous < key)) {
      throw new Error(`append ${count} is not greater`)
    }
    previous = key
  }
})
