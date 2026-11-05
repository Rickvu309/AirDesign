export function deckInvariantHits(file: string, source: string): { line: number; reason: string }[] {
  if (!file.replaceAll("\\", "/").endsWith("packages/deck/src/model.ts")) return []
  const hits: { line: number; reason: string }[] = []
  for (const [index, line] of source.split("\n").entries()) {
    if (/\b(theme|placeholder|overlap): string\b/.test(line) || /themes: \{ id: string\b/.test(line)) hits.push({ line: index + 1, reason: "deck-reference-requires-distinct-id-brand" })
    if (/runs: Run\[\]/.test(line)) hits.push({ line: index + 1, reason: "text-requires-style-bearing-first-run" })
  }
  return hits
}
