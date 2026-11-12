import { randomBytes } from "node:crypto"

import { deckRoutes } from "@airdesign/catalog"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { readSignInMail } from "./sign-in-mail.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const title = "258.7"
const body = "258.8"

type Edited = { readonly ok: boolean; readonly runId?: string; readonly revision?: number }
type Read = { readonly elements?: readonly { readonly node: string; readonly value?: unknown }[] }

describe("POST /decks/undo takes back an agent's run for the person", () => {
  const mails: Mail[] = []
  let base = ""
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "undo-session")
    const deck = openPool(info.deck, "undo-deck")
    const listen = new DeckListen(info.listen)
    const served = await serve({
      ...origins,
      session,
      deck,
      listen,
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

  async function signIn(): Promise<string> {
    const email = `undo${randomBytes(6).toString("hex")}@example.com`
    const index = mails.length
    await ask(base, "POST", "/sign-in/email", { email })
    const { code } = readSignInMail(mails[index]?.text ?? "")
    const cookie = cookieFrom((await ask(base, "POST", "/sign-in/code", { email, code })).headers)
    if (cookie === undefined) throw new Error("cookie")
    return cookie
  }

  async function agentOf(cookie: string) {
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { cookie } } }),
    )
    return async (name: string, args: Record<string, unknown>): Promise<unknown> =>
      (await client.callTool({ name, arguments: args })).structuredContent
  }

  async function edited() {
    const cookie = await signIn()
    const deck = `undo${randomBytes(4).toString("hex")}`
    await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)
    const agent = await agentOf(cookie)
    const changes = [
      { node: title, value: "Agent title", readAt: 0 },
      { node: body, value: "Agent body", readAt: 0 },
    ]
    const landed = (await agent("airdesign_edit_deck", { deck, base: 0, changes })) as Edited
    if (!landed.ok || landed.runId === undefined) throw new Error(JSON.stringify(landed))
    return { cookie, deck, agent, runId: landed.runId }
  }

  async function valuesOf(agent: Awaited<ReturnType<typeof agentOf>>, deck: string) {
    const read = (await agent("airdesign_read_deck", { deck })) as Read
    return Object.fromEntries((read.elements ?? []).map((element) => [element.node, element.value]))
  }

  it("undoes every element of the run in one revision, keeps a person's later edit, and wakes a watch", async () => {
    const { cookie, deck, agent, runId } = await edited()
    const person = await ask(
      base,
      "POST",
      deckRoutes.commit.path,
      { deck, batch: [{ node: body, value: "Mine" }] },
      cookie,
    )
    expect(person.json).toMatchObject({ ok: true, revision: 2 })
    const watched = ask(base, "POST", deckRoutes.watch.path, { deck, cursor: 2 }, cookie)
    const undone = await ask(base, "POST", deckRoutes.undo.path, { deck, runId }, cookie)
    expect(undone.status).toBe(200)
    expect(deckRoutes.undo.result(undone.json)).toEqual({ ok: true, deck, revision: 3, key: `${deck}:3` })
    expect((await watched).json).toEqual({ ok: true, deck, revision: 3 })
    const values = await valuesOf(agent, deck)
    expect(values[body]).toBe("Mine")
    expect(values[title]).not.toBe("Agent title")
  })

  it("refuses a second undo of the same run and a run nobody wrote, and changes nothing", async () => {
    const { cookie, deck, runId } = await edited()
    expect((await ask(base, "POST", deckRoutes.undo.path, { deck, runId }, cookie)).json).toMatchObject({ ok: true })
    for (const named of [runId, "nosuchrun"]) {
      const again = await ask(base, "POST", deckRoutes.undo.path, { deck, runId: named }, cookie)
      expect(again.json).toEqual({ ok: false, refusal: "run-fenced" })
    }
    const opened = await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)
    expect(opened.json).toMatchObject({ ok: true, revision: 2 })
  })

  it("refuses another account's deck, a missing deck, a malformed call, and a request with no session", async () => {
    const { deck, runId } = await edited()
    const other = await signIn()
    expect((await ask(base, "POST", deckRoutes.undo.path, { deck, runId }, other)).json).toEqual({
      ok: false,
      refusal: "owner",
    })
    expect((await ask(base, "POST", deckRoutes.undo.path, { deck: "nosuchdeck", runId }, other)).json).toEqual({
      ok: false,
      refusal: "deck",
    })
    expect((await ask(base, "POST", deckRoutes.undo.path, { deck }, other)).json).toMatchObject({ ok: false })
    expect((await ask(base, "POST", deckRoutes.undo.path, { deck, runId })).status).toBe(401)
  })
})
