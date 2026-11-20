import { randomBytes } from "node:crypto"

import { deckRoutes } from "@airdesign/catalog"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const title = "258.7"
const overflow = { needed: 86.4, room: 64.8, fix: { size: 28, height: 93.6 } }

type Read = {
  readonly findings?: string
  readonly elements?: readonly { readonly node: string; readonly overflow?: unknown }[]
}

describe("POST /decks/findings keeps the owner's tab report for the agent's read", () => {
  const mails: Mail[] = []
  let base = ""
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "findings-session")
    const deck = openPool(info.deck, "findings-deck")
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

  const signIn = () => signInByCode(base, mails, `findings${randomBytes(6).toString("hex")}@example.com`)

  async function agentOf(cookie: string) {
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { cookie } } }),
    )
    return async (name: string, args: Record<string, unknown>): Promise<unknown> =>
      (await client.callTool({ name, arguments: args })).structuredContent
  }

  async function typed() {
    const cookie = await signIn()
    const deck = `findings${randomBytes(4).toString("hex")}`
    await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)
    const agent = await agentOf(cookie)
    const changes = [{ node: title, value: "A title an agent made long enough to wrap past its box", readAt: 0 }]
    const landed = (await agent("airdesign_edit_deck", { deck, base: 0, changes })) as { readonly ok: boolean }
    if (!landed.ok) throw new Error(JSON.stringify(landed))
    const opened = await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)
    const revision = (opened.json as { readonly revision: number }).revision
    return { cookie, deck, agent, revision }
  }

  const report = (deck: string, revision: number) => ({ deck, revision, overflow: [{ node: title, ...overflow }] })

  it("marks the overflowing layer while the deck stays at the reported revision", async () => {
    const { cookie, deck, agent, revision } = await typed()
    expect(((await agent("airdesign_read_deck", { deck })) as Read).findings).toBe("missing")
    const sent = await ask(base, "POST", deckRoutes.findings.path, report(deck, revision), cookie)
    expect(sent.json).toEqual({ ok: true, deck })
    const read = (await agent("airdesign_read_deck", { deck })) as Read
    expect(read.findings).toBe("ready")
    expect(read.elements?.find((element) => element.node === title)?.overflow).toEqual(overflow)
    const older = await ask(
      base,
      "POST",
      deckRoutes.findings.path,
      { ...report(deck, revision - 1), overflow: [] },
      cookie,
    )
    expect(older.json).toEqual({ ok: true, deck })
    expect(((await agent("airdesign_read_deck", { deck })) as Read).elements?.[0]?.overflow).toEqual(overflow)
    const ahead = await ask(base, "POST", deckRoutes.findings.path, report(deck, revision + 1), cookie)
    expect(ahead.json).toEqual({ ok: false, refusal: "stale" })
  })

  it("says pending once the deck moves past the report, and waits for the tab that follows the deck", async () => {
    const { cookie, deck, agent, revision } = await typed()
    await ask(base, "POST", deckRoutes.findings.path, report(deck, revision), cookie)
    const changes = [{ node: title, value: "Short", readAt: 1 }]
    const landed = (await agent("airdesign_edit_deck", { deck, base: revision, changes })) as { readonly ok: boolean }
    expect(landed.ok).toBe(true)
    const pending = (await agent("airdesign_read_deck", { deck })) as Read
    expect(pending.findings).toBe("pending")
    expect(pending.elements?.[0]).not.toHaveProperty("overflow")
    const watching = ask(base, "POST", deckRoutes.watch.path, { deck, cursor: revision + 1 }, cookie)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const started = Date.now()
    const reading = agent("airdesign_read_deck", { deck })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await ask(base, "POST", deckRoutes.findings.path, { deck, revision: revision + 1, overflow: [] }, cookie)
    const fresh = (await reading) as Read
    expect(Date.now() - started).toBeLessThan(3_000)
    expect(fresh.findings).toBe("ready")
    expect(fresh.elements?.[0]).not.toHaveProperty("overflow")
    await ask(base, "POST", deckRoutes.commit.path, { deck, batch: [{ node: title, value: "Mine" }] }, cookie)
    expect((await watching).json).toMatchObject({ ok: true, deck })
  })

  it("answers at once while a watch follows a deck no tab has reported on", async () => {
    const { cookie, deck, agent, revision } = await typed()
    const watching = ask(base, "POST", deckRoutes.watch.path, { deck, cursor: revision }, cookie)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const started = Date.now()
    const read = (await agent("airdesign_read_deck", { deck })) as Read
    expect(Date.now() - started).toBeLessThan(2_000)
    expect(read.findings).toBe("missing")
    await ask(base, "POST", deckRoutes.commit.path, { deck, batch: [{ node: title, value: "Mine" }] }, cookie)
    expect((await watching).json).toMatchObject({ ok: true, deck })
  })

  it("reads the deck at the report's revision when a row lands while it waits", async () => {
    const { cookie, deck, agent, revision } = await typed()
    await ask(base, "POST", deckRoutes.findings.path, report(deck, revision), cookie)
    const changes = [{ node: title, value: "Short", readAt: 1 }]
    const landed = (await agent("airdesign_edit_deck", { deck, base: revision, changes })) as { readonly ok: boolean }
    expect(landed.ok).toBe(true)
    const watching = ask(base, "POST", deckRoutes.watch.path, { deck, cursor: revision + 1 }, cookie)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const reading = agent("airdesign_read_deck", { deck })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await ask(base, "POST", deckRoutes.commit.path, { deck, batch: [{ node: "258.8", value: "Measured" }] }, cookie)
    expect((await watching).json).toMatchObject({ ok: true, deck, revision: revision + 2 })
    await ask(base, "POST", deckRoutes.findings.path, { ...report(deck, revision + 2), overflow: [] }, cookie)
    const fresh = (await reading) as Read & { readonly revision: number }
    expect(fresh.revision).toBe(revision + 2)
    expect(fresh.findings).toBe("ready")
  })

  it("refuses another account's deck, a missing deck, a malformed report and no session", async () => {
    const { deck, revision } = await typed()
    const other = await signIn()
    const path = deckRoutes.findings.path
    expect((await ask(base, "POST", path, report(deck, revision), other)).json).toEqual({ ok: false, refusal: "owner" })
    expect((await ask(base, "POST", path, report("nosuchdeck", 0), other)).json).toEqual({ ok: false, refusal: "deck" })
    expect((await ask(base, "POST", path, { deck, revision }, other)).json).toEqual({ ok: false, refusal: "field" })
    expect((await ask(base, "POST", path, report(deck, revision))).status).toBe(401)
  })
})
