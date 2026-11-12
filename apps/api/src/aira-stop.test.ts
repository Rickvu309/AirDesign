import { randomBytes } from "node:crypto"
import { once } from "node:events"
import { request } from "node:http"
import type { Socket } from "node:net"

import { airaTools, signInRoutes } from "@airdesign/catalog"
import { bytesOf } from "@airdesign/document"
import { Client } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { airaMaxTokens, airaSystem, settleTurn } from "./aira.js"
import { Closing } from "./aira-closing.js"
import { Replay } from "./aira-replay.js"
import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const vietnam = { "cf-ipcountry": "VN" }
const deck = "airadeck"
const asked = [{ role: "user", content: "How should slide two open?" }]
const turnCharge = 1_904_000
const stoppedCharge = 412 * 2_000 + airaMaxTokens * 10_000 + 200 * 2_500 + 100 * 100
const wednesday = Date.UTC(2026, 10, 11, 12)

type Account = { readonly email: string; readonly cookie: string }

const mails: Mail[] = []
const lines: string[] = []
const replay = new Replay()
const sockets: Socket[] = []
const closing = new Closing()
const brief = new Closing(50)
let main = ""
let briefBase = ""
let session: Sql = openPool("postgres://session@127.0.0.1/api")
let admin = new Client()
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  session = openPool(info.session, "aira-stop-session")
  const decks = openPool(info.deck, "aira-stop-deck")
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin, application_name: "aira-stop-admin" })
  await admin.connect()
  const settings = {
    on: true,
    key: "test-key-not-real",
    secret: "test-user-secret-not-real-0123456789abcdef",
    transport: replay.transport,
    log: (line: string) => {
      lines.push(line)
    },
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
  served.server.on("connection", (socket: Socket) => {
    sockets.push(socket)
  })
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
  const email = `stop${randomBytes(6).toString("hex")}@example.com`
  await ask(main, "POST", signInRoutes.email.path, { email })
  const code = mails.find((mail) => mail.to === email)?.text.split("\n")[1]
  const response = await ask(main, "POST", signInRoutes.code.path, { email, code })
  const cookie = cookieFrom(response.headers)
  if (cookie === undefined) throw new Error("cookie")
  return { email, cookie }
}

function turn(account: Account, base = main) {
  return ask(base, "POST", "/aira/turn", { deck, messages: asked }, account.cookie, vietnam)
}

function leaving(account: Account): { readonly socket: () => Socket; readonly leave: () => Promise<void> } {
  const before = sockets.length
  const payload = Buffer.from(JSON.stringify({ deck, messages: asked }))
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
  const socket = () => {
    const found = sockets[before]
    if (found === undefined) throw new Error("socket")
    return found
  }
  return {
    socket,
    leave: async () => {
      const closed = once(socket(), "close")
      sent.destroy()
      await closed
    },
  }
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

async function closedAt(email: string, spent: number, outcome: string): Promise<void> {
  await vi.waitFor(
    async () => {
      expect(await ledgerOf(email)).toEqual({ spent: String(spent), hold: "0", turn: null })
      expect(await turnsOf(email)).toMatchObject([{ outcome, charged: String(spent) }])
    },
    { timeout: 5_000 },
  )
}

function reserveOf(): number {
  const input = bytesOf(airaSystem(deck)) + bytesOf(JSON.stringify(airaTools)) + bytesOf(JSON.stringify(asked)) + 64
  return input * 2_000 + airaMaxTokens * 10_000
}

describe("a person who leaves a turn stops its model call and pays for what it could have used", () => {
  it("aborts the model call at once and charges the input it reported and its whole output allowance", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 3 })
    const reached = replay.hold()
    const client = leaving(account)
    await reached
    lines.length = 0
    await client.leave()
    await closedAt(account.email, stoppedCharge, "dropped")
    expect(stoppedCharge).toBeLessThan(reserveOf())
    expect(replay.calls.at(-1)?.signal.aborted).toBe(true)
    const [row] = await turnsOf(account.email)
    expect(lines).toEqual([
      expect.stringMatching(new RegExp(`^aira turn ${row?.id ?? ""} account .* outcome stopped$`)),
    ])
    replay.release()
  })

  it("charges the reserve when the person leaves before the model reported any usage", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 0 })
    const reached = replay.hold()
    const client = leaving(account)
    await reached
    await client.leave()
    await closedAt(account.email, reserveOf(), "dropped")
    replay.release()
  })

  it("settles at the usage message_delta reported when the person leaves during the last event", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 7 })
    const reached = replay.hold()
    const client = leaving(account)
    await reached
    await client.leave()
    await closedAt(account.email, turnCharge, "settled")
    replay.release()
  })

  it("charges nothing and calls no model when the person left before the call was sent", async () => {
    const account = await signIn()
    await turn(account)
    const spent = turnCharge
    const calls = replay.calls.length
    await admin.query("begin")
    await admin.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [account.email])
    const client = leaving(account)
    await vi.waitFor(async () => {
      const waiting = await admin.query<{ count: string }>(
        "select count(*) from pg_locks where locktype = 'advisory' and not granted",
      )
      expect(waiting.rows[0]?.count).toBe("1")
    })
    await client.leave()
    await admin.query("commit")
    await vi.waitFor(async () => {
      expect((await turnsOf(account.email)).map((row) => row.outcome).sort()).toEqual(["released", "settled"])
    })
    expect(await ledgerOf(account.email)).toEqual({ spent: String(spent), hold: "0", turn: null })
    expect(replay.calls.length).toBe(calls)
  })

  it("does not take a normal end for a stop, and a late settlement of a stopped turn changes nothing", async () => {
    const account = await signIn()
    expect((await turn(account)).status).toBe(200)
    expect(replay.calls.at(-1)?.signal.aborted).toBe(false)
    expect(await ledgerOf(account.email)).toMatchObject({ spent: String(turnCharge) })
    const other = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 3 })
    const reached = replay.hold()
    const client = leaving(other)
    await reached
    await client.leave()
    await closedAt(other.email, stoppedCharge, "dropped")
    const [row] = await turnsOf(other.email)
    const counts = { input: 412, output: 57, write5m: 200, write1h: 0, read: 100 }
    await settleTurn(session, other.email, row?.id ?? "", "settled", counts, wednesday)
    await settleTurn(session, other.email, row?.id ?? "", "dropped", counts, wednesday)
    await closedAt(other.email, stoppedCharge, "dropped")
    replay.release()
  })
})

describe("a new ask right after a stop", () => {
  it("is answered once the stopped turn has closed", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 3, lingers: true }, { name: "turn.sse" })
    const reached = replay.hold()
    const client = leaving(account)
    await reached
    const waited = vi.spyOn(closing, "closed")
    await client.leave()
    const second = turn(account)
    await vi.waitFor(() => {
      expect(waited).toHaveBeenCalledWith(account.email)
    })
    replay.release()
    const answer = await second
    expect(answer.status).toBe(200)
    expect(answer.text.trim().split("\n").at(-1)).toContain('"ok":true')
    expect(await ledgerOf(account.email)).toEqual({ spent: String(stoppedCharge + turnCharge), hold: "0", turn: null })
    expect((await turnsOf(account.email)).map((row) => row.outcome).sort()).toEqual(["dropped", "settled"])
    waited.mockRestore()
  })

  it("is refused open when the stopped turn does not close in time", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 3, lingers: true })
    const reached = replay.hold()
    const payload = JSON.stringify({ deck, messages: asked })
    const sent = request({
      method: "POST",
      hostname: "127.0.0.1",
      port: new URL(briefBase).port,
      path: "/aira/turn",
      agent: false,
      headers: { "content-type": "application/json", cookie: account.cookie, ...vietnam },
    })
    sent.on("error", () => undefined)
    sent.end(payload)
    await reached
    const stopped = vi.spyOn(brief, "closed")
    sent.destroy()
    await vi.waitFor(() => {
      expect(replay.calls.at(-1)?.signal.aborted).toBe(true)
    })
    const second = await turn(account, briefBase)
    expect(second.status).toBe(409)
    expect(second.json).toMatchObject({ ok: false, refusal: "open" })
    expect(stopped).toHaveBeenCalledWith(account.email)
    replay.release()
    await closedAt(account.email, stoppedCharge, "dropped")
    stopped.mockRestore()
  })
})
