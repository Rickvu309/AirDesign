import { createHash, randomBytes, randomInt } from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import { PGlite } from "@electric-sql/pglite"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { serializeSignedCookie } from "better-call"
import pg from "pg"
import { accessPolicy } from "./access-policy.ts"
import { issueIntent, readIntent, usableIntent, type SignedIntent } from "./intent-token.ts"
import { isIntentKind, type IntentKind } from "./intent-kinds.ts"
import type { MailAdapter } from "./memory-inbox.ts"
import { accessSchemaSql, accessTables } from "./schema.ts"

const sessionCookieName = "better-auth.session_token"
const redirectKeys = new Set(["returnTo", "next", "url"])

export type AccessDriver = { kind: "pglite" } | { kind: "postgres"; url: string }

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
}

type AuthSchema = Pick<ReturnType<typeof accessTables>, "user" | "session" | "account" | "verification">

type Database = ReturnType<typeof drizzle<ReturnType<typeof accessTables>>>

type SessionApi = {
  api: {
    getSession(input: { headers: Headers }): Promise<{ user: SessionUser; session: { token: string } } | null>
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

export type Access = {
  handle(request: Request): Promise<Response>
  close(): Promise<void>
}

export async function createAccess(options: CreateAccessOptions): Promise<Access> {
  if (options.driver.kind === "postgres" && options.driver.url.trim() === "") {
    throw new Error("postgres-url-missing")
  }
  const schemaName = `ns_${randomBytes(8).toString("hex")}`
  const tables = accessTables(schemaName)
  const sql = accessSchemaSql(schemaName)
  const opened = await openDatabase(options.driver, schemaName, tables, sql)
  const authSchema: AuthSchema = {
    user: tables.user,
    session: tables.session,
    account: tables.account,
    verification: tables.verification,
  }
  const auth = betterAuth({
    database: drizzleAdapter(opened.db, { provider: "pg", schema: authSchema, camelCase: true }),
    baseURL: "http://127.0.0.1",
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
    advanced: { useSecureCookies: false },
    rateLimit: { enabled: false },
    logger: { level: "error" },
  }) as unknown as SessionApi

  const handle = async (request: Request) => {
    const url = new URL(request.url)
    const body = await readBody(request)
    if (url.pathname === "/api/access/intent" && request.method === "POST") {
      return issueIntentResponse(options, body)
    }
    if (url.pathname === "/api/access/email" && request.method === "POST") {
      return sendEmail(options, opened.db, tables, body)
    }
    if (url.pathname === "/api/access/code" && request.method === "POST") {
      return submitCode(options, auth, opened.db, tables, body)
    }
    if (url.pathname === "/api/access/consume-link" && request.method === "POST") {
      return consumeLink(options, auth, opened.db, tables, body)
    }
    if (url.pathname === "/api/session" && request.method === "GET") {
      return readSession(auth, request)
    }
    if (url.pathname === "/api/session/revoke" && request.method === "POST") {
      return revokeSession(options.secret, auth, request)
    }
    if (url.pathname === "/api/account" && request.method === "GET") {
      return readAccount(auth, request)
    }
    if (url.pathname === "/api/account/deletion" && request.method === "POST") {
      return deleteAccount(options, auth, opened.db, tables, request, body)
    }
    if (url.pathname === "/api/account/provider-deletion" && request.method === "POST") {
      return json(200, { status: "blocked", gate: "X06" })
    }
    const personMatch = new RegExp("^/api/people/([^/]+)$").exec(url.pathname)
    const personId = personMatch?.[1] ? decodeURIComponent(personMatch[1]) : null
    if (personId && request.method === "GET") {
      return readPerson(auth, request, personId)
    }
    if (personId && url.pathname.endsWith("/profile") === false && request.method === "POST") {
      return json(404, { status: "not-found" })
    }
    const profileMatch = new RegExp("^/api/people/([^/]+)/profile$").exec(url.pathname)
    const profileId = profileMatch?.[1] ? decodeURIComponent(profileMatch[1]) : null
    if (profileId && request.method === "POST") {
      return updatePerson(auth, request, profileId, body)
    }
    if (url.pathname === "/api/dev/inbox" && request.method === "GET") {
      return readInbox(options, url)
    }
    return json(404, { status: "not-found" })
  }

  return {
    handle,
    close: opened.close,
  }
}

async function openDatabase(driver: AccessDriver, schemaName: string, tables: ReturnType<typeof accessTables>, sql: string): Promise<{ db: Database; close: () => Promise<void> }> {
  if (driver.kind === "pglite") {
    const client = await PGlite.create()
    await client.exec(sql)
    const db = drizzle(client, { schema: tables })
    return {
      db,
      async close() {
        await client.exec(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
        await client.close()
      },
    }
  }
  const pool = new pg.Pool({ connectionString: driver.url })
  await pool.query(sql)
  const db = drizzlePg(pool, { schema: tables }) as unknown as Database
  return {
    db,
    async close() {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
      await pool.end()
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
  tables: ReturnType<typeof accessTables>,
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
  const now = options.clock()
  const windows = await db.select().from(tables.sendWindow).where(eq(tables.sendWindow.email, email))
  const window = windows[0]
  if (window && now - window.lastSentAt.getTime() < accessPolicy.resendWaitMs) {
    return json(200, { status: "check-email", resendAvailableAt: window.lastSentAt.getTime() + accessPolicy.resendWaitMs })
  }
  const hourStartedAt = !window || now - window.hourStartedAt.getTime() >= accessPolicy.sendWindowMs ? new Date(now) : window.hourStartedAt
  const hourCount = hourStartedAt === window?.hourStartedAt ? window.hourCount : 0
  if (hourCount >= accessPolicy.sendCapPerHour) {
    return json(200, { status: "check-email", resendAvailableAt: now + accessPolicy.resendWaitMs })
  }
  await db.update(tables.challenge).set({ consumed: true }).where(eq(tables.challenge.email, email))
  const code = randomInt(0, 1_000_000).toString().padStart(accessPolicy.codeLength, "0")
  const linkToken = randomBytes(32).toString("base64url")
  await db.insert(tables.challenge).values({
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
  const lastSentAt = new Date(now)
  if (window) {
    await db.update(tables.sendWindow).set({ lastSentAt, hourStartedAt, hourCount: hourCount + 1 }).where(eq(tables.sendWindow.email, email))
  } else {
    await db.insert(tables.sendWindow).values({ email, lastSentAt, hourStartedAt, hourCount: 1 })
  }
  await options.mail.send({ to: email, code, linkToken, sentAt: now })
  return json(200, { status: "check-email", resendAvailableAt: now + accessPolicy.resendWaitMs })
}

async function submitCode(
  options: CreateAccessOptions,
  auth: SessionApi,
  db: Database,
  tables: ReturnType<typeof accessTables>,
  body: Record<string, unknown>,
): Promise<Response> {
  if (!options.guard.allow()) {
    return json(400, { status: "guard-rejected" })
  }
  if (typeof body.email !== "string" || !isEmail(body.email) || typeof body.code !== "string" || typeof body.intent !== "string") {
    return json(400, { status: "invalid-code", screen: "S22.01" })
  }
  const email = normalizeEmail(body.email)
  const intent = usableIntent(options.secret, body.intent, options.clock())
  if (!intent) {
    return json(400, { status: "intent-rejected" })
  }
  const current = await currentChallenge(db, tables, email)
  if (!current || current.intentToken !== intent.token || current.expiresAt.getTime() <= options.clock() || current.locked) {
    return json(400, { status: "invalid-code", screen: "S22.01" })
  }
  if (body.code.length !== accessPolicy.codeLength || sha256(body.code) !== current.codeHash) {
    const attempts = current.attempts + 1
    await db.update(tables.challenge).set({
      attempts,
      locked: attempts >= accessPolicy.attemptLimit,
    }).where(eq(tables.challenge.id, current.id))
    return json(400, { status: "invalid-code", screen: "S22.01" })
  }
  await db.update(tables.challenge).set({ consumed: true }).where(eq(tables.challenge.id, current.id))
  return signInResponse(options, auth, db, tables, email, intent)
}

async function consumeLink(
  options: CreateAccessOptions,
  auth: SessionApi,
  db: Database,
  tables: ReturnType<typeof accessTables>,
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
    const kept = current ? readIntent(options.secret, current.intentToken) : null
    return json(400, { status: "link-used", screen: "S29.01", intentToken: kept?.token ?? null, kind: kept?.kind ?? null })
  }
  const kept = readIntent(options.secret, current.intentToken)
  if (current.expiresAt.getTime() <= options.clock()) {
    return json(400, {
      status: "link-expired",
      screen: "S29.01",
      intentToken: kept?.token ?? null,
      kind: kept?.kind ?? null,
    })
  }
  await db.update(tables.challenge).set({ consumed: true }).where(eq(tables.challenge.id, current.id))
  if (!kept || kept.exp <= options.clock()) {
    return json(400, { status: "intent-rejected" })
  }
  return signInResponse(options, auth, db, tables, current.email, kept)
}

async function signInResponse(
  options: CreateAccessOptions,
  auth: SessionApi,
  db: Database,
  tables: ReturnType<typeof accessTables>,
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
  const cookie = await serializeSignedCookie(sessionCookieName, session.token, options.secret, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: accessPolicy.sessionTtlSeconds,
  })
  return json(200, {
    status: "signed-in",
    personId,
    intentToken: intent.token,
    kind: intent.kind,
  }, cookie)
}

async function readSession(auth: SessionApi, request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return json(200, { status: "signed-out" })
  }
  const user = session.user as SessionUser
  return json(200, accountBody(user))
}

async function readAccount(auth: SessionApi, request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return json(401, { status: "signed-out" })
  }
  return json(200, accountBody(session.user as SessionUser))
}

async function revokeSession(secret: string, auth: SessionApi, request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (session) {
    const context = await auth.$context
    await context.internalAdapter.deleteSession(session.session.token)
  }
  const cookie = await serializeSignedCookie(sessionCookieName, "", secret, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  })
  return json(200, { status: "signed-out" }, cookie)
}

async function deleteAccount(
  options: CreateAccessOptions,
  auth: SessionApi,
  db: Database,
  tables: ReturnType<typeof accessTables>,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return json(401, { status: "signed-out" })
  }
  if (body.confirm !== "delete-account") {
    return json(400, { status: "confirmation-required" })
  }
  const user = session.user as SessionUser
  const started = user.freeUsageWeekStartedAt ? new Date(user.freeUsageWeekStartedAt) : new Date(options.clock())
  await db.insert(tables.tombstone).values({
    emailHash: sha256(normalizeEmail(user.email)),
    freeUsageWeekStartedAt: started,
    deletedAt: new Date(options.clock()),
  }).onConflictDoNothing()
  const context = await auth.$context
  await context.internalAdapter.deleteUserSessions(user.id)
  await context.internalAdapter.deleteUser(user.id)
  const cookie = await serializeSignedCookie(sessionCookieName, "", options.secret, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  })
  return json(200, { status: "deleted" }, cookie)
}

async function readPerson(auth: SessionApi, request: Request, personId: string): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session || session.user.id !== personId) {
    return json(404, { status: "not-found" })
  }
  const user = session.user as SessionUser
  return json(200, { status: "ok", personId: user.id, displayName: user.displayName ?? user.name })
}

async function updatePerson(
  auth: SessionApi,
  request: Request,
  personId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session || session.user.id !== personId) {
    return json(404, { status: "not-found" })
  }
  if (typeof body.displayName !== "string" || body.displayName.trim() === "") {
    return json(400, { status: "invalid-name" })
  }
  const context = await auth.$context
  const updated = await context.internalAdapter.updateUser(personId, { displayName: body.displayName })
  return json(200, { status: "ok", personId, displayName: (updated as SessionUser).displayName ?? body.displayName })
}

function readInbox(options: CreateAccessOptions, url: URL): Response {
  if (!options.exposeInbox) {
    return json(404, { status: "not-found" })
  }
  const to = url.searchParams.get("to")
  if (!to || !("read" in options.mail)) {
    return json(200, { messages: [] })
  }
  const inbox = options.mail as MailAdapter & { read(to: string): { to: string; code: string; linkToken: string; sentAt: number }[] }
  return json(200, { messages: inbox.read(normalizeEmail(to)) })
}

async function currentChallenge(db: Database, tables: ReturnType<typeof accessTables>, email: string) {
  const rows = await db.select().from(tables.challenge).where(and(eq(tables.challenge.email, email), eq(tables.challenge.consumed, false))).orderBy(desc(tables.challenge.expiresAt))
  return rows[0] ?? null
}

function accountBody(user: SessionUser) {
  return {
    status: "signed-in" as const,
    personId: user.id,
    email: user.email,
    displayName: user.displayName ?? user.name,
    freeUsageWeekStartedAt: user.freeUsageWeekStartedAt ? new Date(user.freeUsageWeekStartedAt).toISOString() : null,
  }
}

type SessionUser = {
  id: string
  email: string
  name: string
  displayName?: string | null
  freeUsageWeekStartedAt?: Date | string | null
}

function json(status: number, body: unknown, cookie?: string): Response {
  const headers = new Headers({ "content-type": "application/json" })
  if (cookie) {
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
