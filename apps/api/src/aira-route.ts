import type { IncomingMessage, ServerResponse } from "node:http"

import { airaRoutes, countryHeader } from "@airdesign/catalog"
import type { CallerLog } from "@airdesign/mcp"

import { airaBodyCap, airaTurn, type AiraLine, type AiraSettings } from "./aira.js"
import type { Closing } from "./aira-closing.js"
import type { Sql } from "./pool.js"

type AiraVisit = {
  readonly options: { readonly aira?: AiraSettings; readonly session: Sql; readonly closing: Closing }
  readonly logs: Map<string, CallerLog>
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

export function airaRoute<Visit extends AiraVisit>(
  http: AiraHttp<Visit>,
): {
  readonly method: "POST"
  readonly path: typeof airaRoutes.turn.path
  readonly cap: number
  readonly serve: (visit: Visit) => Promise<void>
} {
  return {
    method: "POST",
    path: airaRoutes.turn.path,
    cap: airaBodyCap,
    serve: async (visit) => {
      const { options, logs, now, mint, req, res } = visit
      const signal = leftEarly(res)
      const email = await http.signedIn(visit)
      if (email === undefined) return
      const body = await visit.body()
      if (body === undefined) {
        http.answerSize(res)
        return
      }
      const answer = await airaTurn(
        { settings: options.aira, db: options.session, logs, now, mint, closing: options.closing },
        email,
        req.headers[countryHeader],
        http.parsedJson(body),
        signal,
      )
      if ("lines" in answer) await streamLines(res, answer.lines)
      else http.sendJson(res, answer.status, answer.body)
    },
  }
}
