import { accountRoutes, mcpRoutes, oauthRoutes } from "@airdesign/catalog"
import { Client, StreamableHTTPClientTransport, extractResourceMetadataUrl } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, expect, it } from "vitest"

import { DeckListen, openPool, type Mail } from "./index.js"
import { geminiCallback, geminiRegistration } from "./oauth/testing/gemini-registration.js"
import { ask, postgresInfo, serve, signInByCode, verifierPair } from "./testing/harness.js"

const publicOrigin = "https://studio.example"
const resource = `${publicOrigin}/mcp`
const mails: Mail[] = []
let base = ""
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "gemini-session")
  const deck = openPool(info.deck, "gemini-deck")
  const listen = new DeckListen(info.listen)
  const served = await serve({
    session,
    deck,
    listen,
    resource,
    publicOrigin,
    siteOrigin: "https://site.example",
    send: async (mail) => {
      mails.push(mail)
    },
  })
  base = served.base
  close = async () => {
    await served.close()
    await listen.close()
    await session.end()
    await deck.end()
  }
})

afterAll(async () => {
  await close()
})

function google(address: string, init: RequestInit = {}, agent = "Google"): Promise<Response> {
  const url = new URL(address, publicOrigin)
  expect(url.origin).toBe(publicOrigin)
  const headers = new Headers(init.headers)
  headers.set("user-agent", agent)
  return fetch(new URL(url.pathname + url.search, base), { ...init, headers })
}

const googleFetch: typeof fetch = (input, init) =>
  google(input instanceof Request ? input.url : input.toString(), init ?? {})

function tokenForm(fields: Record<string, string>, clientId: string): Promise<Response> {
  return google(
    oauthRoutes.token.path,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${clientId}:`).toString("base64")}`,
      },
      body: new URLSearchParams(fields),
    },
    "OpenAuth",
  )
}

async function tokens(reply: Response): Promise<{ readonly access: string; readonly refresh: string }> {
  expect(reply.status).toBe(200)
  const body = (await reply.json()) as { access_token: string; refresh_token: string; expires_in: number }
  expect(body.expires_in).toBe(3600)
  return { access: body.access_token, refresh: body.refresh_token }
}

async function listedDecks(access: string): Promise<unknown> {
  const sdk = new Client({ name: "gemini", version: "1" })
  try {
    await sdk.connect(
      new StreamableHTTPClientTransport(new URL(resource), {
        fetch: googleFetch,
        requestInit: { headers: { authorization: `Bearer ${access}` } },
      }),
    )
    return (await sdk.callTool({ name: "airdesign_list_decks", arguments: {} })).structuredContent
  } finally {
    await sdk.close()
  }
}

async function refusesCall(access: string): Promise<boolean> {
  const reply = await google(mcpRoutes.mcp.path, {
    method: "POST",
    headers: {
      authorization: `Bearer ${access}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  })
  return reply.status === 401 && (reply.headers.get("www-authenticate") ?? "").includes('error="invalid_token"')
}

it("signs Gemini in from HEAD /mcp to revoke, and keeps it connected across refreshes", async () => {
  const probe = await google(mcpRoutes.mcp.path, { method: "HEAD" })
  expect(probe.status).toBe(401)
  const metadataUrl = extractResourceMetadataUrl(probe)
  expect(metadataUrl?.href).toBe(`${publicOrigin}/.well-known/oauth-protected-resource`)

  const byPath = await google(mcpRoutes.resourceMetadataByPath.path)
  expect(byPath.status).toBe(200)
  const protectedResource = (await byPath.json()) as { resource: string; authorization_servers: string[] }
  expect(protectedResource).toEqual(await (await google(metadataUrl?.href ?? "")).json())
  expect(protectedResource.resource).toBe(resource)
  expect((await google("/.well-known/oauth-authorization-server/mcp")).status).toBe(404)
  const metadata = (await (await google(mcpRoutes.authorizationMetadata.path)).json()) as Record<string, string>
  expect(metadata.issuer).toBe(protectedResource.authorization_servers[0])

  const registered = await google(
    new URL(metadata.registration_endpoint ?? "").pathname,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(geminiRegistration) },
    "OpenAuth",
  )
  expect(registered.status).toBe(201)
  const client = (await registered.json()) as { client_id: string; token_endpoint_auth_method: string }
  expect(client.token_endpoint_auth_method).toBe("none")

  const cookie = await signInByCode(base, mails, "gemini-person@example.com")
  const described = await ask(
    base,
    "POST",
    oauthRoutes.client.path,
    { client_id: client.client_id, redirect_uri: geminiCallback, resource },
    cookie,
  )
  expect(described.json).toMatchObject({ ok: true, client_name: "Google", screen: "gemini" })
  const state = Array.from({ length: 2400 }, (_, index) => "AZaz09-_."[index % 9]).join("")
  const { verifier, challenge } = verifierPair()
  const approved = await ask(
    base,
    "POST",
    oauthRoutes.approve.path,
    {
      client_id: client.client_id,
      redirect_uri: geminiCallback,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      resource,
    },
    cookie,
  )
  const back = new URL((approved.json as { redirect: string }).redirect)
  expect(`${back.origin}${back.pathname}`).toBe(geminiCallback)
  expect(back.searchParams.get("state")).toBe(state)

  const first = await tokens(
    await tokenForm(
      {
        grant_type: "authorization_code",
        code: back.searchParams.get("code") ?? "",
        code_verifier: verifier,
        redirect_uri: geminiCallback,
        resource,
      },
      client.client_id,
    ),
  )
  const listed = await ask(base, "POST", accountRoutes.agents.path, {}, cookie)
  expect((listed.json as { agents: unknown[] }).agents).toMatchObject([{ name: "Google", agent: "gemini" }])

  const sdk = new Client({ name: "gemini", version: "1" })
  await sdk.connect(
    new StreamableHTTPClientTransport(new URL(resource), {
      fetch: googleFetch,
      requestInit: { headers: { authorization: `Bearer ${first.access}` } },
    }),
  )
  const tools = (await sdk.listTools()).tools.map((tool) => tool.name)
  await sdk.close()
  expect(tools).toContain("airdesign_list_decks")
  expect(tools).toContain("airdesign_edit_deck")

  const refreshed = { grant_type: "refresh_token", refresh_token: first.refresh, resource }
  const second = await tokens(await tokenForm(refreshed, client.client_id))
  const third = await tokens(await tokenForm(refreshed, client.client_id))
  expect(second.refresh).toBe(first.refresh)
  expect(third.refresh).toBe(first.refresh)
  expect(new Set([first.access, second.access, third.access]).size).toBe(3)

  const empty = { ok: true, decks: [], note: "Your decks." }
  for (const access of [first.access, second.access, third.access]) {
    expect(await listedDecks(access)).toEqual(empty)
  }
  const signedHead = await google(mcpRoutes.mcp.path, {
    method: "HEAD",
    headers: { authorization: `Bearer ${third.access}` },
  })
  expect(signedHead.status).toBe(405)

  const revoked = await google(
    oauthRoutes.revoke.path,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: first.refresh }),
    },
    "OpenAuth",
  )
  expect(revoked.status).toBe(200)
  for (const access of [first.access, second.access, third.access]) expect(await refusesCall(access)).toBe(true)
  const after = await tokenForm(refreshed, client.client_id)
  expect(after.status).toBe(400)
  expect(await after.json()).toEqual({ error: "invalid_grant" })
  const gone = await ask(base, "POST", accountRoutes.agents.path, {}, cookie)
  expect((gone.json as { agents: unknown[] }).agents).toEqual([])
})
