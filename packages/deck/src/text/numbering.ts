import type {NumberFormat, Paragraph} from "./body.ts"

export function paragraphNumbers(paragraphs: readonly Paragraph[]): (number | null)[] {
  const counters = new Map<number, {format: NumberFormat; value: number}>()
  return paragraphs.map(paragraph => {
    if (paragraph.marker.kind !== "number") { counters.clear(); return null }
    const marker = paragraph.marker, previous = counters.get(paragraph.level)
    const continues = marker.start === null && previous?.format === marker.format
    if (!continues) for (const level of counters.keys()) if (level > paragraph.level) counters.delete(level)
    const value = marker.start ?? (continues && previous ? previous.value + 1 : 1)
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error("numbering-overflow")
    counters.set(paragraph.level, {format: marker.format, value})
    return value
  })
}
