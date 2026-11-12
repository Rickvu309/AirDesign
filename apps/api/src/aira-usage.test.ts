import { randomBytes } from "node:crypto"

import { airaRoutes, countryHeader } from "@airdesign/catalog"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { Replay } from "./aira-replay.js"
import { ask, postgresInfo, serve, signInByCode } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const secret = "test-user-secret-not-real-0123456789abcdef"
const wednesday = Date.UTC(2026, 10, 11, 12)
const turnCharge = 1_904_000
const nano = 1_000_000_000
const mails: Mail[] = []
const replay = new Replay()
let clock = wednesday
let main = ""
let off = ""
let admin = new Client()
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "usage-session")
  const deck = openPool(info.deck, "usage-deck")
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin, application_name: "usage-admin" })
  await admin.connect()
  const served = (on: boolean) =>
    serve({
      ...origins,
      session,
      deck,
      listen,
      now: () => clock,
      send: async (mail) => {
        mails.push(mail)
      },
      aira: { on, key: "test-key-not-real", secret, transport: replay.transport, log: () => undefined },
    })
  const onServed = await served(true)
  const offServed = await served(false)
  main = onServed.base
  off = offServed.base
  close = async () => {
    await onServed.close()
    await offServed.close()
    await listen.close()
    await admin.end()
    await session.end()
    await deck.end()
  }
})

afterAll(async () => {
  await close()
})

async function signIn(): Promise<{ email: string; cookie: string }> {
  const email = `usage${randomBytes(6).toString("hex")}@example.com`
  const cookie = await signInByCode(main, mails, email)
  return { email, cookie }
}

function usageOf(cookie: string | undefined, headers: Record<string, string> = {}, base = main, body: unknown = {}) {
  return ask(base, airaRoutes.usage.method, airaRoutes.usage.path, body, cookie, headers)
}

async function ledgerRows(email: string): Promise<number> {
  const found = await admin.query("select 1 from session.aira_ledger where email = $1", [email])
  return found.rowCount ?? 0
}

describe("POST /aira/usage answers the week's usage without a model call", () => {
  it("answers nothing used and next Monday for an account that never asked, and writes no ledger row", async () => {
    clock = wednesday
    const account = await signIn()
    const answer = await usageOf(account.cookie, { [countryHeader]: "VN" })
    expect([answer.status, answer.json]).toEqual([
      200,
      {
        ok: true,
        account: { email: account.email },
        usage: { used: 0, allowed: 2, resets: "2026-11-16T00:00:00.000Z" },
        available: true,
      },
    ])
    expect(answer.headers["cache-control"]).toBe("no-store")
    expect(await ledgerRows(account.email)).toBe(0)
  })

  it("says Aira is not available when the visitor's country is not offered or unknown, and still answers the numbers", async () => {
    clock = wednesday
    const account = await signIn()
    for (const headers of [{ [countryHeader]: "CN" }, { [countryHeader]: "" }, {}]) {
      const answer = await usageOf(account.cookie, headers)
      expect([answer.status, answer.json]).toMatchObject([
        200,
        { ok: true, available: false, usage: { used: 0, allowed: 2 } },
      ])
    }
  })

  it("answers the same numbers the last turn's answer carried, and zero once the week turns over", async () => {
    clock = wednesday
    replay.play({ name: "turn.sse" })
    const account = await signIn()
    const turned = await ask(
      main,
      "POST",
      airaRoutes.turn.path,
      { deck: "usagedeck", messages: [{ role: "user", content: "Hi" }] },
      account.cookie,
      { [countryHeader]: "VN" },
    )
    const end = JSON.parse(turned.text.trim().split("\n").at(-1) ?? "{}") as { usage?: unknown }
    expect(end.usage).toEqual({ used: turnCharge / nano, allowed: 2, resets: "2026-11-16T00:00:00.000Z" })
    expect((await usageOf(account.cookie)).json).toMatchObject({ usage: end.usage })
    clock = Date.UTC(2026, 10, 16, 1)
    expect((await usageOf(account.cookie)).json).toMatchObject({
      usage: { used: 0, allowed: 2, resets: "2026-11-23T00:00:00.000Z" },
    })
    const kept = await admin.query<{ spent: string }>("select spent from session.aira_ledger where email = $1", [
      account.email,
    ])
    expect(kept.rows[0]?.spent).toBe(String(turnCharge))
  })

  it("answers the numbers when Aira is switched off for the server", async () => {
    clock = wednesday
    const account = await signIn()
    expect((await usageOf(account.cookie, {}, off)).json).toMatchObject({
      ok: true,
      usage: { used: 0, allowed: 2, resets: "2026-11-16T00:00:00.000Z" },
    })
  })

  it("refuses a request with no session, an agent's bearer token with or without a session, and fields", async () => {
    const account = await signIn()
    const bearer = { authorization: "Bearer agent-token-not-real" }
    for (const answer of [
      await usageOf(undefined),
      await usageOf(undefined, bearer),
      await usageOf(account.cookie, bearer),
    ]) {
      expect([answer.status, answer.json]).toEqual([401, { ok: false, refusal: "session" }])
    }
    const extra = await usageOf(account.cookie, {}, main, { email: account.email })
    expect([extra.status, extra.json]).toEqual([400, { ok: false, refusal: "field" }])
  })
})
