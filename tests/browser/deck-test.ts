import { expect, test as base } from "@playwright/test"
import { deckStateFixture, type DeckState } from "./deck-state"

export const test = base.extend<{ deckState: DeckState }>({
  deckState: deckStateFixture,
})

export { expect }
