import type { DeckId } from "@airdesign/catalog"
import type { DeckListen } from "./listen.js"
import type { Sql } from "./pool.js"
import { readSaved, watchedRevision } from "./saved.js"

export async function heldRevision(
  options: { readonly deck: Sql; readonly listen: DeckListen },
  deck: DeckId,
  cursor: number | null,
  email: string,
  signal: AbortSignal,
): Promise<number | "owner" | "deleted" | undefined> {
  for (;;) {
    if (signal.aborted) return undefined
    await options.listen.ready()
    if (signal.aborted) return undefined
    const revision = watchedRevision(await readSaved(options.deck, deck), email, cursor)
    if (revision !== undefined) return revision
    await options.listen.wait(signal)
  }
}
