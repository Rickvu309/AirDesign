export const notesMinimum = 160
export const notesClosed = 24

export function maxNotesHeight(canvas: number, otherOverlay: number): number {
  return Math.max(notesMinimum, Math.floor(Math.min((canvas - otherOverlay) / 2, (canvas * 2) / 3 - otherOverlay - 80)))
}

export function clampNotesHeight(height: number, maximum: number): number {
  return Math.min(maximum, Math.max(notesMinimum, height))
}

export function trackNotesHeight(raw: number, maximum: number): number {
  return Math.max(notesClosed, raw > maximum ? maximum + (raw - maximum) * 0.2 : raw)
}

export function notesOpacity(height: number): number {
  return Math.min(1, Math.max(0, (height - notesClosed) / (notesMinimum - notesClosed)))
}

export function releaseNotesHeight(height: number, velocity: number, maximum: number): number {
  if (height >= notesMinimum) return clampNotesHeight(height, maximum)
  if (velocity < -0.11) return notesClosed
  if (velocity > 0.11) return notesMinimum
  return height < (notesClosed + notesMinimum) / 2 ? notesClosed : notesMinimum
}

export type NotesSample = { readonly y: number; readonly at: number }

export function notesVelocity(samples: readonly NotesSample[]): number {
  const last = samples.at(-1)
  if (!last) return 0
  const first = samples.find((sample) => sample.at >= last.at - 100)
  if (!first || last.at === first.at) return 0
  return (first.y - last.y) / (last.at - first.at)
}

export function rawNotesHeight(height: number, maximum: number): number {
  return height > maximum ? maximum + (height - maximum) / 0.2 : height
}
