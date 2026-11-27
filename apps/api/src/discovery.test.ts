import { createHash } from "node:crypto"
import {
  Client,
  StreamableHTTPClientTransport,
  discoverAuthorizationServerMetadata,
  discoverOAuthProtectedResourceMetadata,
  extractResourceMetadataUrl,
} from "@modelcontextprotocol/client"
import { afterAll, beforeAll, expect, it } from "vitest"
import { ask, askForm, cookieFrom, postgresInfo, serve } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { readSignInMail } from "./account/testing/read-sign-in-mail.js"

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

it("answers HEAD on the MCP address like a POST without credentials", async () => {
  const head = await fetch(new URL("/mcp", base), { method: "HEAD" })
  const post = await fetch(new URL("/mcp", base), { method: "POST" })
  expect(head.status).toBe(401)
  expect(post.status).toBe(401)
  expect(head.headers.get("www-authenticate")).toBe(post.headers.get("www-authenticate"))
  expect(head.headers.get("www-authenticate")).toBe(
    'Bearer resource_metadata="https://resource.example/.well-known/oauth-protected-resource"',
  )
  expect(await head.text()).toBe("")
})

it("serves the resource metadata at the address under the MCP path too, and 404 for other well-known addresses", async () => {
  const root = await fetch(new URL("/.well-known/oauth-protected-resource", base))
  const byPath = await fetch(new URL("/.well-known/oauth-protected-resource/mcp", base))
  expect(byPath.status).toBe(200)
  expect(byPath.headers.get("content-type")).toContain("application/json")
  expect(await byPath.json()).toEqual(await root.json())
  for (const path of ["/.well-known/oauth-authorization-server/mcp", "/.well-known/openid-configuration"]) {
    expect((await fetch(new URL(path, base))).status).toBe(404)
  }
})

it("discovers the resource metadata from the MCP address alone, with no challenge to read", async () => {
  const localFetch: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    return fetch(new URL(url.pathname + url.search, base), init)
  }
  const found = await discoverOAuthProtectedResourceMetadata(resource, undefined, localFetch)
  expect(found).toMatchObject({ resource, authorization_servers: [publicOrigin] })
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
    client_id_metadata_document_supported: true,
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
    code: readSignInMail(mails[0]?.text ?? "").code,
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
    expect(tools.tools.find((tool) => tool.name === "airdesign_execute")?.annotations?.idempotentHint).toBe(false)
    expect(tools.tools.find((tool) => tool.name === "airdesign_get_app_state")?.annotations).toMatchObject({
      readOnlyHint: true,
      idempotentHint: true,
    })
    const created = await ask(base, "POST", "/doom/create", { deck: "discovery" }, cookie)
    expect(created.json).toMatchObject({ ok: true, deck: "discovery", rev: 1 })
    const listed = await sdk.callTool({ name: "airdesign_get_app_state", arguments: {} })
    expect(listed.isError).not.toBe(true)
    expect(listed.structuredContent).toEqual({
      ok: true,
      decks: [{ deck: "discovery", name: "Blank deck", rev: 1 }],
      openDeck: null,
      note: "No deck is open in an AirDesign tab.",
    })
    const read = await sdk.callTool({ name: "airdesign_execute", arguments: { deck: "discovery", script: "get()" } })
    expect(read.isError).not.toBe(true)
    expect((read.structuredContent as { result: unknown }).result).toMatchObject({ rev: 1, slides: ["s:3"] })
    const called = await sdk.callTool({
      name: "airdesign_execute",
      arguments: { deck: "discovery", script: 'update({ target: "s:3.title", text: "Connected" })' },
    })
    expect(called.isError).not.toBe(true)
    expect(called.structuredContent).toMatchObject({ ok: true, deck: "discovery", rev: 2 })
    const again = await sdk.callTool({
      name: "airdesign_execute",
      arguments: { deck: "discovery", script: "get().layers" },
    })
    expect((again.structuredContent as { result: string }).result).toContain('text="Connected"')
    const saved = await ask(base, "POST", "/doom/open", { deck: "discovery" }, cookie)
    expect(saved.json).toMatchObject({ rev: 2 })
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
