import { scriptOf } from "@airdesign/agent/testing/evals"
import { randomBytes } from "node:crypto"
import { once } from "node:events"
import { request } from "node:http"
import type { Socket } from "node:net"

import { airaTools, countryHeader, doomRoutes } from "@airdesign/catalog"
import { bytesOf } from "@airdesign/doom"
import { Client } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { airaMaxTokens, airaSystem, settleTurn } from "./aira/aira.js"
import { Closing } from "./aira/aira-closing.js"
import { Replay } from "./testing/aira-replay.js"
import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const vietnam = { [countryHeader]: "VN" }
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
let closing: Closing
let brief: Closing
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
  closing = new Closing({ db: session, listen })
  brief = new Closing({ db: session, listen }, 50)
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
  const cookie = await signInByCode(main, mails, email)
  return { email, cookie }
}

function turn(account: Account, base = main) {
  return ask(base, "POST", "/aira/turn", { deck, messages: asked }, account.cookie, vietnam)
}

function stopped(account: Account, name: string) {
  return ask(main, "POST", "/aira/stop", { ask: name }, account.cookie)
}

function leaving(
  account: Account,
  name?: string,
): { readonly socket: () => Socket; readonly leave: () => Promise<void> } {
  const before = sockets.length
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
        `select count(*) from pg_locks where locktype = 'advisory' and not granted
         and database = (select oid from pg_database where datname = current_database())`,
      )
      expect(waiting.rows[0]?.count).toBe("1")
    })
    await client.leave()
    await rowStopped(account.email, null)
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
      expect(waited).toHaveBeenCalledWith(account.email, expect.anything())
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
    expect(stopped).toHaveBeenCalledWith(account.email, expect.anything())
    replay.release()
    await closedAt(account.email, stoppedCharge, "dropped")
    stopped.mockRestore()
  })
})

describe("a stop the browser sends for its ask", () => {
  it("aborts the model call, closes the turn by the same charge, and answers only once the turn is closed", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 3 }, { name: "turn.sse" })
    const reached = replay.hold()
    leaving(account, "ask-one")
    await reached
    const answer = await stopped(account, "ask-one")
    expect(answer.status).toBe(200)
    expect(replay.calls.at(-1)?.signal.aborted).toBe(true)
    expect(await ledgerOf(account.email)).toEqual({ spent: String(stoppedCharge), hold: "0", turn: null })
    expect(await turnsOf(account.email)).toMatchObject([{ outcome: "dropped", charged: String(stoppedCharge) }])
    const next = await turn(account)
    expect(next.status).toBe(200)
    expect(await ledgerOf(account.email)).toEqual({ spent: String(stoppedCharge + turnCharge), hold: "0", turn: null })
    replay.release()
  })

  it("charges once when the stop races the disconnect, and a second stop or one for an ended ask changes nothing", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 3 })
    const reached = replay.hold()
    const client = leaving(account, "ask-two")
    await reached
    const [answer] = await Promise.all([stopped(account, "ask-two"), client.leave()])
    expect(answer.status).toBe(200)
    expect((await stopped(account, "ask-two")).status).toBe(200)
    await closedAt(account.email, stoppedCharge, "dropped")
    replay.release()
  })

  it("leaves a turn of another ask or another account running", async () => {
    const account = await signIn()
    const other = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 3 })
    const reached = replay.hold()
    leaving(account, "ask-three")
    await reached
    expect((await stopped(account, "ask-four")).status).toBe(200)
    expect((await stopped(other, "ask-three")).status).toBe(200)
    expect(replay.calls.at(-1)?.signal.aborted).toBe(false)
    expect(await ledgerOf(account.email)).toMatchObject({ spent: "0", turn: expect.any(String) })
    replay.release()
    await closedAt(account.email, turnCharge, "settled")
  })
})

describe("a stop that names the edit call it cut", () => {
  async function landedEdit(account: Account, once: string) {
    const call = (name: string, args: unknown, named?: string) => ({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args, ...(named === undefined ? {} : { _meta: { "app.airdesign/once": named } }) },
    })
    const headers = { accept: "application/json, text/event-stream" }
    const made = await ask(
      main,
      "POST",
      "/mcp",
      call("airdesign_execute", { script: "createDeck()" }),
      account.cookie,
      headers,
    )
    const reply = made.text.startsWith("{")
      ? made.text
      : (made.text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice(6)
    const created = (
      JSON.parse(reply) as { result: { structuredContent: { deck: string; rev: number; slides: string[] } } }
    ).result.structuredContent
    const answer = await ask(
      main,
      "POST",
      "/mcp",
      call(
        "airdesign_execute",
        {
          deck: created.deck,
          script: scriptOf([{ op: "insert", kind: "text", parent: created.slides[0], text: "Aira" }]),
        },
        once,
      ),
      account.cookie,
      headers,
    )
    expect(answer.text).toContain('"runId"')
    return { deck: created.deck, runId: /"runId":"([^"]+)"/.exec(answer.text)?.[1], slide: created.slides[0] }
  }

  async function editCall(account: Account, deckName: string, slide: string, once: string) {
    return ask(
      main,
      "POST",
      "/mcp",
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "airdesign_execute",
          arguments: {
            deck: deckName,
            script: scriptOf([{ op: "insert", kind: "text", parent: slide, text: "Late" }]),
          },
          _meta: { "app.airdesign/once": once },
        },
      },
      account.cookie,
      { accept: "application/json, text/event-stream" },
    )
  }

  async function opened(account: Account, deckName: string) {
    const answer = await ask(main, "POST", doomRoutes.open.path, { deck: deckName }, account.cookie)
    return JSON.parse(answer.text) as { rev: number; fold: { runs: Record<string, unknown>; nodes: object } }
  }

  it("spends the once of a call that had not landed, so the call arriving after Stop lands nothing", async () => {
    const account = await signIn()
    const { deck: name, slide } = await landedEdit(account, "edit-1")
    const before = await opened(account, name)
    const stopped = await ask(
      main,
      "POST",
      "/aira/stop",
      { ask: "ask-late", call: { deck: name, once: "edit-2" } },
      account.cookie,
    )
    expect(JSON.parse(stopped.text)).toEqual({ ok: true })
    const spent = await opened(account, name)
    await editCall(account, name, slide!, "edit-2")
    const after = await opened(account, name)
    expect(Object.keys(after.fold.runs)).toEqual(Object.keys(before.fold.runs))
    expect(Object.keys(after.fold.nodes)).toEqual(Object.keys(before.fold.nodes))
    expect(after.rev).toBe(spent.rev)
  })

  it("answers the run of a call that landed before its Stop, and spends nothing", async () => {
    const account = await signIn()
    const { deck: name, runId } = await landedEdit(account, "edit-1")
    const before = await opened(account, name)
    const stopped = await ask(
      main,
      "POST",
      "/aira/stop",
      { ask: "ask-landed", call: { deck: name, once: "edit-1" } },
      account.cookie,
    )
    expect(JSON.parse(stopped.text)).toEqual({ ok: true, runId })
    expect((await opened(account, name)).rev).toBe(before.rev)
  })

  it("answers the run the call landed, so the browser can offer Undo for it", async () => {
    const account = await signIn()
    const { deck: name, runId } = await landedEdit(account, "edit-1")
    const answer = await ask(
      main,
      "POST",
      "/aira/stop",
      { ask: "ask-six", call: { deck: name, once: "edit-1" } },
      account.cookie,
    )
    expect(answer.status).toBe(200)
    expect(JSON.parse(answer.text)).toEqual({ ok: true, runId })
  })

  it("answers no run for a call that had not landed, and for a deck of another account", async () => {
    const account = await signIn()
    const other = await signIn()
    const { deck: name } = await landedEdit(account, "edit-1")
    const unsent = await ask(
      main,
      "POST",
      "/aira/stop",
      { ask: "a", call: { deck: name, once: "edit-2" } },
      account.cookie,
    )
    expect(JSON.parse(unsent.text)).toEqual({ ok: true })
    const foreign = await ask(
      main,
      "POST",
      "/aira/stop",
      { ask: "a", call: { deck: name, once: "edit-1" } },
      other.cookie,
    )
    expect(JSON.parse(foreign.text)).toEqual({ ok: true })
  })
})

async function askRow(email: string, name: string | null): Promise<string> {
  const found = await admin.query<{ stopped: boolean }>(
    "select stopped is not null as stopped from session.aira_ask where email = $1 and ask is not distinct from $2",
    [email, name],
  )
  const row = found.rows[0]
  if (row === undefined) return "none"
  return row.stopped ? "stopped" : "live"
}

async function rowStopped(email: string, name: string | null): Promise<void> {
  await vi.waitFor(async () => {
    expect(await askRow(email, name)).toBe("stopped")
  })
}
