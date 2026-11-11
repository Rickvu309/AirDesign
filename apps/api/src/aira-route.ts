import type { IncomingMessage, ServerResponse } from "node:http"

import type { CallerLog } from "@airdesign/mcp"

import { airaBodyCap, airaTurn, type AiraSettings } from "./aira.js"
import type { Sql } from "./pool.js"

type AiraVisit = {
  readonly options: { readonly aira?: AiraSettings; readonly session: Sql }
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

export function airaRoute<Visit extends AiraVisit>(
  http: AiraHttp<Visit>,
): {
  readonly method: "POST"
  readonly path: "/aira/turn"
  readonly cap: number
  readonly serve: (visit: Visit) => Promise<void>
} {
  return {
    method: "POST",
    path: "/aira/turn",
    cap: airaBodyCap,
    serve: async (visit) => {
      const { options, logs, now, mint, req, res } = visit
      const email = await http.signedIn(visit)
      if (email === undefined) return
      const body = await visit.body()
      if (body === undefined) {
        http.answerSize(res)
        return
      }
      const answer = await airaTurn(
        { settings: options.aira, db: options.session, logs, now, mint },
        email,
        req.headers["cf-ipcountry"],
        http.parsedJson(body),
      )
      http.sendJson(res, answer.status, answer.body)
    },
  }
}
