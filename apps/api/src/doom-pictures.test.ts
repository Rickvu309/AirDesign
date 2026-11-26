import { createHash, randomBytes } from "node:crypto"

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import * as doom from "@airdesign/doom"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const shot = Buffer.from("not really a jpeg").toString("base64")

type Block = { readonly type: string; readonly text?: string; readonly data?: string }
type Answer = { readonly deck: string; readonly rev: number; readonly slides: readonly string[] }
type Pictured = { readonly ok: boolean; readonly refusal?: string; readonly missing?: readonly string[] }

describe("an open tab sends the picture of each slide of a Doom deck, and an agent reads it", () => {
  const mails: Mail[] = []
  let base = ""
  let pool: Sql = openPool("postgres://deck@127.0.0.1/api")
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "doom-pictures-session")
    pool = openPool(info.deck, "doom-pictures-deck")
    const listen = new DeckListen(info.listen)
    const api = await serve({
      ...origins,
      session,
      deck: pool,
      listen,
      pictureWait: 150,
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

  async function opened() {
    const cookie = await signInByCode(base, mails, `pictures${randomBytes(4).toString("hex")}@example.com`)
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { cookie } },
    })
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(transport)
    const created = await client.callTool({
      name: "airdesign_execute",
      arguments: { script: 'createDeck({ name: "Seen" })' },
    })
    return { cookie, client, made: created.structuredContent as Answer }
  }

  async function keysOf(deck: string, cookie: string) {
    const answer = await ask(base, "POST", "/doom/open", { deck }, cookie)
    const fold = doom.readFold((answer.json as { fold: unknown }).fold)!
    const keyOf = (slide: string) =>
      createHash("sha256")
        .update(doom.slideKeyText(fold, slide as doom.NodeId))
        .digest("hex")
    return { rev: fold.rev, keyOf, slides: doom.slidesOf(fold).map((slide) => slide.id) }
  }

  const send = (deck: string, rev: number, pictures: unknown, cookie: string) =>
    ask(base, "POST", "/doom/pictures", { deck, rev, pictures }, cookie)

  const read = (client: Client, deck: string, { slide }: { readonly slide: string | undefined }) =>
    client.callTool({
      name: "airdesign_execute",
      arguments: { deck, script: `screenshot({ target: ${JSON.stringify(slide)} })` },
    })

  const followed = (deck: string, rev: number, cookie: string) => send(deck, rev, { keys: [], images: [] }, cookie)

  it("asks the tab for no picture until an agent reads, then names the slides the agent asked for and gives it the current one", async () => {
    const { cookie, client, made } = await opened()
    try {
      const { rev, keyOf, slides } = await keysOf(made.deck, cookie)
      const keys = slides.map((slide) => ({ slide, key: keyOf(slide) }))
      const first = await send(made.deck, rev, { keys, images: [] }, cookie)
      expect(first.json).toEqual({ ok: true, deck: made.deck, missing: [] })
      const [slide] = slides
      const pending = read(client, made.deck, { slide })
      await expect
        .poll(async () => (await send(made.deck, rev, { keys, images: [] }, cookie)).json)
        .toEqual({ ok: true, deck: made.deck, missing: [slide] })
      const next = await send(
        made.deck,
        rev,
        { keys, images: [{ slide, key: keyOf(slide!), type: "image/jpeg", data: shot }] },
        cookie,
      )
      expect(next.json).toEqual({ ok: true, deck: made.deck, missing: [] })
      const answer = await pending
      expect(answer.isError).not.toBe(true)
      const blocks = answer.content as readonly Block[]
      expect(blocks.filter((block) => block.type === "image")).toEqual([
        { type: "image", data: shot, mimeType: "image/jpeg" },
      ])
    } finally {
      await client.close()
    }
  })

  it("reports a font failure for the current slide and accepts a later capture of the same revision", async () => {
    const { cookie, client, made } = await opened()
    try {
      const { rev, keyOf, slides } = await keysOf(made.deck, cookie)
      const [slide] = slides
      const key = keyOf(slide!)
      const keys = [{ slide, key }]
      await followed(made.deck, rev, cookie)
      const pending = read(client, made.deck, { slide })
      await expect
        .poll(async () => (await send(made.deck, rev, { keys, images: [] }, cookie)).json)
        .toMatchObject({ missing: [slide] })
      const failed = await send(made.deck, rev, { keys, images: [], fontFailures: keys }, cookie)
      const answer = await pending
      expect(failed.json).toMatchObject({ ok: true })
      expect((answer.structuredContent as { note: string }).note).toContain(`A font could not load for ${slide!}`)
      expect((answer.content as readonly Block[]).some((block) => block.type === "image")).toBe(false)

      await followed(made.deck, rev, cookie)
      const retry = read(client, made.deck, { slide })
      await send(made.deck, rev, { keys, images: [{ slide, key, type: "image/jpeg", data: shot }] }, cookie)
      expect((await retry).structuredContent).toMatchObject({ pictures: [slide] })
    } finally {
      await client.close()
    }
  })

  it("tells a tab that is following the deck, in its held catch-up, that an agent asked for pictures", async () => {
    const { cookie, client, made } = await opened()
    try {
      const { rev, slides } = await keysOf(made.deck, cookie)
      const following = ask(base, "POST", "/doom/since", { deck: made.deck, rev, wait: true }, cookie)
      await new Promise((resolve) => setTimeout(resolve, 60))
      const reading = read(client, made.deck, { slide: slides[0] })
      expect((await following).json).toEqual({ ok: true, deck: made.deck, rev, edits: [], pictures: true })
      await reading
    } finally {
      await client.close()
    }
  })

  it("tells a tab that was between two catch-ups when an agent asked, in its next catch-up, once", async () => {
    const { cookie, client, made } = await opened()
    try {
      const { rev, slides } = await keysOf(made.deck, cookie)
      await followed(made.deck, rev, cookie)
      const reading = read(client, made.deck, { slide: slides[0] })
      await new Promise((resolve) => setTimeout(resolve, 40))
      const next = ask(base, "POST", "/doom/since", { deck: made.deck, rev, wait: true }, cookie)
      expect((await next).json).toEqual({ ok: true, deck: made.deck, rev, edits: [], pictures: true })
      const told = ask(base, "POST", "/doom/since", { deck: made.deck, rev, pictures: true }, cookie)
      expect((await told).json).toEqual({ ok: true, deck: made.deck, rev, edits: [] })
      await reading
    } finally {
      await client.close()
    }
  })

  it("waits a moment for a picture on its way, then says plainly there is none current", async () => {
    const { cookie, client, made } = await opened()
    try {
      const { rev, slides } = await keysOf(made.deck, cookie)
      const [slide] = slides
      const stale = {
        keys: [{ slide, key: "f".repeat(64) }],
        images: [{ slide, key: "f".repeat(64), type: "image/jpeg", data: shot }],
      }
      expect((await send(made.deck, rev, stale, cookie)).json).toMatchObject({ ok: true })
      const started = Date.now()
      const answer = await read(client, made.deck, { slide })
      expect(Date.now() - started).toBeGreaterThanOrEqual(100)
      const blocks = answer.content as readonly Block[]
      expect(blocks.some((block) => block.type === "image")).toBe(false)
      expect((answer.structuredContent as { note: string }).note).toContain(`No picture of ${slide!} yet`)
    } finally {
      await client.close()
    }
  })

  it("picks up a picture that lands while the agent waits", async () => {
    const { cookie, client, made } = await opened()
    try {
      const { rev, keyOf, slides } = await keysOf(made.deck, cookie)
      const [slide] = slides
      await followed(made.deck, rev, cookie)
      const pending = read(client, made.deck, { slide })
      await new Promise((resolve) => setTimeout(resolve, 40))
      const keys = [{ slide, key: keyOf(slide!) }]
      await send(
        made.deck,
        rev,
        { keys, images: [{ slide, key: keyOf(slide!), type: "image/jpeg", data: shot }] },
        cookie,
      )
      const blocks = (await pending).content as readonly Block[]
      expect(blocks.filter((block) => block.type === "image")).toHaveLength(1)
    } finally {
      await client.close()
    }
  })

  it("answers at once that no tab is open when no tab follows the deck, and asks no tab for a picture", async () => {
    const { cookie, client, made } = await opened()
    try {
      const { rev, slides } = await keysOf(made.deck, cookie)
      const answer = await read(client, made.deck, { slide: slides[0] })
      expect((answer.structuredContent as { note: string }).note).toContain("none is open")
      expect((answer.content as readonly Block[]).some((block) => block.type === "image")).toBe(false)
      const told = await ask(base, "POST", "/doom/since", { deck: made.deck, rev }, cookie)
      expect(told.json).toEqual({ ok: true, deck: made.deck, rev, edits: [] })
    } finally {
      await client.close()
    }
  })

  it("refuses another account's deck, a revision the deck has not reached, and a slide id that is no id", async () => {
    const { cookie, client, made } = await opened()
    try {
      const other = await signInByCode(base, mails, `pictures${randomBytes(4).toString("hex")}@example.com`)
      const { rev, slides } = await keysOf(made.deck, cookie)
      const keys = [{ slide: slides[0], key: "a".repeat(64) }]
      expect(((await send(made.deck, rev, { keys, images: [] }, other)).json as Pictured).refusal).toBe("owner")
      expect(((await send(made.deck, rev + 5, { keys, images: [] }, cookie)).json as Pictured).refusal).toBe("stale")
      const bad = { keys: [{ slide: "no id", key: "a".repeat(64) }], images: [] }
      expect(((await send(made.deck, rev, bad, cookie)).json as Pictured).refusal).toBe("field")
    } finally {
      await client.close()
    }
  })
})
