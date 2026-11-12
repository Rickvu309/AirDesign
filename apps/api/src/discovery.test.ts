import { createHash } from "node:crypto"
import {
  Client,
  StreamableHTTPClientTransport,
  discoverAuthorizationServerMetadata,
  discoverOAuthProtectedResourceMetadata,
  extractResourceMetadataUrl,
} from "@modelcontextprotocol/client"
import { afterAll, beforeAll, expect, it } from "vitest"
import { ask, askForm, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

const resource = "https://resource.example/mcp"
const publicOrigin = "https://app.example"
let base = ""
let close = async () => {}
const mails: Mail[] = []

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session)
  const deck = openPool(info.deck)
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

it("discovers authorization from only the MCP address and calls a tool with its grant", async () => {
  const localFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    expect([new URL(resource).origin, publicOrigin]).toContain(url.origin)
    return fetch(new URL(url.pathname + url.search, base), init)
  }
  const denied = await localFetch(resource, { method: "POST" })
  expect(denied.status).toBe(401)
  const metadataUrl = extractResourceMetadataUrl(denied)
  expect(metadataUrl?.href).toBe("https://resource.example/.well-known/oauth-protected-resource")
  if (metadataUrl === undefined) throw new Error("resource metadata")
  const protectedResource = await discoverOAuthProtectedResourceMetadata(
    resource,
    { resourceMetadataUrl: metadataUrl },
    localFetch,
  )
  expect(protectedResource.resource).toBe(resource)
  expect(protectedResource.authorization_servers).toEqual([publicOrigin])
  const issuer = protectedResource.authorization_servers?.[0]
  if (issuer === undefined) throw new Error("issuer")
  const metadata = await discoverAuthorizationServerMetadata(issuer, { fetchFn: localFetch })
  expect(metadata).toMatchObject({
    issuer: publicOrigin,
    authorization_endpoint: publicOrigin + "/oauth/authorize",
    token_endpoint: publicOrigin + "/oauth/token",
    registration_endpoint: publicOrigin + "/oauth/register",
    revocation_endpoint: publicOrigin + "/oauth/revoke",
    code_challenge_methods_supported: ["S256"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
  })
  if (!metadata?.registration_endpoint || !metadata.token_endpoint) throw new Error("endpoints")
  const callback = "http://127.0.0.1:8124/callback"
  const registration = await localFetch(metadata.registration_endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ redirect_uris: [callback], token_endpoint_auth_method: "none" }),
  })
  expect(registration.status).toBe(201)
  const client = await registration.json()
  if (typeof client !== "object" || client === null || !("client_id" in client) || typeof client.client_id !== "string")
    throw new Error("client")
  await ask(base, "POST", "/sign-in/email", { email: "discovery@example.com" })
  const signed = await ask(base, "POST", "/sign-in/code", {
    email: "discovery@example.com",
    code: mails[0]?.text.split("\n")[1],
  })
  const cookie = cookieFrom(signed.headers)
  const verifier = "a".repeat(43)
  const approved = await ask(
    base,
    "POST",
    "/oauth/approve",
    {
      client_id: client.client_id,
      redirect_uri: callback,
      resource,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      state: "discovery",
    },
    cookie,
  )
  const redirect = new URL((approved.json as { redirect: string }).redirect)
  expect(redirect.searchParams.get("state")).toBe("discovery")
  const token = await askForm(base, new URL(metadata.token_endpoint).pathname, {
    grant_type: "authorization_code",
    client_id: client.client_id,
    redirect_uri: callback,
    code: redirect.searchParams.get("code") ?? "",
    code_verifier: verifier,
    resource,
  })
  expect(token.status).toBe(200)
  const access = (token.json as { access_token: string }).access_token
  const sdk = new Client({ name: "discovery", version: "1" })
  try {
    await sdk.connect(
      new StreamableHTTPClientTransport(new URL(resource), {
        fetch: localFetch,
        requestInit: { headers: { authorization: `Bearer ${access}` } },
      }),
    )
    const tools = await sdk.listTools()
    expect(tools.tools.find((tool) => tool.name === "airdesign_edit_deck")?.annotations?.idempotentHint).toBe(false)
    expect(tools.tools.find((tool) => tool.name === "airdesign_read_deck")?.annotations).toMatchObject({
      readOnlyHint: true,
      idempotentHint: true,
    })
    expect(tools.tools.find((tool) => tool.name === "airdesign_list_decks")?.annotations).toMatchObject({
      readOnlyHint: true,
      idempotentHint: true,
    })
    await ask(base, "POST", "/decks/open", { deck: "discovery" }, cookie)
    await ask(base, "POST", "/decks/rename", { deck: "discovery", name: "Discovery" }, cookie)
    await ask(base, "POST", "/decks/open", { deck: "discovery-bin" }, cookie)
    const trashed = await ask(base, "POST", "/decks/trash", { deck: "discovery-bin" }, cookie)
    expect(trashed.status).toBe(200)
    const listed = await sdk.callTool({ name: "airdesign_list_decks", arguments: {} })
    expect(listed.isError).not.toBe(true)
    const rows = listed.structuredContent as { decks?: { deck: string; name: string; trash: boolean }[] }
    expect(rows.decks).toContainEqual({ deck: "discovery", name: "Discovery", trash: false })
    expect(rows.decks).toContainEqual({ deck: "discovery-bin", name: "", trash: true })
    expect(rows.decks).toHaveLength(2)
    const empty = await sdk.callTool({ name: "airdesign_read_deck", arguments: { deck: "discovery-bin" } })
    expect(empty.structuredContent).toEqual({ ok: true, revision: 0, elements: [] })
    const committed = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: "discovery", batch: [{ node: "258.7", value: "Before" }] },
      cookie,
    )
    expect(committed.status).toBe(200)
    const read = await sdk.callTool({ name: "airdesign_read_deck", arguments: { deck: "discovery" } })
    expect(read.isError).not.toBe(true)
    const seen = read.structuredContent as {
      revision?: number
      elements?: { node: string; slide: string; value: string; version: number }[]
    }
    expect(seen.elements).toEqual([{ node: "258.7", slide: "258", value: "Before", version: 1 }])
    const version = seen.elements?.[0]?.version
    if (seen.revision === undefined || version === undefined) throw new Error("read")
    const called = await sdk.callTool({
      name: "airdesign_edit_deck",
      arguments: {
        deck: "discovery",
        base: seen.revision,
        changes: [{ node: "258.7", value: "Connected", readAt: version }],
      },
    })
    expect(called.isError).not.toBe(true)
    expect(called.content).toContainEqual({ type: "text", text: "Landed revision 2." })
    const again = await sdk.callTool({ name: "airdesign_read_deck", arguments: { deck: "discovery" } })
    expect(again.isError).not.toBe(true)
    const landed = again.structuredContent as {
      elements?: { node: string; slide: string; value: string; version: number; closed?: boolean }[]
    }
    expect(landed.elements).toEqual([{ node: "258.7", slide: "258", value: "Connected", version: 2 }])
    const saved = await ask(base, "POST", "/decks/open", { deck: "discovery" }, cookie)
    expect(saved.json).toMatchObject({ revision: 2 })
  } finally {
    await sdk.close()
  }
  if (!("revocation_endpoint" in metadata) || typeof metadata.revocation_endpoint !== "string")
    throw new Error("revocation endpoint")
  const revoked = await askForm(base, new URL(metadata.revocation_endpoint).pathname, { token: access })
  expect(revoked.status).toBe(200)
  const invalid = await localFetch(resource, { method: "POST", headers: { authorization: `Bearer ${access}` } })
  expect(invalid.status).toBe(401)
  expect(extractResourceMetadataUrl(invalid)?.href).toBe(metadataUrl?.href)
})
