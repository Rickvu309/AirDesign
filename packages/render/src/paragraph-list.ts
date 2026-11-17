import type { TextList } from "@airdesign/document"

export type ListSource = { readonly level: number; readonly scheme: string; readonly start: number }

export function listNumbers(
  file: (from: number) => ListSource | null,
): (from: number, list: TextList | undefined) => number | null {
  const counts = new Map<number, { readonly scheme: string; readonly start: number; readonly number: number }>()
  return (from, list) => {
    const native = file(from)
    const level = native?.level ?? 0
    for (const known of counts.keys()) if (known > level) counts.delete(known)
    if (list !== "numbers" && (list !== undefined || native === null)) {
      counts.delete(level)
      return null
    }
    const scheme = list === "numbers" ? "arabicPeriod" : (native?.scheme ?? "arabicPeriod")
    const start = list === "numbers" ? 1 : (native?.start ?? 1)
    const previous = counts.get(level)
    const number = previous?.scheme === scheme && previous.start === start ? previous.number + 1 : start
    counts.set(level, { scheme, start, number })
    return number
  }
}
