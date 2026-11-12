import { deckRoutes, mcpRoutes, signInRoutes } from "@airdesign/catalog"
import { elementId, writeTextValue } from "@airdesign/document"
import { afterAll, beforeAll, expect, it } from "vitest"
import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { readSignInMail } from "./sign-in-mail.js"

let base = ""
let close = async () => {}
let deckPool: ReturnType<typeof openPool>
let cookie = ""
const mails: Mail[] = []
const owner = "arriving@example.com"
const row = {
  node: elementId("256.2"),
  kind: "shape",
  value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }]),
  box: null,
  grouped: false,
} as const
const page = (deck: string) => ({
  deck,
  once: "index",
  offset: 0,
  total: 1,
  slides: [{ id: "256", position: 0, layout: [row] }],
  elements: [row],
})

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session)
  deckPool = openPool(info.deck)
  const listen = new DeckListen(info.listen)
  const served = await serve({
    session,
    deck: deckPool,
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
    await Promise.all([session.end(), deckPool.end()])
  }
  await ask(base, "POST", signInRoutes.email.path, { email: owner })
  const { code } = readSignInMail(mails.find((mail) => mail.to === owner)?.text ?? "")
  const cookieHeader = cookieFrom((await ask(base, "POST", signInRoutes.code.path, { email: owner, code })).headers)
  if (cookieHeader === undefined) throw new Error("cookie")
  cookie = cookieHeader
})
afterAll(async () => close())

async function tool(name: string, args: unknown): Promise<{ text: string; answer: Record<string, unknown> }> {
  const response = await fetch(`${base}${mcpRoutes.mcp.path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", cookie },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const data = (await response.text()).split("\n").find((line) => line.startsWith("data:")) ?? "data:{}"
  const result = JSON.parse(data.slice("data:".length)).result
  return { text: result.content[0].text, answer: result.structuredContent }
}

it("answers an add_slide before the index as indexing, never counts it, and lands it once the index is in", async () => {
  const deck = "arriving-count"
  await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)
  const call = { deck, base: 0, after: "256", layout: "256" }
  for (let n = 0; n < 35; n += 1) {
    const refused = await tool("airdesign_add_slide", call)
    expect(refused.answer).toMatchObject({ ok: false, refusal: "indexing" })
    expect(refused.text).toContain("still being indexed")
  }
  expect((await ask(base, "POST", deckRoutes.index.path, page(deck), cookie)).json).toMatchObject({ ok: true })
  expect((await tool("airdesign_add_slide", call)).answer).toMatchObject({ ok: true, slide: "257" })
})
