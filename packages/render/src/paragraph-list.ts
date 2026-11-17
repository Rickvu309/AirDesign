import type { TextList } from "@airdesign/document"

export type ListSource = { readonly level: number } & (
  | { readonly scheme: null }
  | { readonly scheme: string; readonly start: number }
)

export function listNumbers(
  file: (from: number) => ListSource,
): (from: number, list: TextList | undefined) => number | null {
  const counts = new Map<number, { readonly scheme: string; readonly start: number; readonly number: number }>()
  return (from, list) => {
    const native = file(from)
    const level = native.level
    for (const known of counts.keys()) if (known > level) counts.delete(known)
    const numbered =
      list === "numbers"
        ? { scheme: "arabicPeriod", start: 1 }
        : list === undefined && native.scheme !== null
          ? native
          : null
    if (numbered === null) {
      counts.delete(level)
      return null
    }
    const { scheme, start } = numbered
    const previous = counts.get(level)
    const number = previous?.scheme === scheme && previous.start === start ? previous.number + 1 : start
    counts.set(level, { scheme, start, number })
    return number
  }
}
