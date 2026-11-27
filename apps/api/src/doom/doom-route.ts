import type { ServerResponse } from "node:http"

import { doomRoutes, type TabSelection } from "@airdesign/catalog"

import type { DeckScreenshots } from "./deck-screenshots.js"
import type { DeckListen } from "../platform/listen.js"
import type { Sql } from "../platform/pool.js"
import { createDoom, editDoom, openDoom, runDoom, doomRev, sinceDoom } from "./doom-deck.js"

type DoomVisit = {
  readonly options: { readonly deck: Sql; readonly listen: DeckListen; readonly screenshots: DeckScreenshots }
  readonly res: ServerResponse
  readonly body: () => Promise<Buffer | undefined>
}

type DoomHttp<Visit> = {
  readonly signedIn: (visit: Visit) => Promise<string | undefined>
  readonly answerSize: (res: ServerResponse) => void
  readonly parsedJson: (body: Buffer) => unknown
  readonly sendJson: (res: ServerResponse, status: number, body: unknown) => void
  readonly gone: (res: ServerResponse) => AbortSignal
}

type Route<Visit> = {
  readonly method: "POST"
  readonly path: string
  readonly serve: (visit: Visit) => Promise<void>
}

const owed = (
  options: DoomVisit["options"],
  parsed: { readonly deck: string; readonly screenshots?: boolean | undefined },
) => parsed.screenshots !== true && options.screenshots.wanted(parsed.deck as never)

function withScreenshots<Caught extends object>(
  options: DoomVisit["options"],
  parsed: { readonly deck: string; readonly screenshots?: boolean | undefined },
  caught: Caught,
) {
  return owed(options, parsed) ? { ...caught, screenshots: true as const } : caught
}

async function heldSince(
  options: DoomVisit["options"],
  parsed: {
    readonly deck: Parameters<typeof sinceDoom>[1]["deck"]
    readonly rev: number
    readonly screenshots?: boolean | undefined
    readonly selection?: TabSelection | undefined
  },
  email: string,
  signal: AbortSignal,
) {
  for (;;) {
    const answered = new AbortController()
    const hold = AbortSignal.any([signal, answered.signal])
    const woken = options.listen.wait(hold, { deck: parsed.deck }).then(() => false)
    const jobs = options.screenshots.lease(parsed.deck, hold)
    try {
      await options.listen.ready()
      if (signal.aborted) return undefined
      const caught = await sinceDoom(options.deck, parsed, email)
      if (!caught.ok) return caught
      if (caught.edits.length > 0 || owed(options, parsed)) return withScreenshots(options, parsed, caught)
      options.screenshots.watchTab(email, { deck: parsed.deck, selection: parsed.selection }, hold)
      const wanted = await Promise.race([woken, jobs])
      if (signal.aborted) return undefined
      if (wanted) return { ...caught, screenshots: true as const }
    } finally {
      answered.abort()
    }
  }
}

export function doomRouteList<Visit extends DoomVisit>(http: DoomHttp<Visit>): readonly Route<Visit>[] {
  function route<Read extends (raw: unknown) => { readonly ok: boolean }>(
    path: string,
    read: Read,
    answer: (visit: Visit, parsed: Extract<ReturnType<Read>, { readonly ok: true }>, email: string) => Promise<unknown>,
  ): Route<Visit> {
    return {
      method: "POST",
      path,
      serve: async (visit) => {
        const email = await http.signedIn(visit)
        if (email === undefined) return
        const body = await visit.body()
        if (body === undefined) {
          http.answerSize(visit.res)
          return
        }
        const parsed = read(http.parsedJson(body)) as ReturnType<Read>
        if (!parsed.ok) {
          http.sendJson(visit.res, 200, parsed)
          return
        }
        const answered = await answer(visit, parsed as Extract<ReturnType<Read>, { readonly ok: true }>, email)
        if (answered !== undefined) http.sendJson(visit.res, 200, answered)
      },
    }
  }
  return [
    route(doomRoutes.create.path, doomRoutes.create.read, (visit, parsed, email) =>
      createDoom(visit.options.deck, parsed, email),
    ),
    route(doomRoutes.open.path, doomRoutes.open.read, (visit, parsed, email) =>
      openDoom(visit.options.deck, parsed, email),
    ),
    route(doomRoutes.edit.path, doomRoutes.edit.read, (visit, parsed, email) =>
      editDoom(visit.options.deck, parsed, email),
    ),
    route(doomRoutes.screenshots.path, doomRoutes.screenshots.read, async (visit, parsed, email) => {
      const known = await doomRev(visit.options.deck, parsed.deck, email)
      if (!known.ok) return known
      if (parsed.rev > known.rev) return { ok: false, refusal: "stale" }
      const missing = visit.options.screenshots.keep(parsed.deck, parsed.rev, parsed.screenshots)
      return { ok: true, deck: parsed.deck, missing: visit.options.screenshots.wantedAmong(parsed.deck, missing) }
    }),
    route(doomRoutes.run.path, doomRoutes.run.read, (visit, parsed, email) =>
      runDoom(visit.options.deck, parsed, email),
    ),
    route(doomRoutes.since.path, doomRoutes.since.read, async (visit, parsed, email) => {
      if (parsed.wait !== true) {
        const caught = await sinceDoom(visit.options.deck, parsed, email)
        return caught.ok ? withScreenshots(visit.options, parsed, caught) : caught
      }
      const signal = http.gone(visit.res)
      const caught = await heldSince(visit.options, parsed, email, signal)
      return signal.aborted || visit.res.writableEnded || visit.res.destroyed ? undefined : caught
    }),
  ]
}
