import type { Deck } from "./model.ts"
import { parseDeck } from "./parse.ts"
import { validate } from "./apply.ts"
export type DeckJsxAdapter<T> = { toJsx: (deck: Deck) => T; fromJsx: (value: T) => unknown }
export function toJsx<T>(deck: Deck, adapter: DeckJsxAdapter<T>): T { return adapter.toJsx(deck) }
export function fromJsx<T>(value: T, adapter: DeckJsxAdapter<T>): Deck {
  const deck = parseDeck(adapter.fromJsx(value))
  validate(deck)
  return deck
}
