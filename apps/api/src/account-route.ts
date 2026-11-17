import type { IncomingMessage, ServerResponse } from "node:http"

import {
  accountRoutes,
  readAccountName,
  readEmail,
  readGrantId,
  readNoFields,
  readSessionCookie,
  signOutRoutes,
} from "@airdesign/catalog"

import { deleteAccess } from "./account.js"
import { screenFor } from "./clients.js"
import { advance, readApproval } from "./grants.js"
import { drainOriginals } from "./original.js"
import type { OriginalStore } from "./original-store.js"
import type { Sql } from "./pool.js"
import { readUrl } from "./resource.js"

export type AccountVisit = {
  readonly options: {
    readonly session: Sql
    readonly deck: Sql
    readonly originals?: OriginalStore
    readonly cookieDomain?: string
    readonly resource: string
  }
  readonly req: IncomingMessage
  readonly res: ServerResponse
  readonly body: () => Promise<Buffer | undefined>
}

export type AccountHttp<Visit extends AccountVisit> = {
  readonly signedIn: (visit: Visit) => Promise<string | undefined>
  readonly answerSize: (res: ServerResponse) => void
  readonly parsedJson: (body: Buffer) => unknown
  readonly sendJson: (res: ServerResponse, status: number, body: unknown, cookie?: string | readonly string[]) => void
  readonly clearSessionCookie: (cookieDomain?: string) => readonly string[]
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
  const { options, req, res } = visit
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
  await drainOriginals(options.deck, options.originals, { owner: email })
  http.sendJson(res, 200, { ok: true }, http.clearSessionCookie(options.cookieDomain))
}

type ConnectedGrantRow = {
  id: string
  name: string | null
  redirect_uri: string
  connected: Date
}

const connectedGrantsSql = `
select g.id, c.name, g.redirect_uri, g.connected
from session.oauth_grant g
join session.oauth_client c on c.id = g.client_id
where g.principal = $1 and g.code = 'used' and not g.revoked
order by g.connected desc, g.id desc
`

export async function sessionBody<Visit extends AccountVisit>(
  http: AccountHttp<Visit>,
  visit: Visit,
): Promise<{ readonly email: string; readonly body: Buffer } | undefined> {
  const { req, res } = visit
  if (req.headers.authorization !== undefined) {
    if ((await visit.body()) === undefined) {
      http.answerSize(res)
      return undefined
    }
    http.sendJson(res, 401, { ok: false, refusal: "session" })
    return undefined
  }
  const email = await http.signedIn(visit)
  if (email === undefined) return undefined
  const body = await visit.body()
  if (body === undefined) {
    http.answerSize(res)
    return undefined
  }
  return { email, body }
}

async function profile<Visit extends AccountVisit>(
  http: AccountHttp<Visit>,
  visit: Visit,
  save: boolean,
): Promise<void> {
  const session = await sessionBody(http, visit)
  if (session === undefined) return
  const raw = http.parsedJson(session.body)
  const parsed = save ? readAccountName(raw) : readNoFields(raw)
  if (!jsonBody(visit.req) || !parsed.ok) {
    http.sendJson(visit.res, 400, { ok: false, refusal: "field" })
    return
  }
  const result =
    "name" in parsed
      ? await visit.options.session.query<{ email: string; name: string | null }>(
          "update session.account set name = $2 where email = $1 returning email, name",
          [session.email, parsed.name],
        )
      : await visit.options.session.query<{ email: string; name: string | null }>(
          "select email, name from session.account where email = $1",
          [session.email],
        )
  http.sendJson(visit.res, 200, { ok: true, account: result.rows[0] })
}

async function listAgents<Visit extends AccountVisit>(http: AccountHttp<Visit>, visit: Visit): Promise<void> {
  const { options, req, res } = visit
  const session = await sessionBody(http, visit)
  if (session === undefined) return
  if (!jsonBody(req) || !readNoFields(http.parsedJson(session.body)).ok) {
    http.sendJson(res, 400, { ok: false, refusal: "field" })
    return
  }
  const result = await options.session.query<ConnectedGrantRow>(connectedGrantsSql, [session.email])
  http.sendJson(res, 200, {
    ok: true,
    account: { email: session.email },
    mcp: options.resource,
    agents: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      agent: screenFor(row.name, row.redirect_uri),
      host: readUrl(row.redirect_uri)?.host ?? "",
      connected: row.connected.toISOString(),
    })),
  })
}

async function revokeAgent<Visit extends AccountVisit>(http: AccountHttp<Visit>, visit: Visit): Promise<void> {
  const { options, req, res } = visit
  const session = await sessionBody(http, visit)
  if (session === undefined) return
  const parsed = readGrantId(http.parsedJson(session.body))
  if (!jsonBody(req) || !parsed.ok) {
    http.sendJson(res, 400, { ok: false, refusal: "field" })
    return
  }
  const stored = await readApproval(options.session, parsed.id)
  if (stored === undefined || stored.grant.principal !== session.email) {
    http.sendJson(res, 403, { ok: false, refusal: "owner" })
    return
  }
  if (stored.grant.revoked) {
    http.sendJson(res, 200, { ok: true })
    return
  }
  const advanced = await advance(options.session, parsed.id, { command: "revoke" }, { issue: false })
  if (advanced?.lost === true) {
    http.sendJson(res, 503, { ok: false, refusal: "server" })
    return
  }
  http.sendJson(res, 200, { ok: true })
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
    { method: "POST", path: accountRoutes.profile.path, serve: (visit) => profile(http, visit, false) },
    { method: "POST", path: accountRoutes.name.path, serve: (visit) => profile(http, visit, true) },
    { method: "POST", path: accountRoutes.delete.path, serve: (visit) => deleteAccount(http, visit) },
    { method: "POST", path: accountRoutes.agents.path, serve: (visit) => listAgents(http, visit) },
    { method: "POST", path: accountRoutes.revokeAgent.path, serve: (visit) => revokeAgent(http, visit) },
    { method: "POST", path: signOutRoutes.session.path, serve: (visit) => signOut(http, visit) },
  ]
}
