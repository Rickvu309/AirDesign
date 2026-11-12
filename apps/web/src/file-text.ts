import type { PaintElement, PaintText, SlidePaint } from "@airdesign/pptx"

function slideTexts(file: SlidePaint): ReadonlyMap<string, PaintText | null> {
  const texts = new Map<string, PaintText | null>()
  for (const row of file.elements) {
    if (row.from !== "slide") continue
    texts.set(row.shape, texts.has(row.shape) ? null : row.text)
  }
  return texts
}

export function fileTexts(rows: readonly PaintElement[], file: SlidePaint | null): readonly PaintElement[] {
  if (file === null) return rows
  const texts = slideTexts(file)
  return rows.map((row) => {
    const text = row.from === "slide" && row.text !== null ? texts.get(row.shape) : undefined
    return text === undefined || text === null ? row : { ...row, text }
  })
}
