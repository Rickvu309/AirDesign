import {
  format,
  indexedSectionStarts,
  readSlideId,
  readSlideState,
  type DeckIndex,
  type SlideId,
} from "@airdesign/document"

export type GridOpening = {
  readonly format: number
  readonly file: readonly SlideId[]
  readonly sectionStarts: readonly SlideId[]
}

export function gridOpening(
  slides: readonly { readonly id: string }[],
  sectionStarts: readonly SlideId[],
): GridOpening {
  return { format, file: slides.flatMap(({ id }) => readSlideId(id) ?? []), sectionStarts }
}

export function indexedGridOpening(index: DeckIndex | undefined): GridOpening | undefined {
  const starts = indexedSectionStarts(index)
  return index === undefined || starts === undefined ? undefined : gridOpening(index.slides, starts)
}

export function gridOpeningKey(deck: string): string {
  return `${deck}\u0002sectionStarts`
}

export function readGridOpening(raw: unknown): GridOpening | undefined {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("file" in raw) ||
    !("sectionStarts" in raw) ||
    !Array.isArray(raw.sectionStarts) ||
    !("format" in raw) ||
    typeof raw.format !== "number"
  )
    return undefined
  const file = readSlideState({ file: raw.file, order: [] })?.file
  if (file === undefined) return undefined
  const starts: SlideId[] = []
  let last = -1
  for (const value of raw.sectionStarts) {
    const id = readSlideId(value)
    if (id === undefined) return undefined
    const at = file.indexOf(id)
    if (last < 0 ? at !== 0 : at <= last) return undefined
    last = at
    starts.push(id)
  }
  return { format: raw.format, file, sectionStarts: starts }
}
