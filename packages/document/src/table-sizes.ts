export function readSizes(raw: unknown, count: number): readonly number[] | null {
  if (!Array.isArray(raw) || raw.length !== count) return null
  return raw.every((size) => typeof size === "number" && Number.isSafeInteger(size) && size > 0) ? raw : null
}

export function readSize(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 ? raw : null
}

export function placedSize(
  sizes: readonly number[] | undefined,
  at: number,
  from: number,
): readonly number[] | undefined {
  if (sizes === undefined) return undefined
  const size = sizes[from]
  return size === undefined ? sizes : [...sizes.slice(0, at), size, ...sizes.slice(at)]
}

export function droppedSizes(
  sizes: readonly number[] | undefined,
  first: number,
  last: number,
): readonly number[] | undefined {
  return sizes?.filter((_, index) => index < first || index > last)
}
