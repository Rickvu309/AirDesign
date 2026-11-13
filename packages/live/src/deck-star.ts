import { deckRoutes } from "@airdesign/catalog"
import { flushQueued, queuedValue, queueValue, type DeckQueue } from "./deck-queue.js"
import { post } from "./remote.js"

const on = "starred"

export const stars: DeckQueue = {
  slot: "\u0003star",
  send: async (deck, value) =>
    deckRoutes.star.result(await post(deckRoutes.star.path, { deck, starred: value === on })).ok,
}

export function flushStar(deck: string): Promise<{ readonly ok: boolean }> {
  return flushQueued(stars, deck)
}

export async function queuedStar(deck: string): Promise<boolean | undefined> {
  const value = await queuedValue(stars, deck)
  return value === undefined ? undefined : value === on
}

export async function starDeck(deck: string, starred: boolean): Promise<{ readonly ok: boolean }> {
  await queueValue(stars, deck, starred ? on : "unstarred")
  return flushStar(deck)
}
