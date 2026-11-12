import { randomBytes } from "node:crypto"
import { deckRoutes, oauthRoutes, signInRoutes } from "@airdesign/catalog"
import { afterAll, beforeAll, expect, it } from "vitest"
import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { routes } from "./server.js"
import { readSignInMail } from "./sign-in-mail.js"

let base = ""
let cookie = ""
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session)
  const deck = openPool(info.deck)
  const listen = new DeckListen(info.listen)
  const mails: Mail[] = []
  const signed = { url: "https://storage.example/original", expires: "2026-11-11T10:00:00.000Z" }
  const served = await serve({
    session,
    deck,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail) => {
      mails.push(mail)
    },
    originals: {
      upload: async () => ({ ...signed, headers: { "content-length": "5" } }),
      download: async () => signed,
      size: async () => 5,
      delete: async () => {},
    },
  })
  base = served.base
  close = async () => {
    await served.close()
    await listen.close()
    await session.end()
    await deck.end()
  }
  const email = `wire${randomBytes(6).toString("hex")}@example.com`
  await ask(base, "POST", signInRoutes.email.path, { email })
  const { code } = readSignInMail(mails[0]?.text ?? "")
  const response = await ask(base, "POST", signInRoutes.code.path, { email, code })
  cookie = cookieFrom(response.headers) ?? ""
  if (cookie === "") throw new Error("cookie")
})

afterAll(async () => {
  await close()
})

it("serves every catalog deck path with POST and the matching session refusal", async () => {
  for (const route of Object.values(deckRoutes)) {
    expect(routes.filter((served) => served.path === route.path && served.method === "POST")).toHaveLength(1)
    const response = await ask(base, "POST", route.path, {})
    expect(response.status).toBe(401)
    expect(route.result(response.json)).toEqual({ ok: false, refusal: "session" })
  }
})

it("serves every catalog oauth path with POST", () => {
  for (const route of Object.values(oauthRoutes)) {
    expect(routes.filter((served) => served.path === route.path && served.method === route.method)).toHaveLength(1)
  }
})

it("decodes the API's real answers for every deck route without changing their shape", async () => {
  const deck = `wire${randomBytes(6).toString("hex")}`
  const calls = [
    { route: deckRoutes.open, body: { deck } },
    { route: deckRoutes.commit, body: { deck, batch: [{ node: "258.7", value: "hello" }] } },
    { route: deckRoutes.watch, body: { deck, cursor: null } },
    { route: deckRoutes.rename, body: { deck, name: "Wire deck" } },
    { route: deckRoutes.list, body: {} },
    { route: deckRoutes.originalUpload, body: { deck, bytes: 5, sha256: "a".repeat(64) } },
    { route: deckRoutes.originalDone, body: { deck } },
    { route: deckRoutes.original, body: { deck } },
    { route: deckRoutes.trash, body: { deck } },
    { route: deckRoutes.list, body: {} },
    { route: deckRoutes.restore, body: { deck } },
    { route: deckRoutes.trash, body: { deck } },
    { route: deckRoutes.delete, body: { decks: [deck] } },
  ]
  for (const { route, body } of calls) {
    expect(route.read(body).ok).toBe(true)
    const response = await ask(base, "POST", route.path, body, cookie)
    expect(response.status).toBe(200)
    const decoded = route.result(response.json)
    expect(decoded.ok).toBe(true)
    expect(decoded).toEqual(response.json)
  }
})
