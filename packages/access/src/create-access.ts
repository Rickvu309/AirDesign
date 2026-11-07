import { createHash, randomBytes, randomInt } from "node:crypto"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { and, desc, eq, gt, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import { PGlite } from "@electric-sql/pglite"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import pg from "pg"
import { accessLinkPath } from "./access-link.ts"
import { accessPolicy } from "./access-policy.ts"
import { decodePathSegment } from "./decode-path-segment.ts"
import { dropDisposableSchemaSql } from "./disposable-schema.ts"
import { issueIntent, readIntent, usableIntent, type SignedIntent } from "./intent-token.ts"
import { isIntentKind, type IntentKind } from "./intent-kinds.ts"
import type { MailAdapter } from "./memory-inbox.ts"
import { mutationRejection } from "./mutation-guard.ts"
import { accessSchemaSql, accessTables, applicationSchemaName } from "./schema.ts"
import { headerCookies, intentCookieName, intentSetCookie, readRequestCookie, sessionSetCookie } from "./session-cookie.ts"

export type AccessDriver = { kind: "pglite"; dataDir?: string; client?: PGlite } | { kind: "postgres"; url: string }

export type AccessGuard = {
  allow(): boolean
}

export type CreateAccessOptions = {
  driver: AccessDriver
  secret: string
  mail: MailAdapter
  clock: () => number
  guard: AccessGuard
  exposeInbox: boolean
  deleteOwnedData?: (personId:string)=>Promise<void>
  publicOrigin?: string
}

type AuthSchema = Pick<ReturnType<typeof accessTables>, "user" | "session" | "account" | "verification">

type Database = ReturnType<typeof drizzle<ReturnType<typeof accessTables>>>

type Tables = ReturnType<typeof accessTables>

type SessionUser = {
  id: string
  email: string
  name: string
  displayName?: string | null
  freeUsageWeekStartedAt?: Date | string | null
}

type SessionRecord = { user: SessionUser; session: { token: string } }

type SessionApi = {
  api: {
    getSession(input: { headers: Headers; returnHeaders: true }): Promise<{ headers: Headers; response: SessionRecord | null } | null>
  }
  $context: Promise<{
    internalAdapter: {
      findUserByEmail(email: string): Promise<{ user: { id: string } } | null>
      createUser(user: {
        name: string
        email: string
        emailVerified: boolean
        displayName: string
        freeUsageWeekStartedAt: Date
      }, source: { method: "magic-link" }): Promise<{ id: string }>
      createSession(userId: string): Promise<{ token: string }>
      deleteSession(token: string): Promise<void>
      deleteUserSessions(userId: string): Promise<void>
      deleteUser(userId: string): Promise<void>
      updateUser(userId: string, data: { displayName: string }): Promise<SessionUser>
    }
  }>
}

type LoadedSession = { user: SessionUser | null; cookies: string[] }

export type Access = {
  handle(request: Request): Promise<Response>
  principal(request: Request): Promise<{ personId: string } | null>
  resumeDeletions(): Promise<void>
  close(): Promise<void>
}

const redirectKeys = new Set(["returnTo", "next", "url"])

export async function createAccess(options: CreateAccessOptions): Promise<Access> {
  if (process.env.NODE_ENV === "production" && options.exposeInbox) throw new Error("AIRDESIGN_EXPOSE_INBOX is forbidden in production")
  if (options.driver.kind === "postgres" && options.driver.url.trim() === "") {
    throw new Error("postgres-url-missing")
  }
  const publicOrigin = options.publicOrigin ?? "http://127.0.0.1:41732"
  let origin: URL
  try {
    origin = new URL(publicOrigin)
  } catch {
    throw new Error("public-origin-invalid")
  }
  const secure = origin.protocol === "https:"
  const opened = await openDatabase(options.driver)
  const tables = opened.tables
  const authSchema: AuthSchema = {
    user: tables.user,
    session: tables.session,
    account: tables.account,
    verification: tables.verification,
  }
  const auth = betterAuth({
    database: drizzleAdapter(opened.db, { provider: "pg", schema: authSchema, camelCase: true }),
    baseURL: origin.origin,
    secret: options.secret,
    emailAndPassword: { enabled: false },
    session: {
      expiresIn: accessPolicy.sessionTtlSeconds,
      updateAge: accessPolicy.sessionUpdateAgeSeconds,
    },
    user: {
      additionalFields: {
        displayName: { type: "string", required: false, input: false },
        freeUsageWeekStartedAt: { type: "date", required: false, input: false },
      },
    },
    advanced: { useSecureCookies: secure },
    rateLimit: { enabled: false },
    logger: { level: "error" },
  }) as unknown as SessionApi

  const getSession = auth.api.getSession.bind(auth.api)
  auth.api.getSession = async input => {
    const loaded = await getSession(input)
    if (loaded?.response && (await opened.db.select().from(tables.deletion).where(eq(tables.deletion.owner, loaded.response.user.id))).length) return { ...loaded, response: null }
    return loaded
  }
  let deletionTask: Promise<void> | undefined
  function resumeDeletions() {
    deletionTask ??= finishDeletions(options, auth, opened.db, tables).finally(() => { deletionTask = undefined })
    return deletionTask
  }
  const handle = async (request: Request) => {
    const rejected = mutationRejection(request, origin.origin)
    if (rejected) {
      return json(rejected.status, { status: rejected.code })
    }
    try {
      if(new URL(request.url).pathname==="/api/account/deletion"&&request.method==="POST")await resumeDeletions()
      return await route(options, auth, opened.db, tables, secure, request)
    } catch (error) {
      if (error instanceof URIError) {
        return json(400, { status: "bad-request" })
      }
      throw error
    }
  }

  return {
    handle,
    resumeDeletions,
    async principal(request) {
      const loaded = await loadSession(auth, request)
      return loaded.user ? { personId: loaded.user.id } : null
    },
    close: opened.close,
  }
}

async function route(
  options: CreateAccessOptions,
  auth: SessionApi,
  db: Database,
  tables: Tables,
  secure: boolean,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url)
  const body = await readBody(request)
  if (url.pathname === "/api/access/intent" && request.method === "POST") {
    return issueIntentResponse(options, body)
  }
  if (url.pathname === "/api/access/email" && request.method === "POST") {
    return sendEmail(options, db, tables, body)
  }
  if (url.pathname === "/api/access/code" && request.method === "POST") {
    return submitCode(options, auth, db, tables, secure, body)
  }
  if (url.pathname === "/api/access/consume-link" && request.method === "POST") {
    return consumeLink(options, auth, db, tables, secure, body)
  }
  if (url.pathname === "/api/session" && request.method === "GET") {
    return readSession(options, auth, secure, request)
  }
  if (url.pathname === "/api/session/revoke" && request.method === "POST") {
    return revokeSession(options, auth, secure, request)
  }
  if (url.pathname === "/api/account" && request.method === "GET") {
    return readAccount(options, auth, secure, request)
  }
  if (url.pathname === "/api/account/deletion" && request.method === "POST") {
    return deleteAccount(options, auth, db, tables, secure, request, body)
  }
  if (url.pathname === "/api/account/provider-deletion" && request.method === "POST") {
    return json(200, { status: "blocked", gate: "X06" })
  }
  const personMatch = /^\/api\/people\/([^/]+)$/.exec(url.pathname)
  if (personMatch?.[1]) {
    const personId = decodePathSegment(personMatch[1])
    if (personId === null) {
      return json(400, { status: "bad-request" })
    }
    if (request.method === "GET") {
      return readPerson(auth, request, personId)
    }
    if (request.method === "POST") {
      return json(404, { status: "not-found" })
    }
  }
  const profileMatch = /^\/api\/people\/([^/]+)\/profile$/.exec(url.pathname)
  if (profileMatch?.[1]) {
    const profileId = decodePathSegment(profileMatch[1])
    if (profileId === null) {
      return json(400, { status: "bad-request" })
    }
    if (request.method === "POST") {
      return updatePerson(auth, request, profileId, body)
    }
  }
  if (url.pathname === "/api/dev/inbox" && request.method === "GET") {
    return readInbox(options, url)
  }
  return json(404, { status: "not-found" })
}

async function openDatabase(driver: AccessDriver): Promise<{ db: Database; tables: Tables; close: () => Promise<void> }> {
  if (driver.kind === "pglite") {
    if (driver.dataDir && driver.dataDir !== "memory://") await mkdir(path.dirname(driver.dataDir), { recursive: true, mode: 0o700 })
    const schemaName = driver.dataDir ? applicationSchemaName : `ns_${randomBytes(8).toString("hex")}`
    const tables = accessTables(schemaName)
    const client = driver.client ?? await PGlite.create(driver.dataDir)
    await client.exec(accessSchemaSql(schemaName, driver.dataDir ? "stable" : "disposable"))
    const db = drizzle(client, { schema: tables })
    let closed = false
    return {
      db,
      tables,
      async close() {
        if (closed) {
          return
        }
        closed = true
        if (!driver.dataDir) await client.exec(dropDisposableSchemaSql(schemaName))
        if (!driver.client) await client.close()
      },
    }
  }
  const tables = accessTables(applicationSchemaName)
  const pool = new pg.Pool({ connectionString: driver.url })
  const connections = new Set<Promise<void>>()
  pool.on("connect", client => {
    const ended = new Promise<void>(resolve => client.once("end", resolve))
    connections.add(ended)
    void ended.then(() => connections.delete(ended))
  })
  await pool.query(accessSchemaSql(applicationSchemaName, "stable"))
  const db = drizzlePg(pool, { schema: tables }) as unknown as Database
  let closed = false
  return {
    db,
    tables,
    async close() {
      if (closed) {
        return
      }
      closed = true
      await pool.end()
      await Promise.all(connections)
    },
  }
}

function issueIntentResponse(options: CreateAccessOptions, body: Record<string, unknown>): Response {
  if ([...redirectKeys].some((key) => key in body)) {
    return json(400, { status: "intent-rejected" })
  }
  if (typeof body.kind !== "string" || !isIntentKind(body.kind)) {
    return json(400, { status: "intent-rejected" })
  }
  const intent = issueIntent(options.secret, body.kind, options.clock())
  return json(200, { status: "issued", token: intent.token, kind: intent.kind })
}

async function sendEmail(
  options: CreateAccessOptions,
  db: Database,
  tables: Tables,
  body: Record<string, unknown>,
): Promise<Response> {
  if (typeof body.email !== "string" || !isEmail(body.email)) {
    return json(400, { status: "email-invalid" })
  }
  const email = normalizeEmail(body.email)
  const intent = typeof body.intent === "string" ? usableIntent(options.secret, body.intent, options.clock()) : null
  if (!intent) {
    return json(400, { status: "intent-rejected" })
  }
  if (!options.guard.allow()) {
    return json(400, { status: "guard-rejected" })
  }
  const decision = await db.transaction(async (tx) => {
    const now = options.clock()
    await tx.insert(tables.sendWindow).values({
      email,
      lastSentAt: new Date(0),
      hourStartedAt: new Date(0),
      hourCount: 0,
    }).onConflictDoNothing()
    const locked = await tx.select().from(tables.sendWindow).where(eq(tables.sendWindow.email, email)).for("update")
    const window = locked[0]
    if (!window) {
      throw new Error("send-window-missing")
    }
    const cooling = window.hourCount > 0 && now - window.lastSentAt.getTime() < accessPolicy.resendWaitMs
    if (cooling) {
      return { kind: "wait" as const, resendAvailableAt: window.lastSentAt.getTime() + accessPolicy.resendWaitMs }
    }
    const windowExpired = now - window.hourStartedAt.getTime() >= accessPolicy.sendWindowMs
    const hourStartedAt = windowExpired ? new Date(now) : window.hourStartedAt
    const hourCount = windowExpired ? 0 : window.hourCount
    if (hourCount >= accessPolicy.sendCapPerHour) {
      return { kind: "capped" as const, resendAvailableAt: now + accessPolicy.resendWaitMs }
    }
    await tx.update(tables.challenge).set({ consumed: true }).where(and(eq(tables.challenge.email, email), eq(tables.challenge.consumed, false)))
    const code = randomInt(0, 1_000_000).toString().padStart(accessPolicy.codeLength, "0")
    const linkToken = randomBytes(32).toString("base64url")
    await tx.insert(tables.challenge).values({
      id: randomBytes(16).toString("hex"),
      email,
      codeHash: sha256(code),
      linkHash: sha256(linkToken),
      intentToken: intent.token,
      expiresAt: new Date(now + accessPolicy.linkTtlMs),
      attempts: 0,
      locked: false,
      consumed: false,
    })
    await tx.update(tables.sendWindow).set({
      lastSentAt: new Date(now),
      hourStartedAt,
      hourCount: hourCount + 1,
    }).where(eq(tables.sendWindow.email, email))
    return { kind: "sent" as const, code, linkToken, resendAvailableAt: now + accessPolicy.resendWaitMs, sentAt: now }
  })
  if (decision.kind !== "sent") {
    return json(200, { status: "check-email", resendAvailableAt: decision.resendAvailableAt })
  }
  await options.mail.send({
    to: email,
    code: decision.code,
    linkToken: decision.linkToken,
    linkPath: accessLinkPath(decision.linkToken),
    sentAt: decision.sentAt,
  })
  return json(200, { status: "check-email", resendAvailableAt: decision.resendAvailableAt })
}

async function submitCode(
  options: CreateAccessOptions,
  auth: SessionApi,
  db: Database,
  tables: Tables,
  secure: boolean,
  body: Record<string, unknown>,
): Promise<Response> {
  if (!options.guard.allow()) {
    return json(400, { status: "guard-rejected" })
  }
  if (typeof body.email !== "string" || !isEmail(body.email) || typeof body.code !== "string" || typeof body.intent !== "string") {
    return json(400, { status: "invalid-code", screen: "S29.01" })
  }
  const email = normalizeEmail(body.email)
  const intent = usableIntent(options.secret, body.intent, options.clock())
  if (!intent) {
    return json(400, { status: "intent-rejected" })
  }
  const current = await currentChallenge(db, tables, email)
  if (!current || current.intentToken !== intent.token || current.locked) {
    return json(400, { status: "invalid-code", screen: "S29.01" })
  }
  if (current.expiresAt.getTime() <= options.clock()) {
    return recoveryResponse(options, "link-expired", current.intentToken)
  }
  if (body.code.length !== accessPolicy.codeLength || sha256(body.code) !== current.codeHash) {
    await db.update(tables.challenge).set({
      attempts: sql`${tables.challenge.attempts} + 1`,
      locked: sql`${tables.challenge.attempts} + 1 >= ${accessPolicy.attemptLimit}`,
    }).where(and(
      eq(tables.challenge.id, current.id),
      eq(tables.challenge.consumed, false),
      eq(tables.challenge.locked, false),
    ))
    return json(400, { status: "invalid-code", screen: "S29.01" })
  }
  const claimed = await claimChallenge(db, tables, current.id, options.clock())
  if (!claimed) {
    return json(400, { status: "invalid-code", screen: "S29.01" })
  }
  return signInResponse(options, auth, db, tables, secure, email, intent)
}

async function consumeLink(
  options: CreateAccessOptions,
  auth: SessionApi,
  db: Database,
  tables: Tables,
  secure: boolean,
  body: Record<string, unknown>,
): Promise<Response> {
  if (!options.guard.allow()) {
    return json(400, { status: "guard-rejected" })
  }
  if (typeof body.token !== "string") {
    return json(400, { status: "link-used", screen: "S29.01", intentToken: null, kind: null })
  }
  const rows = await db.select().from(tables.challenge).where(eq(tables.challenge.linkHash, sha256(body.token)))
  const current = rows[0]
  if (!current || current.consumed) {
    return recoveryResponse(options, "link-used", current?.intentToken ?? null)
  }
  const kept = readIntent(options.secret, current.intentToken)
  if (current.expiresAt.getTime() <= options.clock() || current.locked) {
    return recoveryResponse(options, "link-expired", current.intentToken)
  }
  const claimed = await claimChallenge(db, tables, current.id, options.clock())
  if (!claimed) {
    return recoveryResponse(options, "link-used", current.intentToken)
  }
  if (!kept || kept.exp <= options.clock()) {
    return json(400, { status: "intent-rejected" })
  }
  return signInResponse(options, auth, db, tables, secure, current.email, kept)
}

function recoveryResponse(options: CreateAccessOptions, status: "link-expired" | "link-used", stored: string | null): Response {
  const recovered = freshRecoveryIntent(options, stored)
  return json(400, { status, screen: "S29.01", intentToken: recovered.intentToken, kind: recovered.kind })
}

function freshRecoveryIntent(options: CreateAccessOptions, stored: string | null): { intentToken: string | null; kind: IntentKind | null } {
  if (!stored) {
    return { intentToken: null, kind: null }
  }
  const kept = readIntent(options.secret, stored)
  if (!kept) {
    return { intentToken: null, kind: null }
  }
  if (kept.exp > options.clock()) {
    return { intentToken: kept.token, kind: kept.kind }
  }
  const fresh = issueIntent(options.secret, kept.kind, options.clock())
  return { intentToken: fresh.token, kind: fresh.kind }
}

async function claimChallenge(db: Database, tables: Tables, id: string, now: number): Promise<boolean> {
  const claimed = await db.update(tables.challenge).set({ consumed: true }).where(and(
    eq(tables.challenge.id, id),
    eq(tables.challenge.consumed, false),
    eq(tables.challenge.locked, false),
    gt(tables.challenge.expiresAt, new Date(now)),
  )).returning({ id: tables.challenge.id })
  return claimed.length === 1
}

async function signInResponse(
  options: CreateAccessOptions,
  auth: SessionApi,
  db: Database,
  tables: Tables,
  secure: boolean,
  email: string,
  intent: SignedIntent,
): Promise<Response> {
  const context = await auth.$context
  const existing = await context.internalAdapter.findUserByEmail(email)
  let personId = existing?.user.id
  if (!personId) {
    const emailHash = sha256(email)
    const tombstones = await db.select().from(tables.tombstone).where(eq(tables.tombstone.emailHash, emailHash))
    const freeUsageWeekStartedAt = tombstones[0]?.freeUsageWeekStartedAt ?? new Date(options.clock())
    const localPart = email.split("@")[0] ?? email
    const created = await context.internalAdapter.createUser({
      name: localPart,
      email,
      emailVerified: true,
      displayName: localPart,
      freeUsageWeekStartedAt,
    }, { method: "magic-link" })
    personId = created.id
  }
  const session = await context.internalAdapter.createSession(personId)
  const sessionCookie = await sessionSetCookie(options.secret, session.token, secure, accessPolicy.sessionTtlSeconds)
  const intentMaxAge = Math.max(0, Math.floor((intent.exp - options.clock()) / 1000))
  const intentCookie = intentSetCookie(intent.token, secure, intentMaxAge)
  return json(200, {
    status: "signed-in",
    personId,
    intentToken: intent.token,
    kind: intent.kind,
  }, [sessionCookie, intentCookie])
}

async function readSession(options: CreateAccessOptions, auth: SessionApi, secure: boolean, request: Request): Promise<Response> {
  const loaded = await loadSession(auth, request)
  if (!loaded.user) {
    return json(200, { status: "signed-out" }, loaded.cookies)
  }
  return json(200, accountBody(loaded.user, intentFromRequest(options, secure, request)), loaded.cookies)
}

async function readAccount(options: CreateAccessOptions, auth: SessionApi, secure: boolean, request: Request): Promise<Response> {
  const loaded = await loadSession(auth, request)
  if (!loaded.user) {
    return json(401, { status: "signed-out" }, loaded.cookies)
  }
  return json(200, accountBody(loaded.user, intentFromRequest(options, secure, request)), loaded.cookies)
}

async function revokeSession(options: CreateAccessOptions, auth: SessionApi, secure: boolean, request: Request): Promise<Response> {
  const loaded = await loadSession(auth, request)
  if (loaded.user) {
    const context = await auth.$context
    const token = await sessionToken(auth, request)
    if (token) {
      await context.internalAdapter.deleteSession(token)
    }
  }
  const cleared = [
    await sessionSetCookie(options.secret, "", secure, 0),
    intentSetCookie("", secure, 0),
  ]
  return json(200, { status: "signed-out" }, cleared)
}

async function deleteAccount(
  options: CreateAccessOptions,
  auth: SessionApi,
  db: Database,
  tables: Tables,
  secure: boolean,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const loaded = await loadSession(auth, request)
  if (!loaded.user) {
    return json(401, { status: "signed-out" }, loaded.cookies)
  }
  if (body.confirm !== "delete-account") {
    return json(400, { status: "confirmation-required" }, loaded.cookies)
  }
  const user = loaded.user
  const started = user.freeUsageWeekStartedAt ? new Date(user.freeUsageWeekStartedAt) : new Date(options.clock())
  await db.transaction(async tx => {
    await tx.insert(tables.tombstone).values({
      emailHash: sha256(normalizeEmail(user.email)),
      freeUsageWeekStartedAt: started,
      deletedAt: new Date(options.clock()),
    }).onConflictDoNothing()
    await tx.insert(tables.deletion).values({ owner: user.id, email: normalizeEmail(user.email) }).onConflictDoNothing()
  })
  await finishDeletions(options, auth, db, tables)
  const cleared = [
    await sessionSetCookie(options.secret, "", secure, 0),
    intentSetCookie("", secure, 0),
  ]
  return json(200, { status: "deleted" }, cleared)
}

async function finishDeletions(options: CreateAccessOptions, auth: SessionApi, db: Database, tables: Tables) {
  const context = await auth.$context
  for (const job of await db.select().from(tables.deletion)) {
    await context.internalAdapter.deleteUserSessions(job.owner)
    await options.deleteOwnedData?.(job.owner)
    await db.delete(tables.challenge).where(eq(tables.challenge.email, job.email))
    await db.delete(tables.sendWindow).where(eq(tables.sendWindow.email, job.email))
    await context.internalAdapter.deleteUser(job.owner)
    await db.delete(tables.deletion).where(eq(tables.deletion.owner, job.owner))
  }
}

async function readPerson(auth: SessionApi, request: Request, personId: string): Promise<Response> {
  const loaded = await loadSession(auth, request)
  if (!loaded.user || loaded.user.id !== personId) {
    return json(404, { status: "not-found" }, loaded.cookies)
  }
  return json(200, { status: "ok", personId: loaded.user.id, displayName: loaded.user.displayName ?? loaded.user.name }, loaded.cookies)
}

async function updatePerson(
  auth: SessionApi,
  request: Request,
  personId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const loaded = await loadSession(auth, request)
  if (!loaded.user || loaded.user.id !== personId) {
    return json(404, { status: "not-found" }, loaded.cookies)
  }
  if (typeof body.displayName !== "string" || body.displayName.trim() === "") {
    return json(400, { status: "invalid-name" }, loaded.cookies)
  }
  const context = await auth.$context
  const updated = await context.internalAdapter.updateUser(personId, { displayName: body.displayName })
  return json(200, { status: "ok", personId, displayName: (updated as SessionUser).displayName ?? body.displayName }, loaded.cookies)
}

function readInbox(options: CreateAccessOptions, url: URL): Response {
  if (!options.exposeInbox) {
    return json(404, { status: "not-found" })
  }
  const to = url.searchParams.get("to")
  if (!to || !("read" in options.mail)) {
    return json(200, { messages: [] })
  }
  const inbox = options.mail as MailAdapter & { read(to: string): { to: string; code: string; linkToken: string; linkPath: string; sentAt: number }[] }
  return json(200, { messages: inbox.read(normalizeEmail(to)) })
}

async function currentChallenge(db: Database, tables: Tables, email: string) {
  const rows = await db.select().from(tables.challenge).where(and(eq(tables.challenge.email, email), eq(tables.challenge.consumed, false))).orderBy(desc(tables.challenge.expiresAt))
  return rows[0] ?? null
}

async function loadSession(auth: SessionApi, request: Request): Promise<LoadedSession> {
  const result = await auth.api.getSession({ headers: request.headers, returnHeaders: true })
  const cookies = result?.headers ? headerCookies(result.headers) : []
  if (!result?.response?.user) {
    return { user: null, cookies }
  }
  return { user: result.response.user, cookies }
}

async function sessionToken(auth: SessionApi, request: Request): Promise<string | null> {
  const result = await auth.api.getSession({ headers: request.headers, returnHeaders: true })
  return result?.response?.session.token ?? null
}

function intentFromRequest(options: CreateAccessOptions, secure: boolean, request: Request): SignedIntent | null {
  const names = [intentCookieName(secure), intentCookieName(!secure)]
  for (const name of names) {
    const token = readRequestCookie(request, name)
    if (!token) {
      continue
    }
    const intent = usableIntent(options.secret, token, options.clock())
    if (intent) {
      return intent
    }
  }
  return null
}

function accountBody(user: SessionUser, intent: SignedIntent | null) {
  return {
    status: "signed-in" as const,
    personId: user.id,
    email: user.email,
    displayName: user.displayName ?? user.name,
    freeUsageWeekStartedAt: user.freeUsageWeekStartedAt ? new Date(user.freeUsageWeekStartedAt).toISOString() : null,
    intentToken: intent?.token ?? null,
    kind: intent?.kind ?? null,
  }
}

function json(status: number, body: unknown, cookies: string[] = []): Response {
  const headers = new Headers({ "content-type": "application/json" })
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie)
  }
  return new Response(JSON.stringify(body), { status, headers })
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (request.method === "GET" || request.method === "HEAD") {
    return {}
  }
  const text = await request.text()
  if (text.trim() === "") {
    return {}
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {}
  }
  return parsed as Record<string, unknown>
}

function isEmail(value: string): boolean {
  const parts = value.trim().split("@")
  return parts.length === 2 && parts[0] !== "" && parts[1]?.includes(".") === true && !value.includes(" ")
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export type { IntentKind }
