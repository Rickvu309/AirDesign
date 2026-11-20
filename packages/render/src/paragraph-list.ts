import { levelNumbering, type TextList } from "@airdesign/document"

export type ListSource = { readonly level: number } & (
  | { readonly scheme: null }
  | { readonly scheme: string; readonly start: number }
)

export function listNumbers(
  file: (from: number) => ListSource,
): (from: number, list: TextList | undefined, kept?: number) => number | null {
  const counts = new Map<number, { readonly scheme: string; readonly start: number; readonly number: number }>()
  return (from, list, kept) => {
    const native = file(from)
    const level = kept ?? native.level
    for (const known of counts.keys()) if (known > level) counts.delete(known)
    const numbered =
      list === "numbers" || (list === undefined && native.scheme !== null && kept !== undefined)
        ? { scheme: kept === undefined ? "arabicPeriod" : levelNumbering(kept), start: 1 }
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
