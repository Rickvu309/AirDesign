import type { PaintColor, PaintElement, PaintRunStyle, PaintText, SlidePaint } from "@airdesign/pptx"

function slideTexts(file: SlidePaint): ReadonlyMap<string, PaintText | null> {
  const texts = new Map<string, PaintText | null>()
  for (const row of file.elements) {
    if (row.from !== "slide") continue
    texts.set(row.shape, texts.has(row.shape) ? null : row.text)
  }
  return texts
}

function exportedAlpha(text: PaintText): number | null {
  const [first, ...rest] = text.paragraphs.flatMap((paragraph) =>
    paragraph.runs.flatMap((run) => (run.color === null ? [] : [run.color.alpha])),
  )
  return first !== undefined && rest.every((each) => each === first) ? first : null
}

function faded<S extends PaintRunStyle>(style: S, alpha: number): S {
  const color: PaintColor | null = style.color === null ? null : { ...style.color, alpha }
  return { ...style, color }
}

function framed(file: PaintText, exported: PaintText): PaintText {
  const { paragraphs: _paragraphs, ...frame } = exported
  return { ...file, ...frame }
}

function fadedText(file: PaintText, exported: PaintText): PaintText {
  const alpha = exportedAlpha(exported)
  if (alpha === null) return framed(file, exported)
  return {
    ...framed(file, exported),
    paragraphs: file.paragraphs.map((paragraph) => ({
      ...paragraph,
      runs: paragraph.runs.map((run) => faded(run, alpha)),
      endStyle: faded(paragraph.endStyle, alpha),
    })),
  }
}

export function fileTexts(rows: readonly PaintElement[], file: SlidePaint | null): readonly PaintElement[] {
  if (file === null) return rows
  const texts = slideTexts(file)
  return rows.map((row) => {
    const text = row.from === "slide" && row.text !== null ? texts.get(row.shape) : undefined
    return text === undefined || text === null || row.text === null ? row : { ...row, text: fadedText(text, row.text) }
  })
}
