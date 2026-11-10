export const limits = {
  decks: null,
  slides: 50,
  bytes: 70_000_000,
} as const

export function overLimit(count: { readonly decks: number; readonly slides: number; readonly bytes: number }): boolean {
  const deckLimit: number | null = limits.decks
  if (deckLimit !== null && count.decks > deckLimit) {
    return true
  }
  if (count.slides > limits.slides) {
    return true
  }
  return count.bytes >= limits.bytes
}
