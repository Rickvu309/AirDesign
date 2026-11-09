import type {NumberFormat, Paragraph, RetainedNumberScheme} from "./body.ts"

export function paragraphNumbers(paragraphs: readonly Paragraph[]): (number | null)[] {
  const counters = new Map<number, {format: NumberFormat | RetainedNumberScheme; value: number}>()
  return paragraphs.map(paragraph => {
    if (paragraph.marker.kind !== "number" && paragraph.marker.kind !== "source-number") { counters.clear(); return null }
    const marker = paragraph.marker, previous = counters.get(paragraph.level)
    const format = marker.kind === "number" ? marker.format : marker.scheme
    const continues = marker.start === null && previous?.format === format
    if (!continues) for (const level of counters.keys()) if (level > paragraph.level) counters.delete(level)
    const value = marker.start ?? (continues && previous ? previous.value + 1 : 1)
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error("numbering-overflow")
    counters.set(paragraph.level, {format, value})
    return value
  })
}
