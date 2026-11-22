import type { TokenRequest } from "@airdesign/catalog"
import { oauth } from "@airdesign/oauth"

import type { Answer } from "../platform/answer.js"
import { readClient } from "./clients.js"
import {
  accessLifetime,
  advance,
  readApproval,
  readApprovalByCode,
  readToken,
  type Advance,
  type Issued,
} from "./grants.js"
import type { Sql } from "../platform/pool.js"
import { ownResource } from "../platform/resource.js"
import { challengeOf, sameSecret } from "../platform/secrets.js"

export type TokenHost = {
  readonly db: Sql
  readonly own: string
  readonly now: number
}

export type Bearer = { readonly ok: true; readonly principal: string; readonly grant: string } | { readonly ok: false }

const verifierPattern = /^[A-Za-z0-9._~-]{43,128}$/

function failure(error: string): Answer {
  return { status: 400, body: { error } }
}

function unavailable(): Answer {
  return { status: 503, body: { error: "temporarily_unavailable" } }
}

function grantAnswer(advanced: Advance | undefined): Answer {
  if (advanced?.lost === true) return unavailable()
  if (advanced === undefined || !advanced.accepted || advanced.issued === undefined) return failure("invalid_grant")
  return issuedAnswer(advanced.issued)
}

function issuedAnswer(issued: Issued): Answer {
  return {
    status: 200,
    body: {
      access_token: issued.access,
      token_type: "Bearer",
      expires_in: accessLifetime / 1000,
      refresh_token: issued.refresh,
    },
  }
}

async function exchangeCode(
  host: TokenHost,
  request: Extract<TokenRequest, { grant: "authorization_code" }>,
): Promise<Answer> {
  const { code, verifier, clientId, redirectUri, resource } = request
  if ((await readClient(host.db, clientId)) === undefined) return failure("invalid_client")
  if (!ownResource(resource, host.own)) return failure("invalid_target")
  const approval = await readApprovalByCode(host.db, code)
  if (approval === undefined) return failure("invalid_grant")
  if (approval.clientId !== clientId || approval.redirectUri !== redirectUri) return failure("invalid_grant")
  if (host.now >= approval.codeExpires) return failure("invalid_grant")
  if (!verifierPattern.test(verifier) || !sameSecret(challengeOf(verifier), approval.challenge)) {
    return failure("invalid_grant")
  }
  const advanced = await advance(host.db, approval.id, { command: "exchange" }, { issue: true, now: host.now })
  if (advanced !== undefined && advanced.lost !== true && !advanced.accepted && advanced.grant.code === "used") {
    const revoked = await advance(host.db, approval.id, { command: "revoke" }, { issue: false })
    if (revoked?.lost === true) return unavailable()
  }
  return grantAnswer(advanced)
}

async function refresh(host: TokenHost, request: Extract<TokenRequest, { grant: "refresh_token" }>): Promise<Answer> {
  const { secret, clientId, resource } = request
  if ((await readClient(host.db, clientId)) === undefined) return failure("invalid_client")
  if (!ownResource(resource, host.own)) return failure("invalid_target")
  const token = await readToken(host.db, secret)
  if (token === undefined || token.kind !== "refresh") return failure("invalid_grant")
  const approval = await readApproval(host.db, token.grantId)
  if (approval === undefined || approval.clientId !== clientId) return failure("invalid_grant")
  const advanced = await advance(
    host.db,
    token.grantId,
    { command: "rotate", generation: token.generation },
    { issue: true, now: host.now },
  )
  return grantAnswer(advanced)
}

export async function tokenAnswer(host: TokenHost, request: TokenRequest): Promise<Answer> {
  if (request.grant === "authorization_code") return exchangeCode(host, request)
  return refresh(host, request)
}

export async function revokeToken(db: Sql, secret: string | undefined): Promise<Answer> {
  if (secret === undefined) return { status: 200, body: {} }
  const token = await readToken(db, secret)
  if (token === undefined) return { status: 200, body: {} }
  const revoked = await advance(db, token.grantId, { command: "revoke" }, { issue: false })
  if (revoked?.lost === true) return unavailable()
  return { status: 200, body: {} }
}

export async function bearerPrincipal(db: Sql, secret: string, now: number): Promise<Bearer> {
  const token = await readToken(db, secret)
  if (token === undefined || token.kind !== "access") return { ok: false }
  if (token.expires === null || now >= token.expires) return { ok: false }
  const approval = await readApproval(db, token.grantId)
  if (approval === undefined) return { ok: false }
  const result = oauth(approval.grant, { command: "call", generation: token.generation })
  if (!result.accepted) return { ok: false }
  return { ok: true, principal: result.grant.principal, grant: token.grantId }
}
