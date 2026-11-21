import { randomBytes } from "node:crypto"

import { deckRoutes } from "@airdesign/catalog"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const slide = "258"
const title = "258.7"
const data = Buffer.from("a painted slide").toString("base64")

type Block = { readonly type: string; readonly text?: string; readonly data?: string; readonly mimeType?: string }
type Answer = { readonly content: readonly Block[]; readonly structuredContent?: unknown }
type Read = { readonly revision: number; readonly slides: readonly { readonly id: string }[] }

describe("read_deck with picture shows the slide the owner's open tab painted at the deck's revision", () => {
  const mails: Mail[] = []
  let base = ""
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "pictures-session")
    const deck = openPool(info.deck, "pictures-deck")
    const listen = new DeckListen(info.listen)
    const served = await serve({
      ...origins,
      session,
      deck,
      listen,
      measureLimit: 4_000,
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

  async function opened() {
    const cookie = await signInByCode(base, mails, `pictures${randomBytes(6).toString("hex")}@example.com`)
    const deck = `pictures${randomBytes(4).toString("hex")}`
    await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)
    await ask(
      base,
      "POST",
      "/decks/index",
      {
        deck,
        once: "pictures-index",
        offset: 0,
        total: 2,
        slides: [
          { id: slide, position: 0, size: { width: 12192000, height: 6858000 }, free: 40, animated: [], layout: [] },
        ],
        elements: [{ node: title, kind: "shape", value: "", box: null, grouped: false }],
      },
      cookie,
    )
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { cookie } } }),
    )
    const agent = async (name: string, args: Record<string, unknown>) =>
      (await client.callTool({ name, arguments: args })) as Answer
    return { cookie, deck, agent }
  }

  async function edited(agent: Awaited<ReturnType<typeof opened>>["agent"], deck: string) {
    const changes = [{ node: title, value: "A title the agent wrote", readAt: 0 }]
    const landed = await agent("airdesign_edit_deck", { deck, base: 0, changes })
    expect(landed.structuredContent).toMatchObject({ ok: true })
    return (await agent("airdesign_read_deck", { deck })).structuredContent as Read
  }

  const texts = (answer: Answer) => answer.content.flatMap((block) => (block.type === "text" ? [block.text] : []))
  const images = (answer: Answer) => answer.content.filter((block) => block.type === "image")

  it("tells the agent no tab has the deck open, and leaves the picture out of a read that did not ask", async () => {
    const { deck, agent } = await opened()
    const plain = await agent("airdesign_read_deck", { deck })
    expect(texts(plain)).toHaveLength(2)
    const asked = await agent("airdesign_read_deck", { deck, picture: true })
    expect(images(asked)).toEqual([])
    expect(texts(asked).at(-1)).toMatch(/^No picture: slides are painted in the owner's open AirDesign tab/)
  })

  it("tells the agent how to get a picture while no run of its own is open", async () => {
    const { cookie, deck, agent } = await opened()
    const read = (await agent("airdesign_read_deck", { deck })).structuredContent as Read
    const watching = ask(base, "POST", deckRoutes.watch.path, { deck, cursor: read.revision }, cookie)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const asked = await agent("airdesign_read_deck", { deck, picture: true })
    expect(texts(asked).at(-1)).toBe(
      "Pictures are painted while your run is open: make your first edit, then read with picture again.",
    )
    await ask(base, "POST", deckRoutes.commit.path, { deck, batch: [{ node: title, value: "Mine" }] }, cookie)
    await watching
  })

  it("waits for the tab's picture during the agent's run and answers it as image content at the revision", async () => {
    const { cookie, deck, agent } = await opened()
    const read = await edited(agent, deck)
    expect(read.slides.map(({ id }) => id)).toEqual([slide])
    const key = "a".repeat(64)
    const report = { deck, revision: read.revision, findings: [] }
    const keyed = await ask(
      base,
      "POST",
      deckRoutes.findings.path,
      { ...report, pictures: { keys: [{ slide, key }], images: [] } },
      cookie,
    )
    expect(keyed.json).toEqual({ ok: true, deck, missing: [slide] })
    const watching = ask(base, "POST", deckRoutes.watch.path, { deck, cursor: read.revision }, cookie)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const started = Date.now()
    const reading = agent("airdesign_read_deck", { deck, slide, picture: true })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const painted = await ask(
      base,
      "POST",
      deckRoutes.findings.path,
      { ...report, pictures: { keys: [{ slide, key }], images: [{ slide, key, type: "image/jpeg", data }] } },
      cookie,
    )
    expect(painted.json).toEqual({ ok: true, deck, missing: [] })
    const answer = await reading
    expect(Date.now() - started).toBeLessThan(3_000)
    expect(texts(answer).at(-1)).toBe(`Slide 1 (${slide}) at revision ${String(read.revision)}:`)
    expect(images(answer)).toEqual([{ type: "image", data, mimeType: "image/jpeg" }])
    await ask(base, "POST", deckRoutes.commit.path, { deck, batch: [{ node: title, value: "Mine" }] }, cookie)
    await watching
  })

  it("never shows a picture from before the deck's revision", async () => {
    const { cookie, deck, agent } = await opened()
    const read = await edited(agent, deck)
    expect(read.slides.map(({ id }) => id)).toEqual([slide])
    const key = "b".repeat(64)
    const image = { slide, key, type: "image/jpeg", data }
    await ask(
      base,
      "POST",
      deckRoutes.findings.path,
      { deck, revision: read.revision, findings: [], pictures: { keys: [{ slide, key }], images: [image] } },
      cookie,
    )
    await ask(base, "POST", deckRoutes.commit.path, { deck, batch: [{ node: title, value: "Mine" }] }, cookie)
    const asked = await agent("airdesign_read_deck", { deck, slide, picture: true })
    expect(images(asked)).toEqual([])
    expect(texts(asked).at(-1)).toMatch(/^No picture: slides are painted in the owner's open AirDesign tab/)
  })
})
