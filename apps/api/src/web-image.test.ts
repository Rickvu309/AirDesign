import { createHash, randomBytes } from "node:crypto"

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./harness.js"
import type { ImageNet, Resolved } from "./image-fetch.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { LocalOriginalStore } from "./local-original-store.js"

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

type Text = { readonly text: string }

describe("an agent adds an image from the web through the MCP address", () => {
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

  async function opened(): Promise<{ id: string; cookie: string; client: Client }> {
    const id = `deck${randomBytes(4).toString("hex")}`
    const cookie = await signInByCode(base, mails, `image${randomBytes(4).toString("hex")}@example.com`)
    await ask(base, "POST", "/decks/open", { deck: id }, cookie)
    await ask(
      base,
      "POST",
      "/decks/index",
      {
        deck: id,
        once: "image-index",
        offset: 0,
        total: 0,
        slides: [{ id: "256", position: 0, size: { width: 12_192_000, height: 6_858_000 }, free: 3, layout: [] }],
        elements: [],
      },
      cookie,
    )
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { cookie } },
    })
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(transport)
    return { id, cookie, client }
  }

  async function revision(id: string): Promise<number> {
    const result = await pool.query<{ revision: number }>("select revision from deck.saved where id = $1", [id])
    return result.rows[0]?.revision ?? -1
  }

  it("says the edit tool reaches the open web", async () => {
    const { client } = await opened()
    try {
      const listed = await client.listTools()
      const edit = listed.tools.find((tool) => tool.name === "airdesign_edit_deck")
      expect(edit?.annotations?.openWorldHint).toBe(true)
      expect(listed.tools.filter((tool) => tool.annotations?.openWorldHint === true)).toHaveLength(1)
    } finally {
      await client.close()
    }
  })

  it("fetches the image once, stores its bytes by hash as deck media, and adds it at its own proportions", async () => {
    const { id, cookie, client } = await opened()
    try {
      fetches.length = 0
      const answer = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: id,
          base: await revision(id),
          changes: [{ op: "add", kind: "shape", slide: "256", image: logo, box: { x: 72, y: 72, w: 288, h: 144 } }],
        },
      })
      expect(answer.isError).not.toBe(true)
      expect(fetches).toEqual([logo])
      const saved = await pool.query<{ register: { order: unknown[] } }>(
        "select register from deck.saved where id = $1",
        [id],
      )
      expect(saved.rows[0]?.register.order.at(-1)).toMatchObject({
        slide: "element-add",
        element: { box: { x: 914_400, y: 1_371_600, cx: 3_657_600, cy: 914_400 } },
        media: { sha256, type: "image/png" },
      })
      const media = await ask(base, "POST", "/decks/media", { deck: id, sha256 }, cookie)
      expect(media.json).toMatchObject({ ok: true, bytes: served.byteLength, sha256 })
      expect(Buffer.from(store.get((media.json as { url: string }).url))).toEqual(Buffer.from(served))
    } finally {
      await client.close()
    }
  })

  it("refuses an address that leads inside the network, says why, and fetches and stores nothing", async () => {
    const { id, client } = await opened()
    try {
      fetches.length = 0
      const before = await revision(id)
      const answer = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: id, base: before, changes: [{ op: "add", kind: "shape", slide: "256", image: inside }] },
      })
      expect(answer.isError).toBe(true)
      const words = (answer.content as readonly Text[]).map((block) => block.text).join("\n")
      expect(words).toContain(`"${inside}" was not used because it leads to a private or local network`)
      expect(fetches).toEqual([])
      expect(await revision(id)).toBe(before)
      const rows = await pool.query("select key from deck.media where deck = $1", [id])
      expect(rows.rows).toEqual([])
    } finally {
      await client.close()
    }
  })
})
