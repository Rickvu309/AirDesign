import type { ServerResponse } from "node:http"

import { deckRoutes, type DeckId } from "@airdesign/catalog"
import type { DeckFollowers } from "./deck-followers.js"
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
    const answered = new AbortController()
    const woken = options.listen.wait(AbortSignal.any([signal, answered.signal]))
    try {
      await options.listen.ready()
      if (signal.aborted) return undefined
      const revision = watchedRevision(await readSaved(options.deck, deck), email, cursor)
      if (revision !== undefined) return revision
      await woken
    } finally {
      answered.abort()
    }
  }
}

type WatchVisit = {
  readonly options: { readonly deck: Sql; readonly listen: DeckListen; readonly followers: DeckFollowers }
  readonly res: ServerResponse
  readonly body: () => Promise<Buffer | undefined>
}

type WatchHttp<Visit> = {
  readonly signedIn: (visit: Visit) => Promise<string | undefined>
  readonly answerSize: (res: ServerResponse) => void
  readonly parsedJson: (body: Buffer) => unknown
  readonly sendJson: (res: ServerResponse, status: number, body: unknown) => void
  readonly gone: (res: ServerResponse) => AbortSignal
}

export function deckWatchRoute<Visit extends WatchVisit>(
  http: WatchHttp<Visit>,
): { readonly method: "POST"; readonly path: string; readonly serve: (visit: Visit) => Promise<void> } {
  return {
    method: "POST",
    path: deckRoutes.watch.path,
    serve: async (visit) => {
      const { options, res } = visit
      const email = await http.signedIn(visit)
      if (email === undefined) return
      const body = await visit.body()
      if (body === undefined) {
        http.answerSize(res)
        return
      }
      const parsed = deckRoutes.watch.read(http.parsedJson(body))
      if (!parsed.ok) {
        http.sendJson(res, 200, parsed)
        return
      }
      const signal = http.gone(res)
      const leave = options.followers.follow(parsed.deck)
      const revision = await heldRevision(options, parsed.deck, parsed.cursor, email, signal).finally(leave)
      if (revision === undefined || signal.aborted || res.writableEnded || res.destroyed) return
      if (revision === "owner" || revision === "deleted") {
        http.sendJson(res, 200, { ok: false, refusal: revision })
        return
      }
      http.sendJson(res, 200, { ok: true, deck: parsed.deck, revision })
    },
  }
}
