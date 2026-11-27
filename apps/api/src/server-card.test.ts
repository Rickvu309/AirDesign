import { mcpRoutes } from "@airdesign/catalog"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, expect, it } from "vitest"

import { postgresInfo, serve, signInByCode, testResource } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

const siteOrigin = "https://site.example"
const readHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET",
  "access-control-allow-headers": "Content-Type, If-None-Match",
  "access-control-expose-headers": "ETag",
}
const mails: Mail[] = []
let base = ""
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "card-session")
  const deck = openPool(info.deck, "card-deck")
  const listen = new DeckListen(info.listen)
  const served = await serve({
    session,
    deck,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin,
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

const card = () => new URL(mcpRoutes.serverCard.path, base)

function headersOf(response: Response, names: readonly string[]): Record<string, string | null> {
  return Object.fromEntries(names.map((name) => [name, response.headers.get(name)]))
}

async function connectedInfo(cookie: string) {
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await client.connect(
    new StreamableHTTPClientTransport(new URL(mcpRoutes.mcp.path, base), { requestInit: { headers: { cookie } } }),
  )
  try {
    return client.getServerVersion()
  } finally {
    await client.close()
  }
}

it("shows its server card to anyone before sign-in, with the MCP address and the server info it gives once connected", async () => {
  const stranger = await fetch(card(), { headers: { accept: "application/mcp-server-card+json" } })
  expect(stranger.status).toBe(200)
  expect(headersOf(stranger, ["content-type", "cache-control", ...Object.keys(readHeaders)])).toEqual({
    "content-type": "application/mcp-server-card+json",
    "cache-control": "public, max-age=3600",
    ...readHeaders,
  })
  const shown = await stranger.text()
  const cookie = await signInByCode(base, mails, "card@example.com")
  const info = await connectedInfo(cookie)
  expect(info).toMatchObject({
    name: "app.airdesign/studio",
    title: "AirDesign",
    description: "Make and edit slide decks without doing the design work.",
    websiteUrl: siteOrigin,
    icons: [{ src: "https://app.example/favicon-art.svg" }, { src: "https://app.example/apple-touch-icon.png" }],
  })
  expect(JSON.parse(shown)).toEqual({
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    ...info,
    remotes: [{ type: "streamable-http", url: testResource }],
  })
  expect(await (await fetch(card(), { headers: { cookie } })).text()).toBe(shown)
})

it("answers an unchanged server card with 304, and a browser's preflight with the card's read headers", async () => {
  const tag = (await fetch(card())).headers.get("etag") ?? ""
  expect(tag).toMatch(/^"[\w-]+"$/)
  for (const sent of [tag, `W/${tag}`, `"other", ${tag}`]) {
    const again = await fetch(card(), { headers: { "if-none-match": sent } })
    expect({ status: again.status, body: await again.text(), etag: again.headers.get("etag") }).toEqual({
      status: 304,
      body: "",
      etag: tag,
    })
  }
  expect((await fetch(card(), { headers: { "if-none-match": '"other"' } })).status).toBe(200)
  const head = await fetch(card(), { method: "HEAD" })
  expect({ status: head.status, body: await head.text(), etag: head.headers.get("etag") }).toEqual({
    status: 200,
    body: "",
    etag: tag,
  })
  const preflight = await fetch(card(), {
    method: "OPTIONS",
    headers: {
      origin: "https://host.example",
      "access-control-request-method": "GET",
      "access-control-request-headers": "if-none-match",
    },
  })
  expect(preflight.status).toBe(204)
  expect(headersOf(preflight, Object.keys(readHeaders))).toEqual(readHeaders)
  const posted = await fetch(card(), { method: "POST", body: "{}" })
  expect({ status: posted.status, allow: posted.headers.get("allow") }).toEqual({
    status: 405,
    allow: "GET, HEAD, OPTIONS",
  })
})
