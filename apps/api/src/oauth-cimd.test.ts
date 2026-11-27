import { randomBytes } from "node:crypto"
import { oauthRoutes } from "@airdesign/catalog"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { bearerPrincipal, DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { documentBytes, servedDocuments } from "./oauth/testing/served-documents.js"
import { ask, askForm, postgresInfo, serve, signInByCode, testResource, verifierPair } from "./testing/harness.js"

const start = 1_000_000
const callback = "http://127.0.0.1:8123/cb"
const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const documents = servedDocuments({ "agent.example.com": ["93.184.216.34"], "intranet.example.com": ["10.0.0.5"] })
const mails: Mail[] = []
const closers: (() => Promise<void>)[] = []
let clock = start
let base = ""
let session: Sql

type Pair = { readonly access: string; readonly refresh: string }
type Reply = Awaited<ReturnType<typeof ask>>

beforeAll(async () => {
  const info = await postgresInfo()
  session = openPool(info.session, "oauth-cimd-session")
  const deck = openPool(info.deck, "oauth-cimd-deck")
  const listen = new DeckListen(info.listen)
  const api = await serve({
    ...origins,
    session,
    deck,
    listen,
    now: () => clock,
    clientNet: documents.net,
    send: async (mail) => {
      mails.push(mail)
    },
  })
  base = api.base
  closers.push(
    () => api.close(),
    () => listen.close(),
    () => session.end(),
    () => deck.end(),
  )
})

afterAll(async () => {
  for (const close of closers.reverse()) await close()
})

beforeEach(() => {
  clock = start
})

function documentAt(redirects: readonly string[] = [callback], name = "Agent", host = "agent.example.com"): string {
  const id = `https://${host}/${randomBytes(4).toString("hex")}/client.json`
  documents.pages.set(id, {
    status: 200,
    body: documentBytes({
      client_id: id,
      client_name: name,
      redirect_uris: redirects,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  })
  return id
}

const asks = (id: string) => documents.asked.filter((each) => each.url === id).length

function sign(): Promise<string> {
  return signInByCode(base, mails, `cimd${randomBytes(4).toString("hex")}@example.com`)
}

function describeFor(cookie: string, clientId: string, redirectUri = callback): Promise<Reply> {
  return ask(
    base,
    "POST",
    oauthRoutes.client.path,
    { client_id: clientId, redirect_uri: redirectUri, resource: testResource },
    cookie,
  )
}

function approveFor(cookie: string, clientId: string, challenge: string, redirectUri = callback): Promise<Reply> {
  return ask(
    base,
    "POST",
    oauthRoutes.approve.path,
    { client_id: clientId, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: "S256" },
    cookie,
  )
}

async function codeFor(cookie: string, clientId: string, challenge: string, redirectUri = callback): Promise<string> {
  const reply = await approveFor(cookie, clientId, challenge, redirectUri)
  const redirect = (reply.json as { redirect?: string }).redirect
  if (redirect === undefined) throw new Error(reply.text)
  return new URL(redirect).searchParams.get("code") ?? ""
}

function exchange(clientId: string, code: string, verifier: string, redirectUri = callback): Promise<Reply> {
  return askForm(base, oauthRoutes.token.path, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  })
}

function rotate(clientId: string, secret: string): Promise<Reply> {
  return askForm(base, oauthRoutes.token.path, {
    grant_type: "refresh_token",
    refresh_token: secret,
    client_id: clientId,
  })
}

function pairOf(reply: Reply): Pair {
  const body = reply.json as { access_token?: string; refresh_token?: string }
  if (body.access_token === undefined || body.refresh_token === undefined) throw new Error(reply.text)
  return { access: body.access_token, refresh: body.refresh_token }
}

async function works(access: string): Promise<boolean> {
  return (await bearerPrincipal(session, access, clock)).ok
}

async function stored(clientId: string): Promise<unknown[]> {
  const found = await session.query("select name, redirect_uris from session.oauth_client where id = $1", [clientId])
  return found.rows
}

async function grants(clientId: string): Promise<number> {
  const found = await session.query<{ count: number }>(
    "select count(*)::int as count from session.oauth_grant where client_id = $1",
    [clientId],
  )
  return found.rows[0]?.count ?? -1
}

describe("a client named by its metadata document", () => {
  it("connects with PKCE S256, and its tokens work until revoked", async () => {
    const cookie = await sign()
    const clientId = documentAt()
    const described = await describeFor(cookie, clientId)
    expect(described.json).toEqual({ ok: true, client_name: "Agent", screen: "other", redirect_host: "127.0.0.1:8123" })
    const { verifier, challenge } = verifierPair()
    const pair = pairOf(await exchange(clientId, await codeFor(cookie, clientId, challenge), verifier))
    expect(await works(pair.access)).toBe(true)
    const rotated = pairOf(await rotate(clientId, pair.refresh))
    expect(await works(rotated.access)).toBe(true)
    expect((await askForm(base, oauthRoutes.revoke.path, { token: rotated.refresh })).status).toBe(200)
    expect(await works(rotated.access)).toBe(false)
    expect((await rotate(clientId, rotated.refresh)).json).toEqual({ error: "invalid_grant" })
    expect(await stored(clientId)).toEqual([{ name: "Agent", redirect_uris: [callback] }])
    expect(asks(clientId)).toBe(1)
  })

  it("takes a portless loopback redirect on the port the agent opened, as Claude Code's document asks", async () => {
    const cookie = await sign()
    const clientId = documentAt(["http://localhost/callback", "http://127.0.0.1/callback"], "Claude Code")
    const used = "http://localhost:54321/callback"
    expect((await describeFor(cookie, clientId, used)).json).toEqual({
      ok: true,
      client_name: "Claude Code",
      screen: "claude-code",
      redirect_host: "localhost:54321",
    })
    const { verifier, challenge } = verifierPair()
    const code = await codeFor(cookie, clientId, challenge, used)
    expect(pairOf(await exchange(clientId, code, verifier, used)).access).toBeTruthy()
    const elsewhere = await exchange(clientId, code, verifier, "http://localhost:54322/callback")
    expect(elsewhere.json).toEqual({ error: "invalid_grant" })
  })

  it("refuses a document that names another client, a redirect it does not list, and a private host", async () => {
    const cookie = await sign()
    const liar = documentAt()
    documents.pages.set(liar, {
      status: 200,
      body: documentBytes({ client_id: documentAt(), client_name: "Liar", redirect_uris: [callback] }),
    })
    const listed = documentAt(["https://agent.example.com/cb"])
    const inside = documentAt([callback], "Inside", "intranet.example.com")
    const large = documentAt()
    documents.pages.set(large, { status: 200, length: 5_120, body: documentBytes({}) })
    const plain = "http://agent.example.com/x/client.json"
    expect((await describeFor(cookie, liar)).json).toEqual({ ok: false, refusal: "client" })
    expect((await describeFor(cookie, listed)).json).toEqual({ ok: false, refusal: "redirect" })
    expect((await describeFor(cookie, inside)).json).toEqual({ ok: false, refusal: "client" })
    expect((await describeFor(cookie, large)).json).toEqual({ ok: false, refusal: "client" })
    expect((await describeFor(cookie, plain)).json).toEqual({ ok: false, refusal: "client" })
    expect((await approveFor(cookie, liar, verifierPair().challenge)).json).toEqual({ ok: false, refusal: "client" })
    expect(asks(inside) + asks(plain)).toBe(0)
    for (const refused of [liar, inside, large, plain]) expect(await stored(refused)).toEqual([])
    for (const refused of [liar, listed, inside, large, plain]) expect(await grants(refused)).toBe(0)
  })

  it("asks again for a document five minutes old, and follows what changed", async () => {
    const cookie = await sign()
    const clientId = documentAt()
    expect((await describeFor(cookie, clientId)).status).toBe(200)
    clock += 299_999
    expect((await describeFor(cookie, clientId)).status).toBe(200)
    expect(asks(clientId)).toBe(1)
    const moved = ["https://agent.example.com/cb"]
    documents.pages.set(clientId, {
      status: 200,
      body: documentBytes({ client_id: clientId, client_name: "Renamed", redirect_uris: moved }),
    })
    clock += 1
    expect((await describeFor(cookie, clientId)).json).toEqual({ ok: false, refusal: "redirect" })
    expect(asks(clientId)).toBe(2)
    expect(await stored(clientId)).toEqual([{ name: "Renamed", redirect_uris: moved }])
  })

  it("keeps an approved agent connected when its document later fails, and refuses a new approval", async () => {
    const cookie = await sign()
    const clientId = documentAt()
    const { verifier, challenge } = verifierPair()
    const pair = pairOf(await exchange(clientId, await codeFor(cookie, clientId, challenge), verifier))
    documents.pages.set(clientId, { status: 503 })
    clock += 300_000
    expect((await describeFor(cookie, clientId)).json).toEqual({ ok: false, refusal: "client" })
    expect((await approveFor(cookie, clientId, verifierPair().challenge)).json).toEqual({
      ok: false,
      refusal: "client",
    })
    expect(await works(pairOf(await rotate(clientId, pair.refresh)).access)).toBe(true)
  })

  it("never fetches a document at the token endpoint", async () => {
    const clientId = documentAt()
    const reply = await exchange(clientId, "code", verifierPair().verifier)
    expect([reply.status, reply.json]).toEqual([400, { error: "invalid_client" }])
    expect((await rotate(clientId, "refresh")).json).toEqual({ error: "invalid_client" })
    expect(asks(clientId)).toBe(0)
  })
})
