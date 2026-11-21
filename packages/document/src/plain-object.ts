export function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

export function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(value)
  if (own.length !== keys.length) {
    return false
  }
  for (const key of keys) {
    if (!own.includes(key)) {
      return false
    }
  }
  return true
}

export function same(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, n) => same(item, right[n]))
  }
  const a = record(left)
  const b = record(right)
  if (a === null || b === null) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]))
}
