import { randomBytes } from "node:crypto"
import { request } from "node:http"

import { airaTools, countryHeader } from "@airdesign/catalog"
import { bytesOf } from "@airdesign/document"
import { Client } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { airaMaxTokens, airaSystem } from "./aira.js"
import { Closing } from "./aira-closing.js"
import { Replay } from "./aira-replay.js"
import { ask, postgresInfo, serve, signInByCode } from "./harness.js"
import { heldQueries, type HeldQueries } from "./held-queries.js"
import { DeckListen, openPool, type Mail } from "./index.js"

const vietnam = { [countryHeader]: "VN" }
const deck = "airadeck"
const asked = [{ role: "user", content: "How should slide two open?" }]
const turnCharge = 1_904_000
const wednesday = Date.UTC(2026, 10, 11, 12)

type Account = { readonly email: string; readonly cookie: string }

const mails: Mail[] = []
const replay = new Replay()
let held: HeldQueries
let main = ""
let briefBase = ""
let admin = new Client()
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "aira-stop-order-session")
  const decks = openPool(info.deck, "aira-stop-order-deck")
  const listen = new DeckListen(info.listen)
  held = heldQueries(session)
  const closing = new Closing({ db: held.db, listen })
  const brief = new Closing({ db: session, listen }, 50)
  admin = new Client({ connectionString: info.admin, application_name: "aira-stop-order-admin" })
  await admin.connect()
  const settings = {
    on: true,
    key: "test-key-not-real",
    secret: "test-user-secret-not-real-0123456789abcdef",
    transport: replay.transport,
  }
  const options = {
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    session,
    deck: decks,
    listen,
    now: () => wednesday,
    send: async (mail: Mail) => {
      mails.push(mail)
    },
    aira: settings,
  }
  const served = await serve({ ...options, closing })
  const briefServed = await serve({ ...options, closing: brief })
  main = served.base
  briefBase = briefServed.base
  close = async () => {
    await served.close()
    await briefServed.close()
    await listen.close()
    await admin.end()
    await session.end()
    await decks.end()
  }
})

afterAll(async () => {
  await close()
})

beforeEach(() => {
  replay.play({ name: "turn.sse" })
})

async function signIn(): Promise<Account> {
  const email = `order${randomBytes(6).toString("hex")}@example.com`
  const cookie = await signInByCode(main, mails, email)
  return { email, cookie }
}

function turn(account: Account, name: string) {
  return ask(main, "POST", "/aira/turn", { deck, messages: asked, ask: name }, account.cookie, vietnam)
}

function stopped(account: Account, name: string) {
  return ask(main, "POST", "/aira/stop", { ask: name }, account.cookie)
}

function stopFrom(base: string, account: Account, name: string) {
  return ask(base, "POST", "/aira/stop", { ask: name }, account.cookie)
}

function leaving(account: Account, name: string): void {
  const payload = Buffer.from(JSON.stringify({ deck, messages: asked, ask: name }))
  const sent = request({
    method: "POST",
    hostname: "127.0.0.1",
    port: new URL(main).port,
    path: "/aira/turn",
    agent: false,
    headers: {
      "content-type": "application/json",
      "content-length": String(payload.length),
      cookie: account.cookie,
      ...vietnam,
    },
  })
  sent.on("error", () => undefined)
  sent.end(payload)
}

async function ledgerOf(email: string) {
  const found = await admin.query<{ spent: string; hold: string; turn: string | null }>(
    "select spent, hold, turn from session.aira_ledger where email = $1",
    [email],
  )
  return found.rows[0]
}

async function turnsOf(email: string) {
  const found = await admin.query<{ id: string; outcome: string; charged: string | null }>(
    "select id, outcome, charged from session.aira_turn where email = $1 order by started, id",
    [email],
  )
  return found.rows
}

function reserveOf(): number {
  const input = bytesOf(airaSystem(deck)) + bytesOf(JSON.stringify(airaTools)) + bytesOf(JSON.stringify(asked)) + 64
  return input * 2_000 + airaMaxTokens * 10_000
}

const followed = "insert into session.aira_ask"
const stoppedRead = "select stopped is not null as stopped from session.aira_ask"
const liveRead = "as live"

async function askRow(email: string, name: string): Promise<string> {
  const found = await admin.query<{ stopped: boolean }>(
    "select stopped is not null as stopped from session.aira_ask where email = $1 and ask is not distinct from $2",
    [email, name],
  )
  const row = found.rows[0]
  if (row === undefined) return "none"
  return row.stopped ? "stopped" : "live"
}

async function rowStopped(email: string, name: string): Promise<void> {
  await vi.waitFor(async () => {
    expect(await askRow(email, name)).toBe("stopped")
  })
}

async function reserveHeld(account: Account, name: string): Promise<void> {
  const reads = held.times(stoppedRead)
  await admin.query("begin")
  await admin.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [account.email])
  leaving(account, name)
  await vi.waitFor(async () => {
    const waiting = await admin.query<{ count: string }>(
      `select count(*) from pg_locks where locktype = 'advisory' and not granted
       and database = (select oid from pg_database where datname = current_database())`,
    )
    expect(waiting.rows[0]?.count).toBe("1")
    expect(held.times(stoppedRead)).toBeGreaterThan(reads)
  })
}

async function releasedUncharged(account: Account, calls: number): Promise<void> {
  await vi.waitFor(async () => {
    expect((await turnsOf(account.email)).map((row) => row.outcome === "open")).toEqual([false])
  })
  expect(await turnsOf(account.email)).toMatchObject([{ outcome: "released", charged: "0" }])
  expect(await ledgerOf(account.email)).toEqual({ spent: "0", hold: "0", turn: null })
  expect(replay.calls.length).toBe(calls)
}

describe("a stop and its ask in each order, held at the server", () => {
  it("before the server followed the ask: no model call and nothing charged", async () => {
    const account = await signIn()
    const calls = replay.calls.length
    const admit = held.hold(followed)
    leaving(account, "before-follow")
    await admit.reached
    expect(JSON.parse((await stopped(account, "before-follow")).text)).toEqual({ ok: true })
    admit.release()
    await releasedUncharged(account, calls)
  })

  it("between follow and reserve on the same server: no model call and nothing charged", async () => {
    const account = await signIn()
    const calls = replay.calls.length
    await reserveHeld(account, "before-reserve")
    const answer = stopped(account, "before-reserve")
    await rowStopped(account.email, "before-reserve")
    await admin.query("commit")
    expect((await answer).status).toBe(200)
    await releasedUncharged(account, calls)
  })

  it("between follow and reserve from another server whose wake is late: no model call and nothing charged", async () => {
    const account = await signIn()
    const calls = replay.calls.length
    await reserveHeld(account, "late-wake")
    const wake = held.hold(stoppedRead)
    const answer = stopFrom(briefBase, account, "late-wake")
    await rowStopped(account.email, "late-wake")
    await wake.reached
    await admin.query("commit")
    await releasedUncharged(account, calls)
    wake.release()
    expect((await answer).status).toBe(200)
  })

  it("between reserve and the model call on the same server: no model call and nothing charged", async () => {
    const account = await signIn()
    const calls = replay.calls.length
    await reserveHeld(account, "before-send")
    const send = held.hold(liveRead)
    await admin.query("commit")
    await send.reached
    const answer = stopped(account, "before-send")
    await rowStopped(account.email, "before-send")
    send.release()
    expect((await answer).status).toBe(200)
    await releasedUncharged(account, calls)
  })

  it("between reserve and the model call from another server whose wake is late: no model call and nothing charged", async () => {
    const account = await signIn()
    const calls = replay.calls.length
    await reserveHeld(account, "late-send")
    const wake = held.hold(stoppedRead)
    const send = held.hold(liveRead)
    await admin.query("commit")
    await send.reached
    const answer = stopFrom(briefBase, account, "late-send")
    await rowStopped(account.email, "late-send")
    await wake.reached
    send.release()
    await releasedUncharged(account, calls)
    wake.release()
    expect((await answer).status).toBe(200)
  })

  it("during the model call: the call is aborted and charged its reserve, as any stopped call is", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 0 })
    const reached = replay.hold()
    leaving(account, "during-call")
    await reached
    expect((await stopped(account, "during-call")).status).toBe(200)
    expect(replay.calls.at(-1)?.signal.aborted).toBe(true)
    expect(await turnsOf(account.email)).toMatchObject([{ outcome: "dropped", charged: String(reserveOf()) }])
    replay.release()
  })

  it("after the model call: the stop changes nothing", async () => {
    const account = await signIn()
    expect((await turn(account, "after-call")).status).toBe(200)
    expect(JSON.parse((await stopped(account, "after-call")).text)).toEqual({ ok: true })
    expect(await turnsOf(account.email)).toMatchObject([{ outcome: "settled", charged: String(turnCharge) }])
    expect(await ledgerOf(account.email)).toEqual({ spent: String(turnCharge), hold: "0", turn: null })
  })
})
