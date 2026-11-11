import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"

import {
  readApprovalRequest,
  readBearer,
  readCapture,
  readClientRequest,
  readCode,
  readCommit,
  readDecks,
  readEmail,
  readHost,
  readLinkToken,
  readNoFields,
  readRename,
  readRevokeRequest,
  readSessionCookie,
  readTokenRequest,
  readWatch,
  sessionCookieName,
  type DeckId,
  type FormPairs,
} from "@airdesign/catalog"
import type { CallerLog } from "@airdesign/mcp"

import { acceptCode, acceptLink, findAccess, issueMail, openSmokeSession } from "./account.js"
import { deleteDecks, listDecks, renameDeck, restoreDeck, trashDeck } from "./deck-list.js"
import { readRegistration, registerClient } from "./clients.js"
import { approve, describeClient } from "./consent.js"
import { DeckListen } from "./listen.js"
import type { Sender } from "./mail.js"
import { serveMcp } from "./mcp.js"
import type { Sql } from "./pool.js"
import { checkedResource, readUrl } from "./resource.js"
import { chosenRevision, commitEdits, openSaved, readSaved } from "./saved.js"
import { bearerPrincipal, revokeToken, tokenAnswer } from "./tokens.js"

export type ApiOptions = {
  readonly session: Sql
  readonly deck: Sql
  readonly listen: DeckListen
  readonly send: Sender
  readonly publicOrigin: string
  readonly siteOrigin: string
  readonly cookieDomain?: string
  readonly now?: () => number
  readonly mint?: () => string
  readonly hosts?: readonly string[]
  readonly logs?: Map<string, CallerLog>
  readonly resource: string
  readonly commit?: string
  readonly smokeToken?: string
}

type Context = {
  readonly options: ApiOptions
  readonly logs: Map<string, CallerLog>
  readonly now: () => number
  readonly mint: () => string
  readonly req: IncomingMessage
  readonly res: ServerResponse
}

type Visit = Context & {
  readonly name: string
  readonly query: URLSearchParams
  readonly body: () => Promise<Buffer | undefined>
}

type Serve = (visit: Visit) => Promise<void>

export type Route = {
  readonly method: "GET" | "POST" | "any"
  readonly path: string
  readonly serve: Serve
  readonly cap?: number
}

export const smokeEmail = "smoke@airdesign.app"
export const bodyCap = 1_000_000
export const formCap = 16_384
const localBase = "http://127.0.0.1"
const unreadTarget = "The request target could not be read."
const unservedMethod = "This address does not answer that method."
const unreadHost = "The request host could not be read."
const mcpMethods = ["GET", "POST", "DELETE"]
const localHosts = ["localhost", "127.0.0.1", "[::1]"]

const plainHost = /^[A-Za-z0-9.-]+$/

export function requireOrigin(name: string, value: string): void {
  const parsed = readUrl(value)
  if (parsed?.protocol !== "https:" || parsed.origin !== value) {
    throw new Error(`${name} is not an https origin`)
  }
}

export function requireDomain(cookieDomain: string | undefined): void {
  if (cookieDomain === undefined) return
  if (!plainHost.test(cookieDomain)) throw new Error("cookieDomain is not a plain host name")
}

export function sessionCookie(token: string, cookieDomain?: string): string {
  const cookie = `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
  if (cookieDomain === undefined) return cookie
  return `${cookie}; Domain=${cookieDomain}`
}

function sendJson(res: ServerResponse, status: number, body: unknown, cookie?: string): void {
  if (res.writableEnded || res.destroyed) return
  const payload = JSON.stringify(body)
  if (cookie !== undefined) res.setHeader("set-cookie", cookie)
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  })
  res.end(payload)
}

function redirect(res: ServerResponse, location: string, cookie?: string): void {
  if (res.writableEnded || res.destroyed) return
  if (cookie !== undefined) res.setHeader("set-cookie", cookie)
  res.writeHead(302, { location })
  res.end()
}

async function readBody(req: IncomingMessage, cap: number): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size <= cap) chunks.push(buffer)
  }
  return size > cap ? undefined : Buffer.concat(chunks)
}

function bodyOnce(req: IncomingMessage, cap: number): () => Promise<Buffer | undefined> {
  let read: Promise<Buffer | undefined> | undefined
  return () => (read ??= readBody(req, cap))
}

function parsedJson(body: Buffer): unknown {
  if (body.length === 0) return undefined
  try {
    return JSON.parse(body.toString("utf8")) as unknown
  } catch {
    return undefined
  }
}

function answerSize(res: ServerResponse): void {
  res.setHeader("connection", "close")
  sendJson(res, 413, { ok: false, refusal: "size" })
}

type Reader = (raw: unknown) => { readonly ok: boolean }
type Accepted<Read extends Reader> = Extract<ReturnType<Read>, { readonly ok: true }>

function accepted<Value extends { readonly ok: boolean }>(
  value: Value,
): value is Extract<Value, { readonly ok: true }> {
  return value.ok
}

async function readJson<Read extends Reader>(visit: Visit, read: Read): Promise<ReturnType<Read> | undefined> {
  const body = await visit.body()
  if (body === undefined) {
    answerSize(visit.res)
    return undefined
  }
  return read(parsedJson(body)) as ReturnType<Read>
}

async function readForm<Parsed>(
  visit: Visit,
  read: (contentType: unknown, pairs: FormPairs) => Parsed,
): Promise<Parsed | undefined> {
  const body = await visit.body()
  if (body === undefined) {
    answerSize(visit.res)
    return undefined
  }
  return read(visit.req.headers["content-type"], new URLSearchParams(body.toString("utf8")))
}

function readTarget(raw: string | undefined): URL | undefined {
  if (raw === undefined || !raw.startsWith("/")) return undefined
  const target = readUrl(raw, localBase)
  return target?.origin === localBase ? target : undefined
}

function gone(res: ServerResponse): AbortSignal {
  const controller = new AbortController()
  res.on("close", () => {
    if (!res.writableEnded) controller.abort()
  })
  return controller.signal
}

async function signedIn({ options, req, res, body }: Visit): Promise<string | undefined> {
  const token = readSessionCookie(req.headers.cookie)
  const email = token === undefined ? undefined : await findAccess(options.session, token)
  if (email !== undefined) return email
  await body()
  sendJson(res, 401, { ok: false, refusal: "session" })
  return undefined
}

async function caller(visit: Visit): Promise<string | undefined> {
  const { options, now, req, res } = visit
  const authorization = req.headers.authorization
  if (authorization === undefined) return signedIn(visit)
  const secret = readBearer(authorization)
  const bearer = secret === undefined ? undefined : await bearerPrincipal(options.session, secret, now())
  if (bearer?.ok === true) return bearer.principal
  await visit.body()
  res.setHeader("www-authenticate", 'Bearer error="invalid_token"')
  sendJson(res, 401, { error: "invalid_token" })
  return undefined
}

async function hold(
  options: ApiOptions,
  deck: DeckId,
  cursor: number | null,
  email: string,
  signal: AbortSignal,
): Promise<number | "owner" | undefined> {
  for (;;) {
    if (signal.aborted) return undefined
    await options.listen.ready()
    if (signal.aborted) return undefined
    const saved = await readSaved(options.deck, deck)
    if (saved !== undefined && saved.owner !== email) return "owner"
    const revision = chosenRevision(cursor, saved?.revision)
    if (revision !== undefined) return revision
    await options.listen.wait(signal)
  }
}

function sameSecret(given: string, expected: string): boolean {
  const left = createHash("sha256").update(given).digest()
  const right = createHash("sha256").update(expected).digest()
  return timingSafeEqual(left, right)
}

function notFound(res: ServerResponse): void {
  res.writeHead(404)
  res.end()
}

async function smokeRoute({ options, req, res, body }: Visit): Promise<void> {
  await body()
  const given = readBearer(req.headers.authorization)
  if (options.smokeToken === undefined || given === undefined || !sameSecret(given, options.smokeToken)) {
    notFound(res)
    return
  }
  const session = await openSmokeSession(options.session, smokeEmail)
  sendJson(res, 200, { ok: true }, sessionCookie(session, options.cookieDomain))
}

async function emailRoute(visit: Visit): Promise<void> {
  const parsed = await readJson(visit, readEmail)
  if (parsed === undefined) return
  if (!parsed.ok) {
    sendJson(visit.res, 400, parsed)
    return
  }
  await issueMail(visit.options.session, parsed.email, visit.options.publicOrigin, visit.options.send)
  sendJson(visit.res, 202, { ok: true })
}

async function codeRoute(visit: Visit): Promise<void> {
  const { options, res } = visit
  const parsed = await readJson(visit, readCode)
  if (parsed === undefined) return
  if (!parsed.ok) {
    sendJson(res, 400, parsed)
    return
  }
  const token = await acceptCode(options.session, parsed.email, parsed.code)
  if (token === undefined) {
    sendJson(res, 401, { ok: false, refusal: "code" })
    return
  }
  sendJson(res, 200, { ok: true }, sessionCookie(token, options.cookieDomain))
}

async function linkRoute({ options, query, res }: Visit): Promise<void> {
  const token = readLinkToken(query.get("token"))
  const expired = `${options.siteOrigin}/sign-in/expired`
  if (token === undefined) {
    redirect(res, expired)
    return
  }
  const session = await acceptLink(options.session, token)
  if (session === undefined) {
    redirect(res, expired)
    return
  }
  redirect(res, "/", sessionCookie(session, options.cookieDomain))
}

function deckRoute<Read extends Reader>(
  read: Read,
  answer: (db: Sql, parsed: Accepted<Read>, email: string) => Promise<unknown>,
): Serve {
  return async (visit) => {
    const email = await signedIn(visit)
    if (email === undefined) return
    const parsed = await readJson(visit, read)
    if (parsed === undefined) return
    sendJson(visit.res, 200, accepted(parsed) ? await answer(visit.options.deck, parsed, email) : parsed)
  }
}

async function watchRoute(visit: Visit): Promise<void> {
  const { options, res } = visit
  const email = await signedIn(visit)
  if (email === undefined) return
  const parsed = await readJson(visit, readWatch)
  if (parsed === undefined) return
  if (!parsed.ok) {
    sendJson(res, 200, parsed)
    return
  }
  const signal = gone(res)
  const revision = await hold(options, parsed.deck, parsed.cursor, email, signal)
  if (revision === undefined || signal.aborted || res.writableEnded || res.destroyed) return
  if (revision === "owner") {
    sendJson(res, 200, { ok: false, refusal: "owner" })
    return
  }
  sendJson(res, 200, { ok: true, deck: parsed.deck, revision })
}

async function registerRoute(visit: Visit): Promise<void> {
  const parsed = await readJson(visit, readRegistration)
  if (parsed === undefined) return
  if (!parsed.ok) {
    sendJson(visit.res, 400, { error: parsed.refusal })
    return
  }
  const answer = await registerClient(visit.options.session, parsed)
  sendJson(visit.res, answer.status, answer.body)
}

async function clientRoute(visit: Visit): Promise<void> {
  const { options, res } = visit
  const email = await signedIn(visit)
  if (email === undefined) return
  const parsed = await readJson(visit, readClientRequest)
  if (parsed === undefined) return
  if (!parsed.ok) {
    sendJson(res, 400, parsed)
    return
  }
  const answer = await describeClient(options.session, parsed, options.resource)
  sendJson(res, answer.status, answer.body)
}

async function approveRoute(visit: Visit): Promise<void> {
  const { options, now, res } = visit
  const email = await signedIn(visit)
  if (email === undefined) return
  const parsed = await readJson(visit, readApprovalRequest)
  if (parsed === undefined) return
  if (!parsed.ok) {
    sendJson(res, 400, parsed)
    return
  }
  const answer = await approve(options.session, parsed, email, options.resource, now())
  sendJson(res, answer.status, answer.body)
}

async function tokenRoute(visit: Visit): Promise<void> {
  const { options, now, res } = visit
  res.setHeader("cache-control", "no-store")
  const parsed = await readForm(visit, readTokenRequest)
  if (parsed === undefined) return
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.refusal })
    return
  }
  const answer = await tokenAnswer({ db: options.session, own: options.resource, now: now() }, parsed)
  sendJson(res, answer.status, answer.body)
}

async function revokeRoute(visit: Visit): Promise<void> {
  const { options, res } = visit
  res.setHeader("cache-control", "no-store")
  const parsed = await readForm(visit, readRevokeRequest)
  if (parsed === undefined) return
  const answer = await revokeToken(options.session, parsed.ok ? parsed.token : undefined)
  sendJson(res, answer.status, answer.body)
}

async function mcpRoute(visit: Visit): Promise<void> {
  const { options, logs, now, mint, req, res, name } = visit
  if (!mcpMethods.includes(req.method ?? "")) {
    await visit.body()
    res.setHeader("allow", mcpMethods.join(", "))
    sendJson(res, 405, { ok: false, refusal: unservedMethod })
    return
  }
  if (readHost(req.headers.host) === undefined) {
    await visit.body()
    sendJson(res, 400, { ok: false, refusal: unreadHost })
    return
  }
  const email = await caller(visit)
  if (email === undefined) return
  const body = await visit.body()
  if (body === undefined) {
    answerSize(res)
    return
  }
  await serveMcp(
    {
      deck: options.deck,
      email,
      logs,
      now,
      mint,
      hosts: options.hosts ?? localHosts,
      bodyCap,
      fail: (error) => answerThrow(visit, name, error),
    },
    req,
    res,
    body,
  )
}

async function healthRoute({ res }: Visit): Promise<void> {
  sendJson(res, 200, { ok: true })
}

async function versionRoute({ options, res }: Visit): Promise<void> {
  sendJson(res, 200, { commit: options.commit ?? "unknown" })
}

export const routes: readonly Route[] = [
  { method: "GET", path: "/health", serve: healthRoute },
  { method: "GET", path: "/version", serve: versionRoute },
  { method: "POST", path: "/smoke/session", serve: smokeRoute },
  { method: "any", path: "/mcp", serve: mcpRoute },
  { method: "POST", path: "/oauth/register", serve: registerRoute },
  { method: "POST", path: "/oauth/client", serve: clientRoute },
  { method: "POST", path: "/oauth/approve", serve: approveRoute },
  { method: "POST", path: "/oauth/token", serve: tokenRoute, cap: formCap },
  { method: "POST", path: "/oauth/revoke", serve: revokeRoute, cap: formCap },
  { method: "POST", path: "/sign-in/email", serve: emailRoute },
  { method: "POST", path: "/sign-in/code", serve: codeRoute },
  { method: "GET", path: "/sign-in/link", serve: linkRoute },
  { method: "POST", path: "/decks/open", serve: deckRoute(readCapture, openSaved) },
  { method: "POST", path: "/decks/commit", serve: deckRoute(readCommit, commitEdits) },
  { method: "POST", path: "/decks/watch", serve: watchRoute },
  { method: "POST", path: "/decks/list", serve: deckRoute(readNoFields, (db, _, email) => listDecks(db, email)) },
  { method: "POST", path: "/decks/rename", serve: deckRoute(readRename, renameDeck) },
  { method: "POST", path: "/decks/trash", serve: deckRoute(readCapture, trashDeck) },
  { method: "POST", path: "/decks/restore", serve: deckRoute(readCapture, restoreDeck) },
  { method: "POST", path: "/decks/delete", serve: deckRoute(readDecks, deleteDecks) },
]

function causedByInput(error: unknown): boolean {
  if (error instanceof URIError) return true
  const code = failureCode(error)
  return code === "ERR_INVALID_URL" || /^22[0-9A-Z]{3}$/.test(code)
}

function failureCode(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) return "none"
  return typeof error.code === "string" ? error.code : "none"
}

function answerThrow({ req, res }: Context, name: string, error: unknown): void {
  if (req.errored !== null) return
  if (causedByInput(error) && !res.headersSent) {
    sendJson(res, 400, { ok: false, refusal: "The request could not be read." })
    return
  }
  const kind = error instanceof Error ? error.name : "unknown"
  process.stderr.write(`api ${name} failed: ${kind} ${failureCode(error)}\n`)
  if (res.headersSent) {
    res.destroy()
    return
  }
  sendJson(res, 500, { ok: false, refusal: "server" })
}

function answerNoRoute(res: ServerResponse, url: URL | undefined): void {
  if (url === undefined) sendJson(res, 400, { ok: false, refusal: unreadTarget })
  else notFound(res)
}

async function handle(context: Context): Promise<void> {
  const { req, res } = context
  let name = "request"
  try {
    const url = readTarget(req.url)
    const route = routes.find(
      (candidate) =>
        candidate.path === url?.pathname && (candidate.method === "any" || candidate.method === req.method),
    )
    const body = bodyOnce(req, route?.cap ?? bodyCap)
    if (url === undefined || route === undefined) {
      await body()
      answerNoRoute(res, url)
      return
    }
    name = `${route.method} ${route.path}`
    await route.serve({ ...context, name, query: url.searchParams, body })
  } catch (error) {
    answerThrow(context, name, error)
  }
}

export function createApi(options: ApiOptions): Server {
  requireOrigin("publicOrigin", options.publicOrigin)
  requireOrigin("siteOrigin", options.siteOrigin)
  requireDomain(options.cookieDomain)
  checkedResource(options.resource)
  const logs = options.logs ?? new Map<string, CallerLog>()
  const now = options.now ?? Date.now
  const mint = options.mint ?? randomUUID
  void options.listen.open().catch(() => undefined)
  return createServer((req, res) => {
    void handle({ options, logs, now, mint, req, res })
  })
}
