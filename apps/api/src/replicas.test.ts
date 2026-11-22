import { randomBytes } from "node:crypto"
import { once } from "node:events"
import { request } from "node:http"
import type { Socket } from "node:net"

import { countryHeader, doomRoutes } from "@airdesign/catalog"
import { airaMaxTokens } from "./aira/aira.js"
import { Client as McpClient, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { Client } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { Closing } from "./aira/aira-closing.js"
import { Replay } from "./testing/aira-replay.js"
import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const vietnam = { [countryHeader]: "VN" }
const deck = "replicadeck"
const asked = [{ role: "user", content: "How should slide two open?" }]
const turnCharge = 1_904_000
const stoppedCharge = 412 * 2_000 + airaMaxTokens * 10_000 + 200 * 2_500 + 100 * 100
const wednesday = Date.UTC(2026, 10, 11, 12)
const toolLimit = "Thirty tool calls in five minutes. The next tool call can run in 300 seconds."
const turnLimit = "Twenty turns in five minutes. The next turn can start in 300 seconds."

type Account = { readonly email: string; readonly cookie: string }
type Replica = {
  readonly base: string
  readonly sockets: Socket[]
  readonly closing: Closing
  readonly close: () => Promise<void>
}

const mails: Mail[] = []
const replay = new Replay()
let session: Sql = openPool("postgres://session@127.0.0.1/api")
let first: Replica = {
  base: "",
  sockets: [],
  closing: new Closing({ db: session, listen: new DeckListen("") }),
  close: async () => {},
}
let second: Replica = first
let replica: () => Promise<Replica> = async () => first
let admin = new Client()
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  session = openPool(info.session, "replicas-session")
  const decks = openPool(info.deck, "replicas-deck")
  admin = new Client({ connectionString: info.admin, application_name: "replicas-admin" })
  await admin.connect()
  const started: Replica[] = []
  replica = async () => {
    const listen = new DeckListen(info.listen)
    const closing = new Closing({ db: session, listen })
    const served = await serve({
      publicOrigin: "https://app.example",
      siteOrigin: "https://site.example",
      session,
      deck: decks,
      listen,
      closing,
      now: () => wednesday,
      send: async (mail: Mail) => {
        mails.push(mail)
      },
      aira: {
        on: true,
        key: "test-key-not-real",
        secret: "test-user-secret-not-real-0123456789abcdef",
        transport: replay.transport,
        log: () => undefined,
      },
    })
    const sockets: Socket[] = []
    served.server.on("connection", (socket: Socket) => {
      sockets.push(socket)
    })
    const made = {
      base: served.base,
      sockets,
      closing,
      close: async () => {
        await served.close()
        await listen.close()
      },
    }
    started.push(made)
    return made
  }
  first = await replica()
  second = await replica()
  close = async () => {
    for (const made of started) await made.close()
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
  const email = `replica${randomBytes(6).toString("hex")}@example.com`
  const cookie = await signInByCode(first.base, mails, email)
  return { email, cookie }
}

function turn(account: Account, on: Replica) {
  return ask(on.base, "POST", "/aira/turn", { deck, messages: asked }, account.cookie, vietnam)
}

function stopped(account: Account, name: string, on: Replica) {
  return ask(on.base, "POST", "/aira/stop", { ask: name }, account.cookie)
}

function leaving(account: Account, on: Replica, name?: string): { readonly leave: () => Promise<void> } {
  const before = on.sockets.length
  const payload = Buffer.from(JSON.stringify({ deck, messages: asked, ask: name }))
  const sent = request({
    method: "POST",
    hostname: "127.0.0.1",
    port: new URL(on.base).port,
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
  return {
    leave: async () => {
      const socket = on.sockets[before]
      if (socket === undefined) throw new Error("socket")
      const closed = once(socket, "close")
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
  const found = await admin.query<{ outcome: string; charged: string | null }>(
    "select outcome, charged from session.aira_turn where email = $1 order by started, id",
    [email],
  )
  return found.rows
}

async function withMcp(cookie: string, on: Replica, use: (client: McpClient) => Promise<void>): Promise<void> {
  const transport = new StreamableHTTPClientTransport(new URL(`${on.base}/mcp`), {
    requestInit: { headers: { cookie } },
  })
  const client = new McpClient({ name: "airdesign-test", version: "0.0.0" })
  await client.connect(transport)
  try {
    await use(client)
  } finally {
    await client.close()
  }
}

async function called(client: McpClient, name: string, args: Record<string, unknown>) {
  return (await client.callTool({ name: `airdesign_${name}`, arguments: args })).structuredContent as Record<
    string,
    any
  >
}

async function listed(client: McpClient) {
  return client.callTool({ name: "airdesign_list_decks", arguments: {} })
}

describe("the limits an account's calls share hold on every server and after a restart", () => {
  it("refuses the thirty-first tool call when the thirty landed on two servers, and on a server started after", async () => {
    const account = await signIn()
    for (const on of [first, second]) {
      await withMcp(account.cookie, on, async (client) => {
        for (let call = 0; call < 15; call += 1) {
          expect((await listed(client)).isError).toBeFalsy()
        }
      })
    }
    for (const on of [first, second, await replica()]) {
      await withMcp(account.cookie, on, async (client) => {
        expect((await listed(client)).content).toEqual([{ type: "text", text: toolLimit }])
      })
    }
  })

  it("refuses the twenty-first Aira turn when the twenty ran on two servers, and on a server started after", async () => {
    const account = await signIn()
    for (let index = 0; index < 20; index += 1) {
      expect((await turn(account, index % 2 === 0 ? first : second)).status).toBe(200)
    }
    for (const on of [first, second, await replica()]) {
      const refused = await turn(account, on)
      expect(refused.status).toBe(429)
      expect(refused.json).toEqual({ ok: false, refusal: "rate", text: turnLimit })
    }
    expect(await ledgerOf(account.email)).toEqual({ spent: String(20 * turnCharge), hold: "0", turn: null })
  })
})

describe("an agent's run on a deck", () => {
  it("goes on when its next call lands on another server, so a layer a person changed stays closed", async () => {
    const account = await signIn()
    let deck = ""
    let run = ""
    let added = ""
    await withMcp(account.cookie, first, async (client) => {
      const made = await called(client, "create_deck", {})
      deck = made.deck
      const opened = await called(client, "edit_deck", {
        deck,
        base: made.rev,
        changes: [
          { op: "add", kind: "text", slide: made.slides[0], text: "a", box: { x: 160, y: 800, w: 600, h: 80 } },
        ],
      })
      run = opened.runId
      added = opened.added[0].id
    })
    const typed = {
      deck,
      edit: {
        once: "typed",
        author: { kind: "person", id: "tab" },
        writes: [{ node: added, prop: "name", value: "mine" }],
      },
    }
    expect((await ask(first.base, "POST", doomRoutes.edit.path, typed, account.cookie)).json).toMatchObject({ rev: 3 })
    await withMcp(account.cookie, await replica(), async (client) => {
      const closed = await called(client, "edit_deck", {
        deck,
        base: 3,
        runId: run,
        changes: [{ op: "set", target: added, name: "b" }],
      })
      expect(closed).toMatchObject({ ok: false, refusal: "person-protected" })
      const joined = await called(client, "edit_deck", {
        deck,
        base: 3,
        runId: run,
        changes: [
          { op: "add", kind: "text", slide: (await called(client, "read_deck", { deck })).slides[0], text: "c" },
        ],
      })
      expect(joined).toMatchObject({ ok: true, rev: 4, runId: run })
    })
  })
})

describe("a stop that lands on another server than the model call", () => {
  it("aborts the call, closes the turn by the stopped charge, and answers only once the turn is closed", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 3 }, { name: "turn.sse" })
    const reached = replay.hold()
    leaving(account, first, "ask-far")
    await reached
    const answer = await stopped(account, "ask-far", second)
    expect(answer.status).toBe(200)
    expect(replay.calls.at(-1)?.signal.aborted).toBe(true)
    expect(await ledgerOf(account.email)).toEqual({ spent: String(stoppedCharge), hold: "0", turn: null })
    expect(await turnsOf(account.email)).toEqual([{ outcome: "dropped", charged: String(stoppedCharge) }])
    expect((await turn(account, second)).status).toBe(200)
    expect(await ledgerOf(account.email)).toEqual({ spent: String(stoppedCharge + turnCharge), hold: "0", turn: null })
    replay.release()
  })

  it("charges once when it races the person leaving the first server", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 3 })
    const reached = replay.hold()
    const client = leaving(account, first, "ask-race")
    await reached
    const [answer] = await Promise.all([stopped(account, "ask-race", second), client.leave()])
    expect(answer.status).toBe(200)
    expect((await stopped(account, "ask-race", second)).status).toBe(200)
    await vi.waitFor(async () => {
      expect(await ledgerOf(account.email)).toEqual({ spent: String(stoppedCharge), hold: "0", turn: null })
    })
    expect(await turnsOf(account.email)).toEqual([{ outcome: "dropped", charged: String(stoppedCharge) }])
    replay.release()
  })

  it("leaves the call running when it names another ask", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 3 })
    const reached = replay.hold()
    leaving(account, first, "ask-kept")
    await reached
    expect((await stopped(account, "ask-other", second)).status).toBe(200)
    expect(replay.calls.at(-1)?.signal.aborted).toBe(false)
    replay.release()
    await vi.waitFor(async () => {
      expect(await turnsOf(account.email)).toEqual([{ outcome: "settled", charged: String(turnCharge) }])
    })
  })
})

describe("a new ask on another server right after a person left a turn", () => {
  it("is answered once the stopped turn has closed", async () => {
    const account = await signIn()
    replay.play({ name: "turn.sse", holdAfter: 3, lingers: true }, { name: "turn.sse" })
    const reached = replay.hold()
    const client = leaving(account, first)
    await reached
    await client.leave()
    await vi.waitFor(async () => {
      const marked = await admin.query("select 1 from session.aira_ask where email = $1 and stopped is not null", [
        account.email,
      ])
      expect(marked.rows).toHaveLength(1)
    })
    const waited = vi.spyOn(second.closing, "closed")
    const next = turn(account, second)
    await vi.waitFor(() => {
      expect(waited).toHaveBeenCalledWith(account.email, expect.anything())
    })
    replay.release()
    const answer = await next
    expect(answer.status).toBe(200)
    expect(answer.text.trim().split("\n").at(-1)).toContain('"ok":true')
    expect((await turnsOf(account.email)).map((row) => row.outcome).sort()).toEqual(["dropped", "settled"])
    waited.mockRestore()
  })
})
