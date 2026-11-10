import { randomBytes, randomInt } from "node:crypto"

import { mailText, type Sender } from "./mail.js"
import type { Sql } from "./pool.js"

const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
const codePattern = /^\d{6}$/

const issueSql = `
with account as (
  insert into session.account (email)
  values ($1)
  on conflict (email) do nothing
)
insert into session.code (email, code, token)
values ($1, $2, $3)
on conflict (email) do update
set code = excluded.code, token = excluded.token
`

const acceptCodeSql = `
with removed as (
  delete from session.code
  where email = $1 and code = $2
  returning email
), issued as (
  insert into session.access (token, email)
  select $3, removed.email from removed
  returning token
)
select token from issued
`

const acceptLinkSql = `
with removed as (
  delete from session.code
  where token = $1
  returning email
), issued as (
  insert into session.access (token, email)
  select $2, removed.email from removed
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

export async function issueMail(db: Sql, email: string, host: string, send: Sender): Promise<void> {
  const code = newCode()
  const token = newToken()
  await db.query(issueSql, [email, code, token])
  await send({ to: email, text: mailText(host, token, code) })
}

export async function acceptCode(db: Sql, email: string, code: string): Promise<string | undefined> {
  const token = newToken()
  const result = await db.query<{ token: string }>(acceptCodeSql, [email, code, token])
  return result.rows[0]?.token
}

export async function acceptLink(db: Sql, linkToken: string): Promise<string | undefined> {
  const token = newToken()
  const result = await db.query<{ token: string }>(acceptLinkSql, [linkToken, token])
  return result.rows[0]?.token
}

export async function findAccess(db: Sql, token: string): Promise<boolean> {
  const result = await db.query("select email from session.access where token = $1", [token])
  return result.rows.length === 1
}
