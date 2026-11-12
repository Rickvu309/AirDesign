import { randomBytes } from "node:crypto"

import { countryHeader, forwardSecretHeader, signInRoutes } from "@airdesign/catalog"
import type { CallerLog } from "@airdesign/mcp"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { Replay } from "./aira-replay.js"
import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const fakeKey = "test-key-not-real"
const secret = "test-user-secret-not-real-0123456789abcdef"
const sharedSecret = "forward-secret-test-value-12345"
const wrongSecret = "forward-secret-wrong-value-99999"
const vietnam = { [countryHeader]: "VN" }
const words = "How should slide two open?"
const deck = "airadeck"
const asked = [{ role: "user", content: words }]
const wednesday = Date.UTC(2026, 10, 11, 12)

type Account = { readonly email: string; readonly cookie: string }

const mails: Mail[] = []
const lines: string[] = []
const replay = new Replay()
const logs = new Map<string, CallerLog>()
let clock = wednesday
let protectedBase = ""
let unprotectedBase = ""
let session: Sql = openPool("postgres://session@127.0.0.1/api")
let close = async () => {}

function serveWith(listen: DeckListen, deck: Sql, forwardSecret?: string) {
  return serve({
    ...origins,
    session,
    deck,
    listen,
    logs,
    now: () => clock,
    ...(forwardSecret === undefined ? {} : { forwardSecret }),
    send: async (mail) => {
      mails.push(mail)
    },
    aira: {
      on: true,
      key: fakeKey,
      secret,
      transport: replay.transport,
      log: (line) => {
        lines.push(line)
      },
    },
  })
}

beforeAll(async () => {
  const info = await postgresInfo()
  session = openPool(info.session, "forward-session")
  const deck = openPool(info.deck, "forward-deck")
  const listen = new DeckListen(info.listen)
  const protectedServer = await serveWith(listen, deck, sharedSecret)
  const unprotectedServer = await serveWith(listen, deck, undefined)
  protectedBase = protectedServer.base
  unprotectedBase = unprotectedServer.base
  close = async () => {
    await protectedServer.close()
    await unprotectedServer.close()
    await listen.close()
    await session.end()
    await deck.end()
  }
})

afterAll(async () => {
  await close()
})

beforeEach(() => {
  clock = wednesday
  replay.play({ name: "turn.sse" })
})

async function signIn(base: string): Promise<Account> {
  const email = `forward${randomBytes(6).toString("hex")}@example.com`
  await ask(base, "POST", signInRoutes.email.path, { email })
  const code = mails.find((mail) => mail.to === email)?.text.split("\n")[1]
  const response = await ask(base, "POST", signInRoutes.code.path, { email, code })
  const cookie = cookieFrom(response.headers)
  if (cookie === undefined) throw new Error("cookie")
  return { email, cookie }
}

describe("forward secret protection", () => {
  it("accepts visitor country when forward secret matches", async () => {
    const account = await signIn(protectedBase)
    const reply = await ask(protectedBase, "POST", "/aira/turn", { deck, messages: asked }, account.cookie, {
      ...vietnam,
      [forwardSecretHeader]: sharedSecret,
    })
    expect(reply.status).toBe(200)
    expect(reply.text).toContain('{"type":"text","text":"Lead with the claim."}')
  })

  it("refuses Aira with country when forward secret is missing", async () => {
    const account = await signIn(protectedBase)
    const reply = await ask(protectedBase, "POST", "/aira/turn", { deck, messages: asked }, account.cookie, vietnam)
    expect(reply.status).toBe(403)
    expect(reply.json).toEqual({ ok: false, refusal: "country" })
  })

  it("refuses Aira with country when forward secret is wrong", async () => {
    const account = await signIn(protectedBase)
    const reply = await ask(protectedBase, "POST", "/aira/turn", { deck, messages: asked }, account.cookie, {
      ...vietnam,
      [forwardSecretHeader]: wrongSecret,
    })
    expect(reply.status).toBe(403)
    expect(reply.json).toEqual({ ok: false, refusal: "country" })
  })

  it("allows health check directly without forward secret", async () => {
    const reply = await ask(protectedBase, "GET", "/health", undefined)
    expect(reply.status).toBe(200)
    expect(reply.json).toEqual({ ok: true })
  })

  it("trusts visitor country when forward secret is unset on the server", async () => {
    const account = await signIn(unprotectedBase)
    const reply = await ask(unprotectedBase, "POST", "/aira/turn", { deck, messages: asked }, account.cookie, vietnam)
    expect(reply.status).toBe(200)
    expect(reply.text).toContain('{"type":"text","text":"Lead with the claim."}')
  })
})
