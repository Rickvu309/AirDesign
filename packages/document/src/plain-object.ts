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
