import { randomBytes } from "node:crypto"
import { oauthRoutes } from "@airdesign/catalog"
import type { Pool } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { bearerPrincipal, DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { ask, askForm, postgresInfo, serve, signInByCode, verifierPair } from "./testing/harness.js"

const start = 1_000_000
const loopback = "http://127.0.0.1:8123/cb"
const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const mails: Mail[] = []
const closers: (() => Promise<void>)[] = []
let clock = start
let base = ""
let session: Sql

type Pair = { readonly access: string; readonly refresh: string }
type Reply = Awaited<ReturnType<typeof ask>>

async function served(wrap?: (pool: Pool) => Pool): Promise<{ readonly base: string; readonly session: Sql }> {
  const info = await postgresInfo()
  const raw = openPool(info.session, "oauth-tokens-session")
  const deck = openPool(info.deck, "oauth-tokens-deck")
  const listen = new DeckListen(info.listen)
  const api = await serve({
    ...origins,
    session: wrap === undefined ? raw : wrap(raw),
    deck,
    listen,
    now: () => clock,
    send: async (mail) => {
      mails.push(mail)
    },
  })
  closers.push(
    () => api.close(),
    () => listen.close(),
    () => raw.end(),
    () => deck.end(),
  )
  return { base: api.base, session: raw }
}

beforeAll(async () => {
  ;({ base, session } = await served())
})

afterAll(async () => {
  for (const close of closers.reverse()) await close()
})

beforeEach(() => {
  clock = start
})

function pairOf(reply: Reply): Pair {
  const body = reply.json as { access_token?: string; refresh_token?: string }
  if (body.access_token === undefined || body.refresh_token === undefined) throw new Error(reply.text)
  return { access: body.access_token, refresh: body.refresh_token }
}

async function register(body: object): Promise<string> {
  const reply = await ask(base, "POST", oauthRoutes.register.path, body)
  const id = (reply.json as { client_id?: string }).client_id
  if (reply.status !== 201 || id === undefined) throw new Error(reply.text)
  return id
}

async function approved(
  clientId: string,
  redirect: string,
): Promise<{ readonly code: string; readonly verifier: string }> {
  const cookie = await signInByCode(base, mails, `tokens${randomBytes(4).toString("hex")}@example.com`)
  const { verifier, challenge } = verifierPair()
  const reply = await ask(
    base,
    "POST",
    oauthRoutes.approve.path,
    { client_id: clientId, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: "S256" },
    cookie,
  )
  const code = new URL((reply.json as { redirect: string }).redirect).searchParams.get("code") ?? ""
  return { code, verifier }
}

function token(fields: Record<string, string>, headers?: Record<string, string>, at = base): Promise<Reply> {
  return askForm(at, oauthRoutes.token.path, fields, headers)
}

async function connected(body: object, redirect: string): Promise<{ readonly clientId: string; readonly pair: Pair }> {
  const clientId = await register(body)
  const { code, verifier } = await approved(clientId, redirect)
  const fields = { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirect }
  return { clientId, pair: pairOf(await token({ ...fields, client_id: clientId })) }
}

async function works(access: string): Promise<boolean> {
  return (await bearerPrincipal(session, access, clock)).ok
}

async function grantOf(clientId: string): Promise<Record<string, unknown>> {
  const result = await session.query<Record<string, unknown>>(
    "select * from session.oauth_grant where client_id = $1",
    [clientId],
  )
  expect(result.rows).toHaveLength(1)
  return result.rows[0] ?? {}
}

describe("the token client id by HTTP Basic", () => {
  const basic = (clientId: string, secret = "") => ({
    authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
  })

  it("exchanges a code and refreshes with the client id only in the header", async () => {
    const clientId = await register({ redirect_uris: [loopback] })
    const { code, verifier } = await approved(clientId, loopback)
    const fields = { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: loopback }
    const pair = pairOf(await token(fields, basic(clientId)))
    expect(await works(pair.access)).toBe(true)
    const refreshed = await token(
      { grant_type: "refresh_token", refresh_token: pair.refresh },
      basic(clientId, "ignored"),
    )
    expect(refreshed.status).toBe(200)
    expect(await works(pairOf(refreshed).access)).toBe(true)
  })

  it("refuses a header client id that disagrees with the form, and changes nothing", async () => {
    const { clientId, pair } = await connected({ redirect_uris: [loopback] }, loopback)
    const stranger = await register({ redirect_uris: [loopback] })
    const fields = { grant_type: "refresh_token", refresh_token: pair.refresh, client_id: clientId }
    const reply = await token(fields, basic(stranger))
    expect(reply.status).toBe(400)
    expect(reply.json).toEqual({ error: "invalid_request" })
    expect(await grantOf(clientId)).toMatchObject({ generation: 1, revoked: false })
    expect(await works(pair.access)).toBe(true)
  })
})
