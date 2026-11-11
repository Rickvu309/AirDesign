import type { readApprovalRequest, readClientRequest } from "@airdesign/catalog"
import { openGrant } from "@airdesign/oauth"

import type { Answer } from "./answer.js"
import { readClient, screenFor, type Client } from "./clients.js"
import { newApprovalId, storeApproval } from "./grants.js"
import type { Sql } from "./pool.js"
import { ownResource, readUrl } from "./resource.js"
import { newSecret } from "./secrets.js"

export const codeLifetime = 600_000

type ClientRequest = Extract<ReturnType<typeof readClientRequest>, { ok: true }>
type ApprovalRequest = Extract<ReturnType<typeof readApprovalRequest>, { ok: true }>
type Refusal = "client" | "redirect" | "resource"

function refusal(refused: Refusal): Answer {
  return { status: 400, body: { ok: false, refusal: refused } }
}

async function checkedClient(
  db: Sql,
  request: ClientRequest,
  own: string,
): Promise<{ readonly client: Client; readonly redirectUri: string; readonly target: URL } | Answer> {
  const client = await readClient(db, request.clientId)
  if (client === undefined) return refusal("client")
  if (!client.redirectUris.includes(request.redirectUri)) return refusal("redirect")
  const target = readUrl(request.redirectUri)
  if (target === undefined) return refusal("redirect")
  if (!ownResource(request.resource, own)) return refusal("resource")
  return { client, redirectUri: request.redirectUri, target }
}

function isAnswer(value: { readonly client: Client } | Answer): value is Answer {
  return "status" in value
}

export async function describeClient(db: Sql, request: ClientRequest, own: string): Promise<Answer> {
  const checked = await checkedClient(db, request, own)
  if (isAnswer(checked)) return checked
  return {
    status: 200,
    body: {
      ok: true,
      client_name: checked.client.name,
      screen: screenFor(checked.client.name, checked.redirectUri),
      redirect_host: checked.target.host,
    },
  }
}

export async function approve(
  db: Sql,
  request: ApprovalRequest,
  email: string,
  own: string,
  now: number,
): Promise<Answer> {
  const checked = await checkedClient(db, request, own)
  if (isAnswer(checked)) return checked
  const code = newSecret()
  await storeApproval(
    db,
    {
      id: newApprovalId(),
      grant: openGrant(email),
      clientId: checked.client.id,
      redirectUri: checked.redirectUri,
      challenge: request.challenge,
      codeExpires: now + codeLifetime,
    },
    code,
  )
  const { target } = checked
  target.searchParams.set("code", code)
  if (request.state === undefined) target.searchParams.delete("state")
  else target.searchParams.set("state", request.state)
  return { status: 200, body: { ok: true, redirect: target.href } }
}
