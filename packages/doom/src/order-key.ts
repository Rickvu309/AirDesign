declare const orderKeyBrand: unique symbol

export type OrderKey = string & { readonly [orderKeyBrand]: true }

const digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const heads = digits.slice(10)
const zero = digits[0] ?? "0"
const lastDigit = digits[digits.length - 1] ?? "z"
const half = heads.length / 2
const smallestInteger = (heads[0] ?? "A") + zero.repeat(half)

function mustDigit(alphabet: string, index: number): string {
  const digit = alphabet[index]
  if (digit === undefined) {
    throw new Error("order key digit out of range")
  }
  return digit
}

function headIndex(head: string): number {
  const index = heads.indexOf(head)
  if (index < 0) {
    throw new Error(`invalid order key head: ${head}`)
  }
  return index
}

function digitIndex(digit: string): number {
  const index = digits.indexOf(digit)
  if (index < 0) {
    throw new Error(`invalid order key digit: ${digit}`)
  }
  return index
}

function integerLength(head: string): number {
  const index = headIndex(head)
  return index < half ? half - index + 1 : index - half + 2
}

function integerPart(key: string): string {
  const head = key[0]
  if (head === undefined) {
    throw new Error(`invalid order key: ${key}`)
  }
  const length = integerLength(head)
  if (length > key.length) {
    throw new Error(`invalid order key: ${key}`)
  }
  return key.slice(0, length)
}

function validateOrderKey(key: string): void {
  if (key === smallestInteger) {
    throw new Error(`invalid order key: ${key}`)
  }
  const integer = integerPart(key)
  const fraction = key.slice(integer.length)
  if (fraction.endsWith(zero)) {
    throw new Error(`invalid order key: ${key}`)
  }
}

function midpoint(left: string, right: string | null): string {
  if (right && left >= right) {
    throw new Error(`${left} >= ${right}`)
  }
  if (left.endsWith(zero) || (right && right.endsWith(zero))) {
    throw new Error("trailing zero")
  }
  if (right) {
    let shared = 0
    while ((left[shared] ?? zero) === right[shared]) {
      shared += 1
    }
    if (shared > 0) {
      return right.slice(0, shared) + midpoint(left.slice(shared), right.slice(shared))
    }
  }
  const leftDigit = left === "" ? 0 : digitIndex(left[0] ?? "")
  const rightDigit = right ? digitIndex(right[0] ?? "") : digits.length
  if (rightDigit - leftDigit > 1) {
    return mustDigit(digits, Math.round(0.5 * (leftDigit + rightDigit)))
  }
  if (right && right.length > 1) {
    return right.slice(0, 1)
  }
  return mustDigit(digits, leftDigit) + midpoint(left.slice(1), null)
}

function changeInteger(value: string, direction: 1 | -1): string | null {
  const head = value[0]
  if (head === undefined) {
    throw new Error(`invalid order key: ${value}`)
  }
  const pad = direction > 0 ? zero : lastDigit
  let trailing = ""
  for (let index = value.length - 1; index >= 1; index -= 1) {
    const next = digitIndex(value[index] ?? "") + direction
    if (next === digits.length || next === -1) {
      trailing = pad + trailing
      continue
    }
    return head + value.slice(1, index) + mustDigit(digits, next) + trailing
  }
  const nextHeadIndex = headIndex(head) + direction
  if (nextHeadIndex < 0 || nextHeadIndex >= heads.length) {
    return null
  }
  const nextHead = mustDigit(heads, nextHeadIndex)
  const lengthDelta = integerLength(nextHead) - integerLength(head)
  const digitsPart = lengthDelta > 0 ? trailing + pad : lengthDelta < 0 ? trailing.slice(1) : trailing
  return nextHead + digitsPart
}

function generate(before: string | null, after: string | null): string {
  if (before !== null) {
    validateOrderKey(before)
  }
  if (after !== null) {
    validateOrderKey(after)
  }
  if (before !== null && after !== null && before >= after) {
    throw new Error(`${before} >= ${after}`)
  }
  if (before === null && after === null) {
    return mustDigit(heads, half) + zero
  }
  if (before === null && after !== null) {
    const integer = integerPart(after)
    const fraction = after.slice(integer.length)
    if (integer === smallestInteger) {
      return integer + midpoint("", fraction)
    }
    if (integer < after) {
      return integer
    }
    const decremented = changeInteger(integer, -1)
    if (decremented === null) {
      throw new Error("cannot decrement any more")
    }
    return decremented
  }
  if (before !== null && after === null) {
    const integer = integerPart(before)
    const fraction = before.slice(integer.length)
    const incremented = changeInteger(integer, 1)
    return incremented === null ? integer + midpoint(fraction, null) : incremented
  }
  if (before === null || after === null) {
    throw new Error("missing order key bound")
  }
  const lowerInteger = integerPart(before)
  const lowerFraction = before.slice(lowerInteger.length)
  const upperInteger = integerPart(after)
  if (lowerInteger === upperInteger) {
    return lowerInteger + midpoint(lowerFraction, after.slice(upperInteger.length))
  }
  const incremented = changeInteger(lowerInteger, 1)
  if (incremented === null) {
    throw new Error("cannot increment any more")
  }
  if (incremented < after) {
    return incremented
  }
  return lowerInteger + midpoint(lowerFraction, null)
}

export function orderKeyBetween(before: OrderKey | null, after: OrderKey | null): OrderKey {
  return generate(before, after) as OrderKey
}

export function keysForOrder(slots: readonly (OrderKey | null)[]): readonly (OrderKey | undefined)[] {
  const keys: (OrderKey | undefined)[] = slots.map(() => undefined)
  let low: OrderKey | null = null
  let at = 0
  while (at < slots.length) {
    const kept = slots[at] ?? null
    if (kept !== null && (low === null || kept >= low)) {
      low = kept
      at += 1
      continue
    }
    let end = at
    const floor: OrderKey | null = low
    while (end < slots.length && (slots[end] == null || (floor !== null && slots[end]! <= floor))) end += 1
    const high = slots[end] ?? null
    for (; at < end; at += 1) keys[at] = low = orderKeyBetween(low, high)
  }
  return keys
}

export function readOrderKey(raw: unknown): OrderKey | undefined {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 64) return undefined
  for (const char of raw) {
    if (!digits.includes(char)) return undefined
  }
  try {
    validateOrderKey(raw)
  } catch {
    return undefined
  }
  return raw as OrderKey
}
