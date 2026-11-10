import { createHash, randomBytes, randomInt } from "node:crypto"
import { Pool } from "pg"

import { mailText, type Sender } from "./mail.js"
import type { Sql } from "./pool.js"

const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
const codePattern = /^\d{6}$/

const issueSql = `
with recent as (
  select count(*)::int as total
  from session.sent
  where email = $1 and issued > now() - interval '15 minutes'
), allowed as (
  select $1::text as email
  where (select total from recent) < 5
), account as (
  insert into session.account (email)
  select email from allowed
  on conflict (email) do nothing
  returning email
), code as (
  insert into session.code (email, code, token, issued, misses)
  select allowed.email, $2, $3, now(), 0
  from allowed
  where (select count(*) from account) >= 0
  on conflict (email) do update
  set code = excluded.code, token = excluded.token, issued = excluded.issued, misses = 0
  returning email
), sent as (
  insert into session.sent (email, issued)
  select email, now() from code
  returning id
)
select id::text as id from sent
`

const acceptCodeSql = `
with removed as (
  delete from session.code
  where email = $1
    and code = $2
    and misses < 10
    and issued > now() - interval '15 minutes'
  returning email
), issued as (
  insert into session.access (token, email, issued)
  select $3, removed.email, now() from removed
  returning token
), missed as (
  update session.code
  set misses = misses + 1
  where email = $1
    and (
      code <> $2
      or misses >= 10
      or issued <= now() - interval '15 minutes'
    )
  returning email
)
select (select token from issued) as token, (select count(*)::int from missed) as counted
`

const acceptLinkSql = `
with removed as (
  delete from session.code
  where token = $1 and issued > now() - interval '15 minutes'
  returning email
), issued as (
  insert into session.access (token, email, issued)
  select $2, removed.email, now() from removed
  returning token
)
select token from issued
`

export type FieldRefusal = { readonly ok: false; readonly refusal: "field" }

function recordOf(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

function onlyKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  const present = Object.keys(body)
  if (present.length !== keys.length) return false
  return keys.every((key) => present.includes(key))
}

function addressOf(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const email = raw.trim().toLowerCase()
  if (email.length === 0 || email.length > 254 || !emailPattern.test(email)) return undefined
  return email
}

export function readEmail(raw: unknown): { readonly ok: true; readonly email: string } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined || !onlyKeys(body, ["email"])) return { ok: false, refusal: "field" }
  const email = addressOf(body.email)
  if (email === undefined) return { ok: false, refusal: "field" }
  return { ok: true, email }
}

export function readCode(
  raw: unknown,
): { readonly ok: true; readonly email: string; readonly code: string } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined || !onlyKeys(body, ["email", "code"])) return { ok: false, refusal: "field" }
  const email = addressOf(body.email)
  if (email === undefined || typeof body.code !== "string" || !codePattern.test(body.code)) {
    return { ok: false, refusal: "field" }
  }
  return { ok: true, email, code: body.code }
}

function newToken(): string {
  return randomBytes(32).toString("base64url")
}

function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

async function withAddress<T>(db: Sql, email: string, run: (client: Sql) => Promise<T>): Promise<T> {
  const owned = db instanceof Pool ? await db.connect() : undefined
  const client = owned ?? db
  try {
    await client.query("begin")
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [email])
    const value = await run(client)
    await client.query("commit")
    return value
  } catch (error) {
    await client.query("rollback").catch(() => undefined)
    throw error
  } finally {
    owned?.release()
  }
}

type Placed = {
  readonly id: string
  readonly code: string | null
  readonly token: string | null
  readonly issued: Date | null
  readonly misses: number | null
}

async function undoSend(db: Sql, email: string, placed: Placed, link: string): Promise<void> {
  await withAddress(db, email, async (client) => {
    await client.query("delete from session.sent where id = $1::bigint", [placed.id])
    if (placed.token === null) {
      await client.query("delete from session.code where email = $1 and token = $2", [email, link])
      return
    }
    await client.query(
      "update session.code set code = $3, token = $4, issued = $5, misses = $6 where email = $1 and token = $2",
      [email, link, placed.code, placed.token, placed.issued, placed.misses],
    )
  })
}

export async function issueMail(db: Sql, email: string, publicOrigin: string, send: Sender): Promise<void> {
  const code = newCode()
  const token = newToken()
  const link = digest(token)
  const placed = await withAddress(db, email, async (client) => {
    const earlier = await client.query<{ code: string; token: string; issued: Date; misses: number }>(
      "select code, token, issued, misses from session.code where email = $1",
      [email],
    )
    const stored = await client.query<{ id: string }>(issueSql, [email, digest(code), link])
    const row = stored.rows[0]
    if (row === undefined) return undefined
    const previous = earlier.rows[0]
    return {
      id: row.id,
      code: previous?.code ?? null,
      token: previous?.token ?? null,
      issued: previous?.issued ?? null,
      misses: previous?.misses ?? null,
    }
  })
  if (placed === undefined) return
  try {
    await send({ to: email, text: mailText(publicOrigin, token, code) })
  } catch (error) {
    await undoSend(db, email, placed, link)
    throw error
  }
}

export async function acceptCode(db: Sql, email: string, code: string): Promise<string | undefined> {
  const token = newToken()
  const result = await db.query<{ token: string | null }>(acceptCodeSql, [email, digest(code), digest(token)])
  if (typeof result.rows[0]?.token !== "string") return undefined
  return token
}

export async function acceptLink(db: Sql, linkToken: string): Promise<string | undefined> {
  const token = newToken()
  const result = await db.query<{ token: string }>(acceptLinkSql, [digest(linkToken), digest(token)])
  if (result.rows[0] === undefined) return undefined
  return token
}

export async function findAccess(db: Sql, token: string): Promise<string | undefined> {
  const result = await db.query<{ email: string }>(
    "select email from session.access where token = $1 and issued > now() - interval '30 days'",
    [digest(token)],
  )
  return result.rows[0]?.email
}
