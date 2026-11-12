import type { IncomingMessage, ServerResponse } from "node:http"

import { accountRoutes, readEmail, readSessionCookie, signOutRoutes } from "@airdesign/catalog"
import type { CallerLog, Turns } from "@airdesign/mcp"

import { deleteAccess } from "./account.js"
import { drainOriginals } from "./original.js"
import type { OriginalStore } from "./original-store.js"
import type { Sql } from "./pool.js"

type AccountVisit = {
  readonly options: {
    readonly session: Sql
    readonly deck: Sql
    readonly originals?: OriginalStore
    readonly cookieDomain?: string
    readonly turns: Map<string, Turns>
  }
  readonly logs: Map<string, CallerLog>
  readonly req: IncomingMessage
  readonly res: ServerResponse
  readonly body: () => Promise<Buffer | undefined>
}

type AccountHttp<Visit extends AccountVisit> = {
  readonly signedIn: (visit: Visit) => Promise<string | undefined>
  readonly answerSize: (res: ServerResponse) => void
  readonly parsedJson: (body: Buffer) => unknown
  readonly sendJson: (res: ServerResponse, status: number, body: unknown, cookie?: string) => void
  readonly clearSessionCookie: (cookieDomain?: string) => string
}

type AccountRoute<Visit> = {
  readonly method: "POST"
  readonly path: string
  readonly serve: (visit: Visit) => Promise<void>
}

function jsonBody(req: IncomingMessage): boolean {
  return req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() === "application/json"
}

async function deleteAccount<Visit extends AccountVisit>(http: AccountHttp<Visit>, visit: Visit): Promise<void> {
  const { options, logs, req, res } = visit
  const email = await http.signedIn(visit)
  if (email === undefined) return
  const body = await visit.body()
  if (body === undefined) {
    http.answerSize(res)
    return
  }
  const confirmed = readEmail(http.parsedJson(body))
  if (!jsonBody(req) || !confirmed.ok || confirmed.email !== email) {
    http.sendJson(res, 400, { ok: false, refusal: "field" })
    return
  }
  await options.session.query("select session.delete_account($1)", [email])
  logs.delete(email)
  options.turns.delete(email)
  await drainOriginals(options.deck, options.originals, { owner: email })
  http.sendJson(res, 200, { ok: true }, http.clearSessionCookie(options.cookieDomain))
}

async function signOut<Visit extends AccountVisit>(http: AccountHttp<Visit>, visit: Visit): Promise<void> {
  const { options, req, res } = visit
  if ((await visit.body()) === undefined) {
    http.answerSize(res)
    return
  }
  const token = readSessionCookie(req.headers.cookie)
  if (token !== undefined) await deleteAccess(options.session, token)
  http.sendJson(res, 200, { ok: true }, http.clearSessionCookie(options.cookieDomain))
}

export function accountRouteList<Visit extends AccountVisit>(http: AccountHttp<Visit>): readonly AccountRoute<Visit>[] {
  return [
    { method: "POST", path: accountRoutes.delete.path, serve: (visit) => deleteAccount(http, visit) },
    { method: "POST", path: signOutRoutes.session.path, serve: (visit) => signOut(http, visit) },
  ]
}
