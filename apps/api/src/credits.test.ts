import { randomBytes } from "node:crypto"
import { airaRoutes, creditsRoutes, countryHeader, accountRoutes } from "@airdesign/catalog"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Replay } from "./testing/aira-replay.js"
import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

const mails: Mail[] = []
const replay = new Replay()
const wednesday = Date.UTC(2026, 10, 11, 12)
let clock = wednesday
let main = ""
let admin = new Client()
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "credits-session")
  const deck = openPool(info.deck, "credits-deck")
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  const served = await serve({
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    session,
    deck,
    listen,
    now: () => clock,
    send: async (mail) => {
      mails.push(mail)
    },
    aira: {
      on: true,
      key: "test-key-not-real",
      secret: "test-secret-not-real",
      transport: replay.transport,
      log: () => undefined,
    },
  })
  main = served.base
  close = async () => {
    await served.close()
    await listen.close()
    await admin.end()
    await session.end()
    await deck.end()
  }
})
afterAll(async () => {
  await close()
})

async function account() {
  clock = wednesday
  const email = `credits${randomBytes(6).toString("hex")}@example.com`
  return { email, cookie: await signInByCode(main, mails, email) }
}
function call(route: { path: string }, cookie?: string, body: unknown = {}, headers: Record<string, string> = {}) {
  return ask(main, "POST", route.path, body, cookie, headers)
}
async function seed(email: string, cents = 1500, spent = 2_000_000_000, autoReset = false) {
  await admin.query("insert into session.credits (email,cents,auto_reset) values ($1,$2,$3)", [email, cents, autoReset])
  await admin.query("insert into session.aira_ledger (email,monday,spent) values ($1,$2,$3)", [
    email,
    new Date(Date.UTC(2026, 10, 9)),
    spent,
  ])
}
function turn(cookie: string, content = "Hi") {
  replay.play({ name: "turn.sse" })
  return call(
    airaRoutes.turn,
    cookie,
    { deck: "creditsdeck", messages: [{ role: "user", content }] },
    { [countryHeader]: "VN" },
  )
}

describe("credits and usage resets", () => {
  it("starts empty with auto reset off and requires a session", async () => {
    const user = await account()
    const read = await call(creditsRoutes.read, user.cookie)
    expect([read.status, read.json]).toEqual([200, { ok: true, credits: { cents: 0, autoReset: false, history: [] } }])
    expect(read.headers["cache-control"]).toBe("no-store")
    for (const route of Object.values(creditsRoutes)) {
      expect((await call(route)).status).toBe(401)
      expect((await call(route, user.cookie, {}, { authorization: "Bearer not-real" })).status).toBe(401)
    }
  })
  it("resets for $5 once across concurrent and retried requests, retaining the calendar reset", async () => {
    const user = await account()
    await seed(user.email)
    const replies = await Promise.all([
      call(creditsRoutes.reset, user.cookie, { once: "first" }),
      call(creditsRoutes.reset, user.cookie, { once: "first" }),
    ])
    expect(replies.map((reply) => reply.status)).toEqual([200, 200])
    expect(replies[0]?.json).toMatchObject({ credits: { cents: 1000, history: [{ cents: -500, kind: "reset" }] } })
    expect((await call(airaRoutes.usage, user.cookie)).json).toMatchObject({
      usage: { used: 0, resets: "2026-11-16T00:00:00.000Z" },
    })
    await admin.query("update session.aira_ledger set spent = 100000 where email=$1", [user.email])
    expect((await call(creditsRoutes.reset, user.cookie, { once: "first" })).status).toBe(200)
    expect((await call(airaRoutes.usage, user.cookie)).json).toMatchObject({ usage: { used: 0.0001 } })
    expect((await call(creditsRoutes.read, user.cookie)).json).toMatchObject({
      credits: { cents: 1000, history: [{ cents: -500 }] },
    })
  })
  it("charges only once when two tabs request different resets, and isolates accounts", async () => {
    const user = await account()
    const other = await account()
    await seed(user.email)
    await seed(other.email)
    const replies = await Promise.all([
      call(creditsRoutes.reset, user.cookie, { once: "tab-one" }),
      call(creditsRoutes.reset, user.cookie, { once: "tab-two" }),
    ])
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409])
    expect((await call(creditsRoutes.read, user.cookie)).json).toMatchObject({
      credits: { cents: 1000, history: [{ cents: -500 }] },
    })
    expect((await call(creditsRoutes.read, other.cookie)).json).toEqual({
      ok: true,
      credits: { cents: 1500, autoReset: false, history: [] },
    })
  })
  it("does not charge an empty week, insufficient credits, or an open turn", async () => {
    for (const [cents, spent, refusal] of [
      [1500, 0, "empty"],
      [499, 2_000_000_000, "credits"],
    ] as const) {
      const user = await account()
      await seed(user.email, cents, spent)
      expect((await call(creditsRoutes.reset, user.cookie, { once: "reset" })).json).toEqual({ ok: false, refusal })
      expect((await call(creditsRoutes.read, user.cookie)).json).toMatchObject({ credits: { cents, history: [] } })
    }
    const user = await account()
    await seed(user.email)
    await admin.query("update session.aira_ledger set turn='running',hold=1000 where email=$1", [user.email])
    expect((await call(creditsRoutes.reset, user.cookie, { once: "reset" })).json).toEqual({
      ok: false,
      refusal: "open",
    })
    expect((await call(creditsRoutes.read, user.cookie)).json).toMatchObject({ credits: { cents: 1500, history: [] } })
  })
  it("persists opt-in, then auto resets when a new Aira request needs it", async () => {
    const user = await account()
    await seed(user.email)
    expect((await call(creditsRoutes.autoReset, user.cookie, { enabled: true })).json).toMatchObject({
      credits: { autoReset: true },
    })
    expect((await turn(user.cookie)).status).toBe(200)
    expect((await call(creditsRoutes.read, user.cookie)).json).toMatchObject({
      credits: { cents: 1000, autoReset: true, history: [{ cents: -500 }] },
    })
    expect((await turn(user.cookie)).status).toBe(200)
    expect((await call(creditsRoutes.read, user.cookie)).json).toMatchObject({
      credits: { cents: 1000, history: [{ cents: -500 }] },
    })
    expect((await call(creditsRoutes.autoReset, user.cookie, { enabled: false })).json).toMatchObject({
      credits: { autoReset: false },
    })
    await admin.query("update session.aira_ledger set spent = 2000000000 where email=$1", [user.email])
    expect((await turn(user.cookie)).status).toBe(402)
    expect((await call(creditsRoutes.read, user.cookie)).json).toMatchObject({
      credits: { cents: 1000, autoReset: false, history: [{ cents: -500 }] },
    })
  })
  it("does not charge at weekly renewal, without opt-in, or without sufficient credits", async () => {
    for (const [cents, enabled] of [
      [1500, false],
      [499, true],
    ] as const) {
      const user = await account()
      await seed(user.email, cents, 2_000_000_000, enabled)
      expect((await turn(user.cookie)).status).toBe(402)
      expect((await call(creditsRoutes.read, user.cookie)).json).toMatchObject({ credits: { cents, history: [] } })
    }
    const user = await account()
    await seed(user.email, 1500, 2_000_000_000, true)
    clock = Date.UTC(2026, 10, 16, 1)
    expect((await call(creditsRoutes.reset, user.cookie, { once: "monday" })).json).toEqual({
      ok: false,
      refusal: "empty",
    })
    expect((await turn(user.cookie)).status).toBe(200)
    expect((await call(creditsRoutes.read, user.cookie)).json).toMatchObject({ credits: { cents: 1500, history: [] } })
  })
  it("rejects malformed fields and deletes credits with the account", async () => {
    const user = await account()
    await seed(user.email)
    for (const [route, body] of [
      [creditsRoutes.reset, {}],
      [creditsRoutes.reset, { once: "x", cents: 5000 }],
      [creditsRoutes.autoReset, { enabled: "true" }],
      [creditsRoutes.read, { email: user.email }],
    ] as const) {
      expect((await call(route, user.cookie, body)).status).toBe(400)
    }
    expect((await call(creditsRoutes.reset, user.cookie, { once: "delete" })).status).toBe(200)
    expect((await call(accountRoutes.delete, user.cookie, { email: user.email })).status).toBe(200)
    expect((await admin.query("select 1 from session.credits where email=$1", [user.email])).rowCount).toBe(0)
    expect((await admin.query("select 1 from session.credit_history where email=$1", [user.email])).rowCount).toBe(0)
  })
})
