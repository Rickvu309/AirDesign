import type { ServerResponse } from "node:http"

import { deckRoutes } from "@airdesign/catalog"

import type { DeckFindings } from "../doom/deck-findings.js"
import type { DeckPictures } from "../doom/deck-pictures.js"
import type { Sql } from "../platform/pool.js"
import { deckAccess, readSaved } from "./saved.js"

type FindingsVisit = {
  readonly options: { readonly deck: Sql; readonly findings: DeckFindings; readonly pictures: DeckPictures }
  readonly res: ServerResponse
  readonly body: () => Promise<Buffer | undefined>
}

type FindingsHttp<Visit> = {
  readonly signedIn: (visit: Visit) => Promise<string | undefined>
  readonly answerSize: (res: ServerResponse) => void
  readonly parsedJson: (body: Buffer) => unknown
  readonly sendJson: (res: ServerResponse, status: number, body: unknown) => void
}

export function findingsRoute<Visit extends FindingsVisit>(
  http: FindingsHttp<Visit>,
): { readonly method: "POST"; readonly path: string; readonly serve: (visit: Visit) => Promise<void> } {
  return {
    method: "POST",
    path: deckRoutes.findings.path,
    serve: async (visit) => {
      const email = await http.signedIn(visit)
      if (email === undefined) return
      const body = await visit.body()
      if (body === undefined) {
        http.answerSize(visit.res)
        return
      }
      const parsed = deckRoutes.findings.read(http.parsedJson(body))
      if (!parsed.ok) {
        http.sendJson(visit.res, 200, parsed)
        return
      }
      const saved = await readSaved(visit.options.deck, parsed.deck)
      const access = saved === undefined ? ({ ok: false, refusal: "deck" } as const) : deckAccess(saved, email)
      if (!access.ok) {
        http.sendJson(visit.res, 200, { ok: false, refusal: access.refusal })
        return
      }
      if (parsed.revision > access.saved.revision) {
        http.sendJson(visit.res, 200, { ok: false, refusal: "stale" })
        return
      }
      const { ok: _read, pictures, ...report } = parsed
      visit.options.findings.keep(report)
      const missing = pictures === undefined ? [] : visit.options.pictures.keep(parsed.deck, parsed.revision, pictures)
      http.sendJson(visit.res, 200, { ok: true, deck: parsed.deck, ...(pictures === undefined ? {} : { missing }) })
    },
  }
}
