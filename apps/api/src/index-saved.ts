import { type DeckId, type WireRefusal, readDeckIndex } from "@airdesign/catalog"
import { indexDeck } from "@airdesign/engine"
import type { Sql } from "./pool.js"
import { deckAccess, readSaved } from "./saved.js"

type Parsed = Extract<ReturnType<typeof readDeckIndex>, { readonly ok: true }>

const writeSql = `
update deck.saved set import_index = $3::jsonb
where id = $1 and owner = $2 and deleted is null
  and import_index is not distinct from $4::jsonb
returning id
`

export async function indexSaved(
  db: Sql,
  parsed: Parsed,
  owner: string,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly revision: number }
  | { readonly ok: false; readonly refusal: WireRefusal }
> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const saved = await readSaved(db, parsed.deck)
    if (saved === undefined) return { ok: false, refusal: "deck" }
    const access = deckAccess(saved, owner)
    if (!access.ok) return access
    const before = { id: parsed.deck, revision: saved.revision, register: access.saved.register }
    const { ok: _ok, ...wire } = parsed
    const next = indexDeck(before, { actor: "person" }, wire)
    if (!next.ok) return next
    if (next.deck === before) return { ok: true, deck: parsed.deck, revision: saved.revision }
    const written = await db.query(writeSql, [
      parsed.deck,
      owner,
      JSON.stringify(next.deck.register.index),
      before.register.index === undefined ? null : JSON.stringify(before.register.index),
    ])
    if (written.rows.length > 0) return { ok: true, deck: parsed.deck, revision: saved.revision }
  }
  return { ok: false, refusal: "stale" }
}
