import type { DeckId, WireRefusal } from "@airdesign/catalog"
import { call, type Deck } from "@airdesign/engine"

import type { DeckAnswers } from "./deck-answer.js"
import type { Sql } from "./pool.js"
import { deckAccess, readSaved, writeRevision } from "./saved.js"

export async function undoRun(
  db: Sql,
  parsed: { readonly deck: DeckId; readonly runId: string },
  owner: string,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly revision: number; readonly key: string }
  | { readonly ok: false; readonly refusal: WireRefusal }
> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const read = await readSaved(db, parsed.deck)
    if (read === undefined) return { ok: false, refusal: "deck" }
    const access = deckAccess(read, owner)
    if (!access.ok) return access
    const current: Deck = { id: parsed.deck, revision: access.saved.revision, register: access.saved.register }
    const result = call("undo_run", current, { actor: "person" }, { deck: parsed.deck, runId: parsed.runId })
    if (!result.ok) return result
    const { id, revision, register } = result.deck
    if (await writeRevision(db, { id, revision, register, expected: current.revision, key: result.key })) {
      return { ok: true, deck: id, revision, key: result.key }
    }
  }
  return { ok: false, refusal: "stale" }
}

export const undoAnswers = { undo: undoRun } satisfies Partial<DeckAnswers>
