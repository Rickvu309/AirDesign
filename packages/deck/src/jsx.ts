import type { Deck } from "./model.ts"
export function withDeckAdapter<T>(deck: Deck, adapter: (deck: Deck) => T): T { return adapter(deck) }
