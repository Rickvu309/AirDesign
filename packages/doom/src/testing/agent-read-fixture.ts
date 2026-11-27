import { hex, ids } from "../sample-deck.js"
import { apply, build } from "./agent-fixtures.js"
import { more, richDeck } from "./rich-deck.js"

export const agentReadFixture: {
  readonly apply: typeof apply
  readonly build: typeof build
  readonly hex: typeof hex
  readonly ids: typeof ids
  readonly more: typeof more
  readonly richDeck: typeof richDeck
} = { apply, build, hex, ids, more, richDeck }
