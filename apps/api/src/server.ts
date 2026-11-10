import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"

import { readWatch, type DeckId } from "@airdesign/catalog"
import type { CallerLog } from "@airdesign/mcp"

import { acceptCode, acceptLink, findAccess, issueMail, openSmokeSession, readCode, readEmail } from "./account.js"
import { deleteDecks, listDecks, renameDeck, restoreDeck, trashDeck } from "./deck-list.js"
import type { Answer } from "./answer.js"
import { registerClient } from "./clients.js"
import { approve, describeClient } from "./consent.js"
import { DeckListen } from "./listen.js"
import type { Sender } from "./mail.js"
import { serveMcp } from "./mcp.js"
import type { Sql } from "./pool.js"
import { checkedResource } from "./resource.js"
import { chosenRevision, commitEdits, openSaved, readSaved } from "./saved.js"
import { bearerPrincipal, readForm, revokeToken, tokenAnswer } from "./tokens.js"

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

export const smokeEmail = "smoke@airdesign.app"
const smokeBearer = /^Bearer (.+)$/
const cookieName = "airdesign.session"
export const bodyCap = 1_000_000
const localHosts = ["localhost", "127.0.0.1", "[::1]"]

const plainHost = /^[A-Za-z0-9.-]+$/

export function requireOrigin(name: string, value: string): void {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${name} is not an https origin`)
  }
  if (parsed.protocol !== "https:" || parsed.origin !== value) {
    throw new Error(`${name} is not an https origin`)
  }
}

export function requireDomain(cookieDomain: string | undefined): void {
  if (cookieDomain === undefined) return
  if (!plainHost.test(cookieDomain)) throw new Error("cookieDomain is not a plain host name")
}

export function sessionCookie(token: string, cookieDomain?: string): string {
  const cookie = `${cookieName}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
  if (cookieDomain === undefined) return cookie
  return `${cookie}; Domain=${cookieDomain}`
}

function decodedToken(raw: string): string | undefined {
  try {
    const token = decodeURIComponent(raw)
    return token.includes("\0") ? undefined : token
  } catch {
    return undefined
  }
}

export function readSessionCookie(header: string | undefined): string | undefined {
  if (header === undefined) return undefined
  for (const part of header.split(";")) {
    const trimmed = part.trim()
    const split = trimmed.indexOf("=")
    if (split <= 0) continue
    if (trimmed.slice(0, split) !== cookieName) continue
    return decodedToken(trimmed.slice(split + 1))
  }
  return undefined
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

function cookieHeader(req: IncomingMessage): string | undefined {
  const header = req.headers.cookie
  return typeof header === "string" ? header : undefined
}

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > bodyCap) return undefined
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const body = await readBody(req)
  if (body === undefined || body.length === 0) return undefined
  try {
    return JSON.parse(body.toString("utf8")) as unknown
  } catch {
    return undefined
  }
}

async function readFormBody(req: IncomingMessage): Promise<Map<string, string> | undefined> {
  return readForm(req.headers["content-type"], await readBody(req))
}

function gone(res: ServerResponse): AbortSignal {
  const controller = new AbortController()
  res.on("close", () => {
    if (!res.writableEnded) controller.abort()
  })
  return controller.signal
}

async function signedIn(options: ApiOptions, req: IncomingMessage, res: ServerResponse): Promise<string | undefined> {
  const token = readSessionCookie(cookieHeader(req))
  if (token === undefined || token.length === 0) {
    sendJson(res, 401, { ok: false, refusal: "session" })
    return undefined
  }
  const email = await findAccess(options.session, token)
  if (email === undefined) {
    sendJson(res, 401, { ok: false, refusal: "session" })
    return undefined
  }
  return email
}

const bearerPattern = /^Bearer ([A-Za-z0-9._~+/=-]+)$/i

async function caller(
  options: ApiOptions,
  now: () => number,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<string | undefined> {
  const authorization = req.headers.authorization
  if (authorization === undefined) return signedIn(options, req, res)
  const secret = bearerPattern.exec(authorization)?.[1]
  const bearer = secret === undefined ? undefined : await bearerPrincipal(options.session, secret, now())
  if (bearer?.ok === true) return bearer.principal
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

async function smokeRoute(
  options: ApiOptions,
  token: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const given = smokeBearer.exec(req.headers.authorization ?? "")?.[1]
  if (given === undefined || !sameSecret(given, token)) {
    res.writeHead(404)
    res.end()
    return
  }
  const session = await openSmokeSession(options.session, smokeEmail)
  sendJson(res, 200, { ok: true }, sessionCookie(session, options.cookieDomain))
}

async function emailRoute(options: ApiOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const parsed = readEmail(await readJson(req))
  if (!parsed.ok) {
    sendJson(res, 400, parsed)
    return
  }
  await issueMail(options.session, parsed.email, options.publicOrigin, options.send)
  sendJson(res, 202, { ok: true })
}

async function codeRoute(options: ApiOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const parsed = readCode(await readJson(req))
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

async function linkRoute(options: ApiOptions, url: URL, res: ServerResponse): Promise<void> {
  const token = url.searchParams.get("token")
  const expired = `${options.siteOrigin}/sign-in/expired`
  if (token === null || token.length === 0) {
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

async function openRoute(options: ApiOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const email = await signedIn(options, req, res)
  if (email === undefined) return
  const opened = await openSaved(options.deck, await readJson(req), email)
  sendJson(res, 200, opened)
}

async function commitRoute(options: ApiOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const email = await signedIn(options, req, res)
  if (email === undefined) return
  const committed = await commitEdits(options.deck, await readJson(req), email)
  sendJson(res, 200, committed)
}

async function watchRoute(options: ApiOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const email = await signedIn(options, req, res)
  if (email === undefined) return
  const parsed = readWatch(await readJson(req))
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

const deckListRoutes = {
  "/decks/list": listDecks,
  "/decks/rename": renameDeck,
  "/decks/trash": trashDeck,
  "/decks/restore": restoreDeck,
  "/decks/delete": deleteDecks,
}

async function deckListRoute(
  options: ApiOptions,
  route: (typeof deckListRoutes)[keyof typeof deckListRoutes],
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const email = await signedIn(options, req, res)
  if (email === undefined) return
  sendJson(res, 200, await route(options.deck, await readJson(req), email))
}

async function registerRoute(options: ApiOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const answer = await registerClient(options.session, await readJson(req))
  sendJson(res, answer.status, answer.body)
}

async function clientRoute(options: ApiOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const email = await signedIn(options, req, res)
  if (email === undefined) return
  const answer = await describeClient(options.session, await readJson(req), options.resource)
  sendJson(res, answer.status, answer.body)
}

async function approveRoute(
  options: ApiOptions,
  now: () => number,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const email = await signedIn(options, req, res)
  if (email === undefined) return
  const answer = await approve(options.session, await readJson(req), email, options.resource, now())
  sendJson(res, answer.status, answer.body)
}

async function noStoreRoute(res: ServerResponse, work: () => Promise<Answer>): Promise<void> {
  res.setHeader("cache-control", "no-store")
  try {
    const answer = await work()
    sendJson(res, answer.status, answer.body)
  } catch {
    sendJson(res, 500, { error: "server_error" })
  }
}

async function tokenRoute(
  options: ApiOptions,
  now: () => number,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await noStoreRoute(res, async () =>
    tokenAnswer(
      {
        db: options.session,
        own: options.resource,
        now: now(),
      },
      await readFormBody(req),
    ),
  )
}

async function revokeRoute(options: ApiOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  await noStoreRoute(res, async () => revokeToken(options.session, await readFormBody(req)))
}

async function handle(
  options: ApiOptions,
  logs: Map<string, CallerLog>,
  now: () => number,
  mint: () => string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1")
  const method = req.method ?? "GET"
  if (method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true })
    return
  }
  if (method === "GET" && url.pathname === "/version") {
    sendJson(res, 200, { commit: options.commit ?? "unknown" })
    return
  }
  if (method === "POST" && url.pathname === "/smoke/session" && options.smokeToken !== undefined) {
    await smokeRoute(options, options.smokeToken, req, res)
    return
  }
  if (url.pathname === "/mcp") {
    const email = await caller(options, now, req, res)
    if (email === undefined) return
    await serveMcp(
      {
        deck: options.deck,
        email,
        logs,
        now,
        mint,
        hosts: options.hosts ?? localHosts,
        bodyCap,
      },
      req,
      res,
    )
    return
  }
  if (method === "POST" && url.pathname === "/oauth/register") {
    await registerRoute(options, req, res)
    return
  }
  if (method === "POST" && url.pathname === "/oauth/client") {
    await clientRoute(options, req, res)
    return
  }
  if (method === "POST" && url.pathname === "/oauth/approve") {
    await approveRoute(options, now, req, res)
    return
  }
  if (method === "POST" && url.pathname === "/oauth/token") {
    await tokenRoute(options, now, req, res)
    return
  }
  if (method === "POST" && url.pathname === "/oauth/revoke") {
    await revokeRoute(options, req, res)
    return
  }
  if (method === "POST" && url.pathname === "/sign-in/email") {
    await emailRoute(options, req, res)
    return
  }
  if (method === "POST" && url.pathname === "/sign-in/code") {
    await codeRoute(options, req, res)
    return
  }
  if (method === "GET" && url.pathname === "/sign-in/link") {
    await linkRoute(options, url, res)
    return
  }
  if (method === "POST" && url.pathname === "/decks/open") {
    await openRoute(options, req, res)
    return
  }
  if (method === "POST" && url.pathname === "/decks/commit") {
    await commitRoute(options, req, res)
    return
  }
  if (method === "POST" && url.pathname === "/decks/watch") {
    await watchRoute(options, req, res)
    return
  }
  if (method === "POST" && Object.hasOwn(deckListRoutes, url.pathname)) {
    await deckListRoute(options, deckListRoutes[url.pathname as keyof typeof deckListRoutes], req, res)
    return
  }
  res.writeHead(404)
  res.end()
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
    void handle(options, logs, now, mint, req, res).catch(() => {
      if (res.headersSent || res.writableEnded) return
      res.writeHead(500)
      res.end()
    })
  })
}
