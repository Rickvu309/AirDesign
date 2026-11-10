import { openGrant } from "@airdesign/oauth"

import type { Answer } from "./answer.js"
import { readClient, screenFor, type Client } from "./clients.js"
import { newApprovalId, storeApproval } from "./grants.js"
import type { Sql } from "./pool.js"
import { ownResource } from "./resource.js"
import { newSecret } from "./secrets.js"
import { storableText } from "./storable-text.js"

export const codeLifetime = 600_000
const challengePattern = /^[A-Za-z0-9_-]{43}$/

type Refusal = "field" | "client" | "redirect" | "resource" | "challenge"

function refusal(refused: Refusal): Answer {
  return { status: 400, body: { ok: false, refusal: refused } }
}

function bodyOf(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

async function checkedClient(
  db: Sql,
  body: Record<string, unknown>,
  own: string,
): Promise<{ readonly client: Client; readonly redirectUri: string } | Answer> {
  const { client_id: clientId, redirect_uri: redirectUri } = body
  if (!storableText(clientId) || !storableText(redirectUri)) return refusal("field")
  if (body.resource !== undefined && typeof body.resource === "string" && !storableText(body.resource)) {
    return refusal("field")
  }
  const client = await readClient(db, clientId)
  if (client === undefined) return refusal("client")
  if (!client.redirectUris.includes(redirectUri)) return refusal("redirect")
  if (!ownResource(body.resource, own)) return refusal("resource")
  return { client, redirectUri }
}

function isAnswer(value: { readonly client: Client } | Answer): value is Answer {
  return "status" in value
}

export async function describeClient(db: Sql, raw: unknown, own: string): Promise<Answer> {
  const body = bodyOf(raw)
  if (body === undefined) return refusal("field")
  const checked = await checkedClient(db, body, own)
  if (isAnswer(checked)) return checked
  return {
    status: 200,
    body: {
      ok: true,
      client_name: checked.client.name,
      screen: screenFor(checked.client.name, checked.redirectUri),
      redirect_host: new URL(checked.redirectUri).host,
    },
  }
}

export async function approve(db: Sql, raw: unknown, email: string, own: string, now: number): Promise<Answer> {
  const body = bodyOf(raw)
  if (body === undefined) return refusal("field")
  const checked = await checkedClient(db, body, own)
  if (isAnswer(checked)) return checked
  const { code_challenge: challenge, code_challenge_method: method, state } = body
  if (method !== "S256" || typeof challenge !== "string" || !challengePattern.test(challenge)) {
    return refusal("challenge")
  }
  if (state !== undefined && !storableText(state)) return refusal("field")
  const code = newSecret()
  await storeApproval(
    db,
    {
      id: newApprovalId(),
      grant: openGrant(email),
      clientId: checked.client.id,
      redirectUri: checked.redirectUri,
      challenge,
      codeExpires: now + codeLifetime,
    },
    code,
  )
  const target = new URL(checked.redirectUri)
  target.searchParams.set("code", code)
  if (state === undefined) target.searchParams.delete("state")
  else target.searchParams.set("state", state)
  return { status: 200, body: { ok: true, redirect: target.href } }
}
