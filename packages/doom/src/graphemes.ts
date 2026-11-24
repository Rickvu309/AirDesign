const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })

export function graphemes(text: string): Intl.Segments {
  return segmenter.segment(text)
}

export function fontSamples(
  texts: readonly string[],
  chars = new Set<string>(),
): {
  readonly chars: ReadonlySet<string>
  readonly pairs: ReadonlyMap<string, readonly [string, string]>
} {
  const pairs = new Map<string, readonly [string, string]>()
  for (const text of texts) {
    let previous: string | undefined
    for (const { segment } of graphemes(text.normalize("NFC"))) {
      chars.add(segment)
      if (previous !== undefined) pairs.set(previous + segment, [previous, segment])
      previous = segment
    }
  }
  return { chars, pairs }
}
