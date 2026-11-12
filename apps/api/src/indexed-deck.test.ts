import { deckRoutes, mcpRoutes, oauthRoutes, signInRoutes } from "@airdesign/catalog"
import { elementId, type IndexElement } from "@airdesign/document"
import type { ReadDeckAnswer } from "@airdesign/engine"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, expect, it } from "vitest"
import { ask, askForm, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { challengeOf } from "./secrets.js"
import { readSignInMail } from "./sign-in-mail.js"

let base = ""
let close = async () => {}
const mails: Mail[] = []
let cookie = ""
let stranger = ""
const deck = "indexed-deck"
const box = { x: 10, y: 20, cx: 30, cy: 40 }
const slides = [
  { id: "259", position: 0 },
  { id: "258", position: 1 },
]
const elements: IndexElement[] = Array.from({ length: 120 }, (_, n) => ({
  node: elementId(`${n < 60 ? "259" : "258"}.${String(n + 1)}`),
  kind: "shape",
  value: `Title ${String(n)} ${"text ".repeat(100)}`,
  box,
  grouped: n === 0,
}))

async function sign(email: string): Promise<string> {
  await ask(base, "POST", signInRoutes.email.path, { email })
  const { code } = readSignInMail(mails.find((mail) => mail.to === email)?.text ?? "")
  const signed = await ask(base, "POST", signInRoutes.code.path, { email, code })
  const cookie = cookieFrom(signed.headers)
  if (cookie === undefined) throw new Error("cookie")
  return cookie
}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session)
  const saved = openPool(info.deck)
  const listen = new DeckListen(info.listen)
  const served = await serve({
    session,
    deck: saved,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail) => {
      mails.push(mail)
    },
  })
  base = served.base
  close = async () => {
    await served.close()
    await listen.close()
    await Promise.all([session.end(), saved.end()])
  }
  cookie = await sign("index-owner@example.com")
  stranger = await sign("index-stranger@example.com")
})
afterAll(async () => close())

it("uploads paged floors at revision zero, replays, grants an agent, reads every element, edits, and reads again", async () => {
  expect((await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)).json).toMatchObject({ revision: 0 })
  const page = { deck, once: "first", offset: 0, total: elements.length, slides, elements: elements.slice(0, 100) }
  expect((await ask(base, "POST", deckRoutes.index.path, page, stranger)).json).toEqual({ ok: false, refusal: "owner" })
  expect((await ask(base, "POST", deckRoutes.index.path, page, cookie)).json).toEqual({ ok: true, deck, revision: 0 })
  expect((await ask(base, "POST", deckRoutes.index.path, page, cookie)).json).toEqual({ ok: true, deck, revision: 0 })
  expect(
    (
      await ask(
        base,
        "POST",
        deckRoutes.index.path,
        {
          ...page,
          once: "last",
          offset: 100,
          elements: elements.slice(100),
        },
        cookie,
      )
    ).json,
  ).toEqual({ ok: true, deck, revision: 0 })

  const redirect = "https://agent.example/cb"
  const registered = await ask(base, "POST", oauthRoutes.register.path, { redirect_uris: [redirect] })
  const clientId = (registered.json as { client_id: string }).client_id
  const verifier = "v".repeat(43)
  const approved = await ask(
    base,
    "POST",
    oauthRoutes.approve.path,
    {
      client_id: clientId,
      redirect_uri: redirect,
      code_challenge: challengeOf(verifier),
      code_challenge_method: "S256",
    },
    cookie,
  )
  const token = await askForm(base, oauthRoutes.token.path, {
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirect,
    code_verifier: verifier,
    code: new URL((approved.json as { redirect: string }).redirect).searchParams.get("code") ?? "",
  })
  const bearer = (token.json as { access_token: string }).access_token
  const client = new Client({ name: "index-agent", version: "1" })
  await client.connect(
    new StreamableHTTPClientTransport(new URL(mcpRoutes.mcp.path, base), {
      requestInit: { headers: { authorization: `Bearer ${bearer}` } },
    }),
  )
  try {
    const listed = await client.callTool({ name: "airdesign_list_decks", arguments: {} })
    expect(listed.structuredContent).toMatchObject({ decks: [{ deck }] })
    const seen: IndexElement["node"][] = []
    let cursor: string | undefined
    let first: ReadDeckAnswer | undefined
    do {
      const read = await client.callTool({
        name: "airdesign_read_deck",
        arguments: { deck, ...(cursor === undefined ? {} : { cursor }) },
      })
      const answer = read.structuredContent as ReadDeckAnswer
      first ??= answer
      expect(answer).toMatchObject({ ok: true, revision: 0, slides, index: "ready" })
      expect(answer.elements.every((element) => element.version === 0 && !element.closed)).toBe(true)
      seen.push(...answer.elements.map((element) => element.node))
      cursor = answer.cursor
    } while (cursor !== undefined)
    expect(first?.cursor).toBeDefined()
    expect(new Set(seen)).toEqual(new Set(elements.map((element) => element.node)))
    const node = elements[1]!.node
    const edit = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: { deck, base: 0, changes: [{ node, readAt: 0, value: "After" }] },
    })
    expect(edit.isError).not.toBe(true)
    const after = await client.callTool({ name: "airdesign_read_deck", arguments: { deck, slide: "259" } })
    const answer = after.structuredContent as ReadDeckAnswer
    expect(answer.revision).toBeGreaterThan(0)
    expect(answer.elements.find((element) => element.node === node)).toMatchObject({ value: "After", version: 1, box })
    const group = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: {
        deck,
        base: answer.revision,
        changes: [{ node: elements[0]!.node, readAt: 0, property: "box", value: box }],
      },
    })
    expect(group.structuredContent).toMatchObject({ ok: false, refusal: "group-box" })
  } finally {
    await client.close()
  }
})
