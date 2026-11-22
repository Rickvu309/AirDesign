import { readListDecks } from "@airdesign/catalog"

import { answered, hostRefused, refused, type ToolResult } from "./answer.js"
import type { DeckHost } from "./deck-host.js"

export async function listDecksTool(raw: unknown, host: DeckHost): Promise<ToolResult> {
  const parsed = readListDecks(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  const listed = await host.list(parsed.cursor)
  if (!listed.ok) return hostRefused(listed)
  const decks = listed.decks.map(({ deck, name, rev }) => ({ deck, name, rev }))
  return answered("Your decks.", { ok: true, decks, ...(listed.next === undefined ? {} : { next: listed.next }) })
}
