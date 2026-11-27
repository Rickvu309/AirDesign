import { readAppState } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

import { answered, hostRefused, refused, type Answer } from "./answer.js"
import type { DeckHost } from "./deck-host.js"

export async function appStateTool(raw: unknown, host: DeckHost): Promise<Answer> {
  const parsed = readAppState(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  const listed = await host.list(parsed.cursor)
  if (!listed.ok) return hostRefused(listed)
  const decks = listed.decks.map(({ deck, name, rev }) => ({ deck, name, rev }))
  const tab = host.openTab?.()
  const opened = tab === undefined ? undefined : await host.open(tab.deck)
  const openDeck =
    opened?.ok === true && tab !== undefined
      ? {
          deck: opened.deck,
          name: doom.deckName(opened.fold),
          rev: opened.rev,
          ...(tab.selection === undefined ? {} : { selection: tab.selection }),
        }
      : null
  return answered(openDeck === null ? "No deck is open in an AirDesign tab." : "A deck is open in an AirDesign tab.", {
    ok: true,
    decks,
    openDeck,
    ...(listed.next === undefined ? {} : { next: listed.next }),
  })
}
