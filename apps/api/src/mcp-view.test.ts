import { createHash, randomBytes } from "node:crypto"

import { viewTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const shot = Buffer.from("a slide painted in the chat").toString("base64")

type Opened = { readonly ok: true; readonly deck: string; readonly rev: number; readonly fold: unknown }
type Block = { readonly type: string; readonly data?: string }

describe("the deck view in a chat holds the painter lease and answers an agent's screenshot", () => {
  const mails: Mail[] = []
  let base = ""
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "mcp-view-session")
    const pool: Sql = openPool(info.deck, "mcp-view-deck")
    const listen = new DeckListen(info.listen)
    const api = await serve({
      ...origins,
      session,
      deck: pool,
      listen,
      screenshotWait: 5_000,
      viewHold: 300,
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

  async function connected(cookie: string): Promise<Client> {
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { cookie } } }),
    )
    return client
  }

  async function started() {
    const cookie = await signInByCode(base, mails, `view${randomBytes(4).toString("hex")}@example.com`)
    const agent = await connected(cookie)
    const app = await connected(cookie)
    const made = await agent.callTool({
      name: "airdesign_execute",
      arguments: { script: 'createDeck({ name: "Seen" })' },
    })
    const { deck } = made.structuredContent as { deck: string }
    return { agent, app, deck }
  }

  it("serves the view's shell from the API's public origin", async () => {
    const { agent, app } = await started()
    try {
      const { contents } = await app.readResource({ uri: "ui://airdesign/deck.html" })
      expect((contents[0] as { text: string }).text).toContain('<base href="https://app.example/">')
      const { tools } = await agent.listTools()
      const execute = tools.find((tool) => tool.name === "airdesign_execute")
      expect(execute?._meta?.ui).toEqual({ resourceUri: "ui://airdesign/deck.html" })
    } finally {
      await agent.close()
      await app.close()
    }
  })

  it("paints for an agent while the view waits for edits, then answers a quiet wait after its hold", async () => {
    const { agent, app, deck } = await started()
    try {
      const opened = (await app.callTool({ name: viewTools.open, arguments: { deck } })).structuredContent as Opened
      expect(opened).toMatchObject({ ok: true, deck })
      const fold = doom.readFold(opened.fold)!
      const [slide] = doom.slidesOf(fold).map((each) => each.id)
      const key = createHash("sha256").update(doom.slideKeyText(fold, slide!)).digest("hex")
      const quiet = await app.callTool({ name: viewTools.since, arguments: { deck, rev: opened.rev, wait: true } })
      expect(quiet.structuredContent).toEqual({ ok: true, deck, rev: opened.rev, edits: [] })

      const held = app.callTool({ name: viewTools.since, arguments: { deck, rev: opened.rev, wait: true } })
      const asked = agent.callTool({
        name: "airdesign_execute",
        arguments: { deck, script: `screenshot({ target: ${JSON.stringify(slide)} })` },
      })
      expect((await held).structuredContent).toMatchObject({ ok: true, deck, screenshots: true })
      const kept = await app.callTool({
        name: viewTools.screenshots,
        arguments: {
          deck,
          rev: opened.rev,
          screenshots: { keys: [{ slide, key }], images: [{ slide, key, type: "image/jpeg", data: shot }] },
        },
      })
      expect(kept.structuredContent).toEqual({ ok: true, deck, missing: [] })
      const answer = await asked
      expect((answer.content as readonly Block[]).filter((block) => block.type === "image")).toEqual([
        { type: "image", data: shot, mimeType: "image/jpeg" },
      ])
      expect(answer.structuredContent).toMatchObject({ ok: true, screenshots: [slide] })
    } finally {
      await agent.close()
      await app.close()
    }
  })

  it("waits for a view that is still opening before it says no painter holds the deck", async () => {
    const { agent, app, deck } = await started()
    try {
      const opened = (await app.callTool({ name: viewTools.open, arguments: { deck } })).structuredContent as Opened
      const fold = doom.readFold(opened.fold)!
      const [slide] = doom.slidesOf(fold).map((each) => each.id)
      const key = createHash("sha256").update(doom.slideKeyText(fold, slide!)).digest("hex")
      const asked = agent.callTool({
        name: "airdesign_execute",
        arguments: { deck, script: `screenshot({ target: ${JSON.stringify(slide)} })` },
      })
      await new Promise((resolve) => setTimeout(resolve, 500))
      const held = await app.callTool({ name: viewTools.since, arguments: { deck, rev: opened.rev, wait: true } })
      expect(held.structuredContent).toMatchObject({ ok: true, deck, screenshots: true })
      await app.callTool({
        name: viewTools.screenshots,
        arguments: {
          deck,
          rev: opened.rev,
          screenshots: { keys: [{ slide, key }], images: [{ slide, key, type: "image/jpeg", data: shot }] },
        },
      })
      const answer = await asked
      expect(answer.structuredContent).toMatchObject({ ok: true, screenshots: [slide] })
    } finally {
      await agent.close()
      await app.close()
    }
  })

  it("answers the view only for the decks its account owns", async () => {
    const { agent, deck } = await started()
    const stranger = await connected(
      await signInByCode(base, mails, `other${randomBytes(4).toString("hex")}@example.com`),
    )
    try {
      const opened = await stranger.callTool({ name: viewTools.open, arguments: { deck } })
      expect(opened.structuredContent).toMatchObject({ ok: false })
      const followed = await stranger.callTool({ name: viewTools.since, arguments: { deck, rev: 1, wait: true } })
      expect(followed.structuredContent).toMatchObject({ ok: false })
    } finally {
      await agent.close()
      await stranger.close()
    }
  })
})
