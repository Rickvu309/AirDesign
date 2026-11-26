import { createHash, randomBytes } from "node:crypto"

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import type { ImageNet, Resolved } from "./platform/image-fetch.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { LocalOriginalStore } from "./platform/local-original-store.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const logo = "https://images.example.com/logo.png"
const inside = "https://metadata.example.com/logo.png"

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(64)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

const served = png(400, 100)
const sha256 = createHash("sha256").update(served).digest("hex")
const hosts: Readonly<Record<string, readonly string[]>> = {
  "images.example.com": ["93.184.216.34"],
  "metadata.example.com": ["169.254.169.254"],
}
const fetches: string[] = []

const net: ImageNet = {
  resolve: async (host) => (hosts[host] ?? []).map((address): Resolved => ({ address, family: 4 })),
  get: async (url) => {
    fetches.push(url.href)
    const body = url.href === logo ? served : new Uint8Array()
    return {
      status: url.href === logo ? 200 : 404,
      location: undefined,
      length: body.byteLength,
      body: (async function* () {
        yield body
      })(),
      cancel: () => {},
    }
  },
}

type Said = { readonly note: string; readonly layers: string }
type Answer = { readonly deck: string; readonly rev: number; readonly slides: readonly string[] }

describe("an agent adds an image from the web to a Doom deck through the MCP address", () => {
  const mails: Mail[] = []
  const store = new LocalOriginalStore()
  let base = ""
  let pool: Sql = openPool("postgres://deck@127.0.0.1/api")
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "web-image-session")
    pool = openPool(info.deck, "web-image-deck")
    const listen = new DeckListen(info.listen)
    const api = await serve({
      ...origins,
      session,
      deck: pool,
      listen,
      originals: store,
      imageNet: net,
      send: async (mail) => void mails.push(mail),
    })
    base = api.base
    close = async () => {
      await api.close()
      await listen.close()
      await session.end()
      await pool.end()
    }
  })

  afterAll(async () => {
    await close()
  })

  async function opened(): Promise<{ cookie: string; client: Client; made: Answer }> {
    const cookie = await signInByCode(base, mails, `image${randomBytes(4).toString("hex")}@example.com`)
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { cookie } },
    })
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(transport)
    const created = await client.callTool({
      name: "airdesign_execute",
      arguments: { script: 'createDeck({ name: "Logos" })' },
    })
    return { cookie, client, made: created.structuredContent as Answer }
  }

  const add = (made: Answer, image: string) => ({
    deck: made.deck,
    script: `insert(${JSON.stringify({ parent: made.slides[0], kind: "picture", fill: { image }, box: { x: 72, y: 72, w: 288, h: 144 } })})`,
  })
  const layersOf = async (client: Client, deck: string) =>
    (
      (await client.callTool({ name: "airdesign_execute", arguments: { deck, script: "get()" } }))
        .structuredContent as {
        result: Said & Answer
      }
    ).result

  it("fetches the image once, stores its bytes by hash as deck media, and paints the stored asset", async () => {
    const { cookie, client, made } = await opened()
    try {
      fetches.length = 0
      const answer = await client.callTool({ name: "airdesign_execute", arguments: add(made, logo) })
      expect(answer.isError, JSON.stringify(answer.content)).not.toBe(true)
      expect(fetches).toEqual([logo])
      const words = (await layersOf(client, made.deck)).layers
      expect(words).toContain(`image:${sha256}`)
      expect(words).not.toContain(logo)
      const media = await ask(base, "POST", "/decks/media", { deck: made.deck, sha256 }, cookie)
      expect(media.json).toMatchObject({ ok: true, bytes: served.byteLength, sha256 })
      expect(Buffer.from(store.get((media.json as { url: string }).url))).toEqual(Buffer.from(served))
    } finally {
      await client.close()
    }
  })

  it("takes a stored asset the agent read back, and fetches nothing", async () => {
    const { client, made } = await opened()
    try {
      await client.callTool({ name: "airdesign_execute", arguments: add(made, logo) })
      fetches.length = 0
      const again = await client.callTool({ name: "airdesign_execute", arguments: add(made, sha256) })
      expect(again.isError, JSON.stringify(again.content)).not.toBe(true)
      expect(fetches).toEqual([])
    } finally {
      await client.close()
    }
  })

  it("sizes a picture added with no box to the shape of the file it fetched", async () => {
    const { client, made } = await opened()
    try {
      const answer = await client.callTool({
        name: "airdesign_execute",
        arguments: {
          deck: made.deck,
          script: `insert(${JSON.stringify({ parent: made.slides[0], kind: "picture", fill: { image: logo } })})`,
        },
      })
      expect(answer.isError, JSON.stringify(answer.content)).not.toBe(true)
      const words = (await layersOf(client, made.deck)).layers
      const box = /picture @\d+,\d+ (\d+)x(\d+)/.exec(words)
      expect(box, words).not.toBeNull()
      expect(Number(box?.[1]) / Number(box?.[2])).toBeCloseTo(4, 1)
    } finally {
      await client.close()
    }
  })

  it("refuses a hash the deck holds no picture for, and a name that is neither hash nor address", async () => {
    const { client, made } = await opened()
    try {
      for (const image of ["d".repeat(64), "logo.png"]) {
        const answer = await client.callTool({ name: "airdesign_execute", arguments: add(made, image) })
        expect(answer.isError).toBe(true)
        const words = (answer.structuredContent as Said).note
        expect(words).toContain(`Operation 1 (insert) at line 1: "${image}" was not used because`)
      }
    } finally {
      await client.close()
    }
  })

  it("refuses an address that leads inside the network, says why, and fetches and stores nothing", async () => {
    const { client, made } = await opened()
    try {
      fetches.length = 0
      const answer = await client.callTool({ name: "airdesign_execute", arguments: add(made, inside) })
      expect(answer.isError).toBe(true)
      const words = (answer.structuredContent as Said).note
      expect(words).toContain(`"${inside}" was not used because it leads to a private or local network`)
      expect(fetches).toEqual([])
      const rows = await pool.query("select key from deck.media where deck = $1", [made.deck])
      expect(rows.rows).toEqual([])
      expect((await layersOf(client, made.deck)).rev).toBe(made.rev)
    } finally {
      await client.close()
    }
  })
})
