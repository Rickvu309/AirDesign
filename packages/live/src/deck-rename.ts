import { deckRoutes } from "@airdesign/catalog"
import { flushQueued, queuedValue, queueValue, type DeckQueue } from "./deck-queue.js"
import { renameParts } from "./part.js"
import { post } from "./remote.js"

const names: DeckQueue = {
  slot: "\u0003name",
  send: async (deck, name) => deckRoutes.rename.result(await post(deckRoutes.rename.path, { deck, name })).ok,
}

export function flushRename(deck: string): Promise<{ readonly ok: boolean }> {
  return flushQueued(names, deck)
}

export function queuedName(deck: string): Promise<string | undefined> {
  return queuedValue(names, deck)
}

export async function queueRename(deck: string, name: string): Promise<void> {
  await queueValue(names, deck, name)
}

export async function renameDeck(deck: string, name: string): Promise<{ readonly ok: boolean }> {
  const renamed = await renameParts(deck, name)
  if (!renamed.ok) return renamed
  await queueRename(deck, name)
  return flushRename(deck)
}
