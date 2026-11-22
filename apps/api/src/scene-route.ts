import type { ServerResponse } from "node:http"

import { sceneRoutes } from "@airdesign/catalog"

import type { DeckPictures } from "./deck-pictures.js"
import type { DeckListen } from "./listen.js"
import type { Sql } from "./pool.js"
import { createScene, editScene, openScene, sceneRev, sinceScene } from "./scene-deck.js"

type SceneVisit = {
  readonly options: { readonly deck: Sql; readonly listen: DeckListen; readonly pictures: DeckPictures }
  readonly res: ServerResponse
  readonly body: () => Promise<Buffer | undefined>
}

type SceneHttp<Visit> = {
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
  options: SceneVisit["options"],
  parsed: { readonly deck: string; readonly pictures?: boolean | undefined },
) => parsed.pictures !== true && options.pictures.wanted(parsed.deck as never)

function withPictures<Caught extends object>(
  options: SceneVisit["options"],
  parsed: { readonly deck: string; readonly pictures?: boolean | undefined },
  caught: Caught,
) {
  return owed(options, parsed) ? { ...caught, pictures: true as const } : caught
}

async function heldSince(
  options: SceneVisit["options"],
  parsed: {
    readonly deck: Parameters<typeof sinceScene>[1]["deck"]
    readonly rev: number
    readonly pictures?: boolean | undefined
  },
  email: string,
  signal: AbortSignal,
) {
  for (;;) {
    const answered = new AbortController()
    const hold = AbortSignal.any([signal, answered.signal])
    const woken = options.listen.wait(hold).then(() => false)
    const asked = options.pictures.asked(parsed.deck, hold)
    try {
      await options.listen.ready()
      if (signal.aborted) return undefined
      const caught = await sinceScene(options.deck, parsed, email)
      if (!caught.ok) return caught
      if (caught.edits.length > 0 || owed(options, parsed)) return withPictures(options, parsed, caught)
      const wanted = await Promise.race([woken, asked])
      if (signal.aborted) return undefined
      if (wanted) return { ...caught, pictures: true as const }
    } finally {
      answered.abort()
    }
  }
}

export function sceneRouteList<Visit extends SceneVisit>(http: SceneHttp<Visit>): readonly Route<Visit>[] {
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
    route(sceneRoutes.create.path, sceneRoutes.create.read, (visit, parsed, email) =>
      createScene(visit.options.deck, parsed, email),
    ),
    route(sceneRoutes.open.path, sceneRoutes.open.read, (visit, parsed, email) =>
      openScene(visit.options.deck, parsed, email),
    ),
    route(sceneRoutes.edit.path, sceneRoutes.edit.read, (visit, parsed, email) =>
      editScene(visit.options.deck, parsed, email),
    ),
    route(sceneRoutes.pictures.path, sceneRoutes.pictures.read, async (visit, parsed, email) => {
      const known = await sceneRev(visit.options.deck, parsed.deck, email)
      if (!known.ok) return known
      if (parsed.rev > known.rev) return { ok: false, refusal: "stale" }
      const missing = visit.options.pictures.keep(parsed.deck, parsed.rev, parsed.pictures)
      return { ok: true, deck: parsed.deck, missing: visit.options.pictures.wantedAmong(parsed.deck, missing) }
    }),
    route(sceneRoutes.since.path, sceneRoutes.since.read, async (visit, parsed, email) => {
      if (parsed.wait !== true) {
        const caught = await sinceScene(visit.options.deck, parsed, email)
        return caught.ok ? withPictures(visit.options, parsed, caught) : caught
      }
      const signal = http.gone(visit.res)
      const caught = await heldSince(visit.options, parsed, email, signal)
      return signal.aborted || visit.res.writableEnded || visit.res.destroyed ? undefined : caught
    }),
  ]
}
