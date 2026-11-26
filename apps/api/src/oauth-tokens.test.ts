import { randomBytes } from "node:crypto"
import { oauthRoutes } from "@airdesign/catalog"
import type { Pool } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { bearerPrincipal, DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { geminiCallback, geminiRegistration } from "./oauth/testing/gemini-registration.js"
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

function refresh(clientId: string, secret: string, at = base): Promise<Reply> {
  return token({ grant_type: "refresh_token", refresh_token: secret, client_id: clientId }, undefined, at)
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

function holdingTwoWrites(pool: Pool): Pool {
  let arrived = 0
  let openGate = () => {}
  const bothRead = new Promise<void>((resolve) => {
    openGate = resolve
  })
  return new Proxy(pool, {
    get(target, name) {
      if (name === "query") {
        return async (text: unknown, ...rest: unknown[]) => {
          if (String(text).includes("update session.oauth_grant")) {
            arrived += 1
            if (arrived === 2) openGate()
            await bothRead
          }
          return Reflect.apply(target.query, target, [text, ...rest]) as unknown
        }
      }
      const value: unknown = Reflect.get(target, name, target)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

describe("a Gemini grant keeps its refresh token", () => {
  const gemini = () => connected(geminiRegistration, geminiCallback)

  it("answers the same refresh token and a new access token on every refresh, and every access token works", async () => {
    const { clientId, pair } = await gemini()
    expect(await grantOf(clientId)).toMatchObject({ rotates: false })
    const accesses = [pair.access]
    for (let step = 0; step < 3; step += 1) {
      clock += 60_000
      const next = pairOf(await refresh(clientId, pair.refresh))
      expect(next.refresh).toBe(pair.refresh)
      expect(accesses).not.toContain(next.access)
      accesses.push(next.access)
    }
    const grant = await grantOf(clientId)
    expect(grant).toMatchObject({ generation: 1, revoked: false })
    for (const access of accesses) expect(await works(access)).toBe(true)
    const rows = await session.query("select 1 from session.oauth_token where grant_id = $1", [grant.id])
    expect(rows.rowCount).toBe(5)
  })

  it("lets each access token run out at its own hour", async () => {
    const { clientId, pair } = await gemini()
    clock = start + 1_800_000
    const later = pairOf(await refresh(clientId, pair.refresh))
    clock = start + 3_600_000
    expect(await works(pair.access)).toBe(false)
    expect(await works(later.access)).toBe(true)
    clock = start + 5_400_000
    expect(await works(later.access)).toBe(false)
    expect((await refresh(clientId, pair.refresh)).status).toBe(200)
  })

  it("answers two refreshes of one token at once, and the grant stays live", async () => {
    const { clientId, pair } = await gemini()
    const side = await served(holdingTwoWrites)
    const [left, right] = await Promise.all([
      refresh(clientId, pair.refresh, side.base),
      refresh(clientId, pair.refresh, side.base),
    ])
    expect([left.status, right.status]).toEqual([200, 200])
    for (const reply of [left, right]) {
      expect(pairOf(reply).refresh).toBe(pair.refresh)
      expect(await works(pairOf(reply).access)).toBe(true)
    }
    expect(await grantOf(clientId)).toMatchObject({ generation: 1, revoked: false })
  })

  it("ends at revoke: every access token and the refresh token stop", async () => {
    const { clientId, pair } = await gemini()
    const next = pairOf(await refresh(clientId, pair.refresh))
    expect((await askForm(base, oauthRoutes.revoke.path, { token: pair.refresh })).status).toBe(200)
    expect(await grantOf(clientId)).toMatchObject({ generation: 1, revoked: true })
    expect(await works(pair.access)).toBe(false)
    expect(await works(next.access)).toBe(false)
    expect((await refresh(clientId, pair.refresh)).json).toEqual({ error: "invalid_grant" })
  })

  it.each([
    ["Claude", { redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] }],
    ["Claude Code", { redirect_uris: [loopback], client_name: "Claude Code" }],
    ["Codex", { redirect_uris: [loopback], client_name: "Codex" }],
    ["any other client", { redirect_uris: [loopback] }],
  ])("leaves %s rotating, and its reuse still revokes the grant", async (_kind, body) => {
    const { clientId, pair: first } = await connected(body, body.redirect_uris[0] ?? "")
    expect(await grantOf(clientId)).toMatchObject({ rotates: true })
    const second = pairOf(await refresh(clientId, first.refresh))
    expect(second.refresh).not.toBe(first.refresh)
    expect(await works(first.access)).toBe(false)
    expect((await refresh(clientId, first.refresh)).json).toEqual({ error: "invalid_grant" })
    expect(await grantOf(clientId)).toMatchObject({ generation: 2, revoked: true })
    expect(await works(second.access)).toBe(false)
  })
})
