import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"

import { readWatch, type DeckId } from "@airdesign/catalog"

import { acceptCode, acceptLink, findAccess, issueMail, readCode, readEmail } from "./account.js"
import { DeckListen } from "./listen.js"
import type { Sender } from "./mail.js"
import type { Sql } from "./pool.js"
import { chosenRevision, commitEdits, openSaved, readSaved } from "./saved.js"

export type ApiOptions = {
  readonly session: Sql
  readonly deck: Sql
  readonly listen: DeckListen
  readonly send: Sender
  readonly publicOrigin: string
  readonly cookieDomain?: string
}

const cookieName = "airdesign.session"
const bodyCap = 1_000_000

export function sessionCookie(token: string, cookieDomain?: string): string {
  const cookie = `${cookieName}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
  if (cookieDomain === undefined) return cookie
  return `${cookie}; Domain=${cookieDomain}`
}

export function readSessionCookie(header: string | undefined): string | undefined {
  if (header === undefined) return undefined
  for (const part of header.split(";")) {
    const trimmed = part.trim()
    const split = trimmed.indexOf("=")
    if (split <= 0) continue
    if (trimmed.slice(0, split) !== cookieName) continue
    return decodeURIComponent(trimmed.slice(split + 1))
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

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > bodyCap) return undefined
    chunks.push(buffer)
  }
  if (chunks.length === 0) return undefined
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
  } catch {
    return undefined
  }
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
  if (token === null || token.length === 0) {
    redirect(res, "/sign-in")
    return
  }
  const session = await acceptLink(options.session, token)
  if (session === undefined) {
    redirect(res, "/sign-in")
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

async function handle(options: ApiOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1")
  const method = req.method ?? "GET"
  if (method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true })
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
  res.writeHead(404)
  res.end()
}

export function createApi(options: ApiOptions): Server {
  void options.listen.open().catch(() => undefined)
  return createServer((req, res) => {
    void handle(options, req, res).catch(() => {
      if (res.headersSent || res.writableEnded) return
      res.writeHead(500)
      res.end()
    })
  })
}
