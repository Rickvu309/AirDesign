import { fontRouteList } from "./font-route.js"
import { randomUUID } from "node:crypto"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { bytesOf, limits } from "@airdesign/document"

import {
  signInRoutes,
  readApprovalRequest,
  oauthRoutes,
  mcpRoutes,
  readBearer,
  readClientRequest,
  readCode,
  readEmail,
  readHost,
  readLinkToken,
  readRevokeRequest,
  readAccountCookie,
  readSessionCookie,
  readTokenRequest,
  type FormPairs,
} from "@airdesign/catalog"
import { acceptCode, acceptLink, findAccess, issueMail, openSmokeSession } from "./account.js"
import { agentKey } from "./agent-key.js"
import { accountRouteList } from "./account-route.js"
import { accountCookie, clearSessionCookie, keptSeconds, signedInCookies } from "./session-cookie.js"
import { type AiraSettings } from "./aira.js"
import { Closing } from "./aira-closing.js"
import { airaRouteList } from "./aira-route.js"
import { creditsRouteList } from "./credits-route.js"
import { airaUsageRoute } from "./aira-usage-route.js"
import { deckListAnswers } from "./deck-list.js"
import { readRegistration, registerClient } from "./clients.js"
import { approve, describeClient } from "./consent.js"
import { DeckFindings } from "./deck-findings.js"
import { DeckPictures } from "./deck-pictures.js"
import { DeckFollowers } from "./deck-followers.js"
import { findingsRoute } from "./findings-route.js"
import { deckWatchRoute } from "./deck-watch.js"
import { DeckListen } from "./listen.js"
import { answeredDeckRoutes, type DeckAnswers } from "./deck-answer.js"
import type { Sender } from "./mail.js"
import { nodeNet, type ImageNet } from "./image-fetch.js"
import { serveMcp } from "./mcp.js"
import type { Sql } from "./pool.js"
import { mediaAnswers } from "./media.js"
import { originalAnswers } from "./original.js"
import type { OriginalStore } from "./original-store.js"
import { sameSecret } from "./secrets.js"
import { checkedResource, readUrl } from "./resource.js"
import { requireDomain, requireOrigin } from "./start-origins.js"
import { authorizationMetadata, resourceChallenge, resourceMetadata } from "./discovery.js"
import { savedAnswers } from "./saved.js"
import { sceneRouteList } from "./scene-route.js"
import { bearerPrincipal, revokeToken, tokenAnswer } from "./tokens.js"
import { undoAnswers } from "./undo.js"

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
  readonly resource: string
  readonly commit?: string
  readonly smokeToken?: string
  readonly originals?: OriginalStore
  readonly imageNet?: ImageNet
  readonly aira?: AiraSettings
  readonly closing?: Closing
  readonly forwardSecret?: string
  readonly measureLimit?: number
}

const measureLimit = 5_000

type ServedOptions = ApiOptions & {
  readonly closing: Closing
  readonly followers: DeckFollowers
  readonly findings: DeckFindings
  readonly pictures: DeckPictures
}

type Context = {
  readonly options: ServedOptions
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
const localBase = "http://127.0.0.1"
const unreadTarget = "The request target could not be read."
const unservedMethod = "This address does not answer that method."
const unreadHost = "The request host could not be read."
const mcpMethods = ["GET", "POST", "DELETE"]
const localHosts = ["localhost", "127.0.0.1", "[::1]"]

type Cookie = string | readonly string[]

function sendJson(res: ServerResponse, status: number, body: unknown, cookie?: Cookie): void {
  if (res.writableEnded || res.destroyed) return
  const payload = JSON.stringify(body)
  if (cookie !== undefined) res.setHeader("set-cookie", cookie)
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": bytesOf(payload),
  })
  res.end(payload)
}

function redirect(res: ServerResponse, location: string, cookie?: Cookie): void {
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
  const access = token === undefined ? undefined : await findAccess(options.session, token)
  if (access !== undefined) {
    if (readAccountCookie(req.headers.cookie) !== access.device)
      res.setHeader("set-cookie", accountCookie(access.device, keptSeconds, options.cookieDomain))
    return access.email
  }
  await body()
  sendJson(res, 401, { ok: false, refusal: "session" }, accountCookie("", 0, options.cookieDomain))
  return undefined
}

async function caller(visit: Visit): Promise<{ readonly email: string; readonly agentKey: string } | undefined> {
  const { options, now, req, res } = visit
  const authorization = req.headers.authorization
  if (authorization === undefined) {
    res.setHeader("www-authenticate", resourceChallenge(options))
    const email = await signedIn(visit)
    return email === undefined ? undefined : { email, agentKey: agentKey("aira", email) }
  }
  const secret = readBearer(authorization)
  const bearer = secret === undefined ? undefined : await bearerPrincipal(options.session, secret, now())
  if (bearer?.ok === true) return { email: bearer.principal, agentKey: agentKey("grant", bearer.grant) }
  await visit.body()
  res.setHeader("www-authenticate", resourceChallenge(options, "invalid_token"))
  sendJson(res, 401, { error: "invalid_token" })
  return undefined
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
  sendJson(res, 200, { ok: true }, await signedInCookies(options.session, options.cookieDomain, session))
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
  sendJson(res, 200, { ok: true }, await signedInCookies(options.session, options.cookieDomain, token))
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
  redirect(res, "/", await signedInCookies(options.session, options.cookieDomain, session))
}

function deckRoute<Read extends Reader>(
  read: Read,
  answer: (
    db: Sql,
    parsed: Accepted<Read>,
    email: string,
    store: OriginalStore | undefined,
    mint: () => string,
  ) => Promise<unknown>,
): Serve {
  return async (visit) => {
    const email = await signedIn(visit)
    if (email === undefined) return
    const parsed = await readJson(visit, read)
    if (parsed === undefined) return
    sendJson(
      visit.res,
      200,
      accepted(parsed) ? await answer(visit.options.deck, parsed, email, visit.options.originals, visit.mint) : parsed,
    )
  }
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
  const { options, now, mint, req, res, name } = visit
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
  const called = await caller(visit)
  if (called === undefined) return
  const body = await visit.body()
  if (body === undefined) {
    answerSize(res)
    return
  }
  await serveMcp(
    {
      deck: options.deck,
      session: options.session,
      email: called.email,
      agentKey: called.agentKey,
      now,
      mint: () => `${called.agentKey}-${mint()}`,
      hosts: options.hosts ?? localHosts,
      bodyCap: limits.body,
      fail: (error) => answerThrow(visit, name, error),
      measures: {
        listen: options.listen,
        following: (deck) => options.followers.following(deck),
        limit: options.measureLimit ?? measureLimit,
        findings: options.findings,
        pictures: options.pictures,
      },
      originals: options.originals,
      images: { store: options.originals, net: options.imageNet ?? nodeNet },
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

async function resourceMetadataRoute({ options, res }: Visit): Promise<void> {
  sendJson(res, 200, resourceMetadata(options))
}

async function authorizationMetadataRoute({ options, res }: Visit): Promise<void> {
  sendJson(res, 200, authorizationMetadata(options))
}

export const deckAnswers: DeckAnswers = {
  ...savedAnswers,
  ...deckListAnswers,
  ...originalAnswers,
  ...mediaAnswers,
  ...undoAnswers,
}

const deckHttp = { signedIn, answerSize, parsedJson, sendJson, gone }

export const routes: readonly Route[] = [
  ...fontRouteList,
  { method: "GET", path: mcpRoutes.resourceMetadata.path, serve: resourceMetadataRoute },
  { method: "GET", path: mcpRoutes.authorizationMetadata.path, serve: authorizationMetadataRoute },
  { method: "GET", path: "/health", serve: healthRoute },
  { method: "GET", path: "/version", serve: versionRoute },
  { method: "POST", path: "/smoke/session", serve: smokeRoute },
  { method: "any", path: mcpRoutes.mcp.path, serve: mcpRoute },
  ...airaRouteList({ signedIn, answerSize, parsedJson, sendJson }),
  airaUsageRoute({ signedIn, answerSize, parsedJson, sendJson, clearSessionCookie }),
  ...creditsRouteList({ signedIn, answerSize, parsedJson, sendJson, clearSessionCookie }),
  { method: "POST", path: oauthRoutes.register.path, serve: registerRoute },
  { method: "POST", path: oauthRoutes.client.path, serve: clientRoute },
  { method: "POST", path: oauthRoutes.approve.path, serve: approveRoute },
  { method: "POST", path: oauthRoutes.token.path, serve: tokenRoute, cap: limits.form },
  { method: "POST", path: oauthRoutes.revoke.path, serve: revokeRoute, cap: limits.form },
  { method: "POST", path: signInRoutes.email.path, serve: emailRoute },
  { method: "POST", path: signInRoutes.code.path, serve: codeRoute },
  { method: "GET", path: signInRoutes.link.path, serve: linkRoute },
  ...answeredDeckRoutes(deckAnswers, deckRoute),
  deckWatchRoute(deckHttp),
  findingsRoute({ signedIn, answerSize, parsedJson, sendJson }),
  ...sceneRouteList(deckHttp),
  ...accountRouteList({ signedIn, answerSize, parsedJson, sendJson, clearSessionCookie }),
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
    const body = bodyOnce(req, route?.cap ?? limits.body)
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

export function createApi(given: ApiOptions): Server {
  const options: ServedOptions = {
    ...given,
    closing: given.closing ?? new Closing({ db: given.session, listen: given.listen }),
    followers: new DeckFollowers(given.now ?? Date.now),
    findings: new DeckFindings(),
    pictures: new DeckPictures(),
  }
  requireOrigin("publicOrigin", options.publicOrigin)
  requireOrigin("siteOrigin", options.siteOrigin)
  requireDomain(options.cookieDomain)
  checkedResource(options.resource)
  const now = options.now ?? Date.now
  const mint = options.mint ?? randomUUID
  void options.listen.open().catch(() => undefined)
  return createServer((req, res) => {
    void handle({ options, now, mint, req, res })
  })
}
