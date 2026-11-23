import { deckRoutes } from "@airdesign/catalog"
import { flushQueued, keepShelved, queuedValue, queueValue, type DeckQueue } from "./deck-queue.js"
import { post } from "./doom-remote.js"

const on = "starred"

export const stars: DeckQueue = {
  slot: "\u0003star",
  send: async (deck, value) =>
    deckRoutes.star.result(await post(deckRoutes.star.path, { deck, starred: value === on })).ok,
}

function flushStar(deck: string): Promise<{ readonly ok: boolean }> {
  return flushQueued(stars, deck)
}

async function queuedStar(deck: string): Promise<boolean | undefined> {
  const value = await queuedValue(stars, deck)
  return value === undefined ? undefined : value === on
}

export async function starDeck(deck: string, starred: boolean): Promise<{ readonly ok: boolean }> {
  await queueValue(stars, deck, starred ? on : "unstarred")
  return flushStar(deck)
}

let keeping: Promise<void> | undefined

function keepQueued(): Promise<void> {
  keeping ??= keepShelved([stars]).finally(() => {
    keeping = undefined
  })
  return keeping
}

export async function sendQueued(decks: readonly string[]): Promise<ReadonlyMap<string, boolean>> {
  await keepQueued()
  const queued = await Promise.all(decks.map(async (deck) => [deck, await queuedStar(deck)] as const))
  const held = new Map(queued.filter((entry): entry is readonly [string, boolean] => entry[1] !== undefined))
  for (const deck of held.keys()) void flushStar(deck)
  return held
}
