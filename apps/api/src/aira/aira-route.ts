import type { IncomingMessage, ServerResponse } from "node:http"

import { airaRoutes, countryHeader, readStop } from "@airdesign/catalog"

import { airaTurn, airaTurnCap, type AiraLine, type AiraSettings } from "./aira.js"
import type { Closing } from "./aira-closing.js"
import { filterForwardedHeaders } from "../platform/forward-secret.js"
import type { Sql } from "../platform/pool.js"
import { spendOnce } from "../legacy-decks/saved.js"

type AiraVisit = {
  readonly options: {
    readonly aira?: AiraSettings
    readonly session: Sql
    readonly deck: Sql
    readonly closing: Closing
    readonly forwardSecret?: string
  }
  readonly now: () => number
  readonly mint: () => string
  readonly req: IncomingMessage
  readonly res: ServerResponse
  readonly body: () => Promise<Buffer | undefined>
}

type AiraHttp<Visit extends AiraVisit> = {
  readonly signedIn: (visit: Visit) => Promise<string | undefined>
  readonly answerSize: (res: ServerResponse) => void
  readonly parsedJson: (body: Buffer) => unknown
  readonly sendJson: (res: ServerResponse, status: number, body: unknown) => void
}

function leftEarly(res: ServerResponse): AbortSignal {
  const left = new AbortController()
  const leave = (): void => {
    if (!res.writableFinished) left.abort()
  }
  if (res.destroyed) leave()
  else res.once("close", leave)
  return left.signal
}

async function streamLines(res: ServerResponse, lines: AsyncIterable<AiraLine>): Promise<void> {
  if (!res.destroyed) {
    res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" })
  }
  for await (const line of lines) {
    if (!res.destroyed && !res.writableEnded) res.write(`${JSON.stringify(line)}\n`)
  }
  res.end()
}

type AiraServed<Visit> = {
  readonly method: "POST"
  readonly path: string
  readonly cap?: number
  readonly serve: (visit: Visit) => Promise<void>
}

export function airaRouteList<Visit extends AiraVisit>(http: AiraHttp<Visit>): readonly AiraServed<Visit>[] {
  return [
    {
      method: "POST",
      path: airaRoutes.turn.path,
      cap: airaTurnCap,
      serve: async (visit) => {
        const { options, now, mint, req, res } = visit
        filterForwardedHeaders(req.headers, options.forwardSecret)
        const signal = leftEarly(res)
        const email = await http.signedIn(visit)
        if (email === undefined) return
        const body = await visit.body()
        if (body === undefined) {
          http.answerSize(res)
          return
        }
        const answer = await airaTurn(
          { settings: options.aira, db: options.session, now, mint, closing: options.closing },
          email,
          req.headers[countryHeader],
          http.parsedJson(body),
          signal,
        )
        if ("lines" in answer) await streamLines(res, answer.lines)
        else http.sendJson(res, answer.status, answer.body)
      },
    },
    {
      method: "POST",
      path: airaRoutes.stop.path,
      serve: async (visit) => {
        const email = await http.signedIn(visit)
        if (email === undefined) return
        const body = await visit.body()
        if (body === undefined) {
          http.answerSize(visit.res)
          return
        }
        const stop = readStop(http.parsedJson(body))
        if (!stop.ok) {
          http.sendJson(visit.res, 400, { ok: false, refusal: "body" })
          return
        }
        const spent =
          stop.call === undefined
            ? undefined
            : await spendOnce(visit.options.deck, email, stop.call.deck, stop.call.once)
        await visit.options.closing.stop(email, stop.ask)
        http.sendJson(
          visit.res,
          200,
          spent?.ok === true && spent.runId !== undefined ? { ok: true, runId: spent.runId } : { ok: true },
        )
      },
    },
  ]
}
