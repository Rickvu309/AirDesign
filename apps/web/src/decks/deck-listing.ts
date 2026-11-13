export type ListedDeck = {
  readonly deck: string
  readonly name: string
  readonly edited: string
  readonly created: string
  readonly trashed?: string
  readonly starred?: boolean
}

export const recentCount = 6

function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
}

function newestFirst(left: ListedDeck, right: ListedDeck): number {
  const edited = Date.parse(right.edited) - Date.parse(left.edited)
  if (edited !== 0) return edited
  const created = Date.parse(right.created) - Date.parse(left.created)
  if (created !== 0) return created
  return left.deck < right.deck ? -1 : left.deck > right.deck ? 1 : 0
}

export function decksMatching<Deck extends ListedDeck>(decks: readonly Deck[], query: string): Deck[] {
  const wanted = plain(query.trim())
  return wanted === "" ? [...decks] : decks.filter((deck) => plain(deck.name).includes(wanted))
}

export function allDecks<Deck extends ListedDeck>(decks: readonly Deck[]): Deck[] {
  return [...decks].sort(newestFirst)
}

export function recentDecks<Deck extends ListedDeck>(decks: readonly Deck[]): Deck[] {
  return allDecks(decks).slice(0, recentCount)
}
