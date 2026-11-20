import { traitNames, traits } from "./traits.js"

export const stamps: { readonly row: number; readonly index: number; readonly command: number } = {
  row: 2,
  index: 20,
  command: 18,
}

const traitVersions = traitNames.reduce((sum, name) => sum + traits[name].stamp.version, 0)

export const format: number = 1 + stamps.row + stamps.index + stamps.command + traitVersions

export function formatOf(raw: unknown): number {
  if (typeof raw !== "object" || raw === null || !("format" in raw)) return 1
  const stored = raw.format
  return typeof stored === "number" && Number.isSafeInteger(stored) && stored >= 1 ? stored : 1
}

export function newerFormat(raw: unknown): boolean {
  return formatOf(raw) > format
}

export type StoredRead<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly refusal: "newer" | "payload" }

export type Conversion<Context> = {
  readonly introduced: number
  readonly convert: (raw: Record<string, unknown>, context: Context) => unknown
}

export function converted<Context>(
  raw: Record<string, unknown>,
  stampOf: (raw: Record<string, unknown>) => number,
  conversions: readonly Conversion<Context>[],
  context: Context,
): Record<string, unknown> | null {
  let value = raw
  const due = [...conversions].sort((left, right) => left.introduced - right.introduced)
  for (const { introduced, convert } of due) {
    if (stampOf(value) >= introduced) continue
    const next = convert(value, context)
    if (typeof next !== "object" || next === null || Array.isArray(next)) return null
    value = next as Record<string, unknown>
  }
  return value
}
