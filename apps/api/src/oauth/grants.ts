import { randomUUID } from "node:crypto"

import { oauth, type Command, type Grant } from "@airdesign/oauth"

import type { Sql } from "../platform/pool.js"
import { hashSecret, newSecret } from "../platform/secrets.js"

export const accessLifetime = 3_600_000
const attempts = 8

export type Approval = {
  readonly id: string
  readonly grant: Grant
  readonly clientId: string
  readonly redirectUri: string
  readonly challenge: string
  readonly codeExpires: number
}

export type TokenRow = {
  readonly hash: string
  readonly grantId: string
  readonly generation: number
  readonly kind: "access" | "refresh"
  readonly expires: number | null
}

export type Issued = {
  readonly access: string
  readonly refresh: string | undefined
}

export type Advance = {
  readonly grant: Grant
  readonly accepted: boolean
  readonly issued?: Issued
  readonly lost?: true
}

type GrantRow = {
  id: string
  principal: string
  code: "open" | "used"
  generation: number
  revoked: boolean
  rotates: boolean
  client_id: string
  redirect_uri: string
  challenge: string
  code_expires: number
}

const columns =
  "id, principal, code, generation, revoked, rotates, client_id, redirect_uri, challenge, code_expires from session.oauth_grant"

const writeSql = `
with updated as (
  update session.oauth_grant
  set code = $2,
      generation = $3,
      revoked = $4,
      rotates = $12,
      connected = coalesce(connected, to_timestamp($11::float8 / 1000.0))
  where id = $1 and code = $5 and generation = $6 and revoked = $7
  returning id, generation
), issued as (
  insert into session.oauth_token (hash, grant_id, generation, kind, expires)
  select pending.hash, updated.id, updated.generation, pending.kind, pending.expires
  from updated, unnest($8::text[], $9::text[], $10::float8[]) as pending(hash, kind, expires)
  returning hash
)
select id from updated
`

function approvalFrom(row: GrantRow | undefined): Approval | undefined {
  if (row === undefined) return undefined
  return {
    id: row.id,
    grant: {
      principal: row.principal,
      code: row.code,
      generation: row.generation,
      revoked: row.revoked,
      rotates: row.rotates,
    },
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    challenge: row.challenge,
    codeExpires: row.code_expires,
  }
}

export async function storeApproval(db: Sql, approval: Approval, code: string): Promise<void> {
  await db.query(
    `insert into session.oauth_grant
      (id, principal, code, generation, revoked, rotates, client_id, redirect_uri, challenge, code_hash, code_expires)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      approval.id,
      approval.grant.principal,
      approval.grant.code,
      approval.grant.generation,
      approval.grant.revoked,
      approval.grant.rotates,
      approval.clientId,
      approval.redirectUri,
      approval.challenge,
      hashSecret(code),
      approval.codeExpires,
    ],
  )
}

export function newApprovalId(): string {
  return randomUUID()
}

export async function readApprovalByCode(db: Sql, code: string): Promise<Approval | undefined> {
  const result = await db.query<GrantRow>(`select ${columns} where code_hash = $1`, [hashSecret(code)])
  return approvalFrom(result.rows[0])
}

export async function readApproval(db: Sql, id: string): Promise<Approval | undefined> {
  const result = await db.query<GrantRow>(`select ${columns} where id = $1`, [id])
  return approvalFrom(result.rows[0])
}

export async function readToken(db: Sql, secret: string): Promise<TokenRow | undefined> {
  const result = await db.query<{
    hash: string
    grant_id: string
    generation: number
    kind: "access" | "refresh"
    expires: number | null
  }>("select hash, grant_id, generation, kind, expires from session.oauth_token where hash = $1", [hashSecret(secret)])
  const row = result.rows[0]
  if (row === undefined) return undefined
  return { hash: row.hash, grantId: row.grant_id, generation: row.generation, kind: row.kind, expires: row.expires }
}

function sameGrant(left: Grant, right: Grant): boolean {
  return (
    left.principal === right.principal &&
    left.code === right.code &&
    left.generation === right.generation &&
    left.revoked === right.revoked &&
    left.rotates === right.rotates
  )
}

export async function advance(
  db: Sql,
  id: string,
  command: Command,
  plan: { readonly issue: false } | { readonly issue: true; readonly now: number },
): Promise<Advance | undefined> {
  const minted = plan.issue
    ? { access: newSecret(), refresh: newSecret(), expires: plan.now + accessLifetime }
    : undefined
  let last: Advance | undefined
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const stored = await readApproval(db, id)
    if (stored === undefined) return undefined
    const result = oauth(stored.grant, command)
    const issuing = result.accepted ? minted : undefined
    if (issuing === undefined && sameGrant(stored.grant, result.grant)) {
      return { grant: result.grant, accepted: result.accepted }
    }
    last = { grant: stored.grant, accepted: false }
    const newRefresh = result.grant.generation !== stored.grant.generation
    const tokens =
      issuing === undefined
        ? []
        : [
            { hash: hashSecret(issuing.access), kind: "access", expires: issuing.expires },
            ...(newRefresh ? [{ hash: hashSecret(issuing.refresh), kind: "refresh", expires: null }] : []),
          ]
    const written = await db.query(writeSql, [
      id,
      result.grant.code,
      result.grant.generation,
      result.grant.revoked,
      stored.grant.code,
      stored.grant.generation,
      stored.grant.revoked,
      tokens.map((token) => token.hash),
      tokens.map((token) => token.kind),
      tokens.map((token) => token.expires),
      command.command === "exchange" && plan.issue && result.accepted ? plan.now : null,
      result.grant.rotates,
    ])
    if (written.rows.length > 0) {
      return {
        grant: result.grant,
        accepted: result.accepted,
        ...(issuing === undefined
          ? {}
          : { issued: { access: issuing.access, refresh: newRefresh ? issuing.refresh : undefined } }),
      }
    }
  }
  return last === undefined ? undefined : { ...last, lost: true }
}

type ConnectedGrant = {
  readonly id: string
  readonly name: string | null
  readonly redirect_uris: string[]
  readonly redirect_uri: string
  readonly connected: Date
}

const connectedGrantsSql = `
select g.id, c.name, c.redirect_uris, g.redirect_uri, g.connected
from session.oauth_grant g
join session.oauth_client c on c.id = g.client_id
where g.principal = $1 and g.code = 'used' and not g.revoked
order by g.connected desc, g.id desc
`

export async function connectedGrants(db: Sql, principal: string): Promise<readonly ConnectedGrant[]> {
  return (await db.query<ConnectedGrant>(connectedGrantsSql, [principal])).rows
}
