import { randomBytes } from "node:crypto"
import { request as httpRequest } from "node:http"

import { catalog, projectTools, readDeckId } from "@airdesign/catalog"
import { type CallerLog, editNext, runNext } from "@airdesign/mcp"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { bodyCap } from "./server.js"

function deckName(): string {
  return `deck${randomBytes(4).toString("hex")}`
}

function address(mark: string): string {
  return `${mark}${randomBytes(4).toString("hex")}@example.com`
}

type StoredElement = {
  floor: string
  phase: string
  runId: string | null
  guarded: boolean
  landed: { value: string; visible: boolean; runId?: string }[]
}

type Stored = {
  revision: number
  register: {
    nodes: string[]
    elements: Record<string, StoredElement>
  }
}

const toolLimit = "Thirty tool calls in five minutes. The next tool call can run in 300 seconds."
const captureNext = "Open the deck in AirDesign, then try again."
const storeFailure = editNext.store

const element = "258.7"
const sibling = "258.8"
const created = "258.n0123456789ab"

function firstEdit(deck: string) {
  return { deck, base: 0, changes: [{ value: "21", node: element, readAt: 0 }] }
}

function secondEdit(deck: string) {
  return { deck, base: 1, changes: [{ value: "22", node: element, readAt: 1 }] }
}

function otherEdit(deck: string) {
  return { deck, base: 1, changes: [{ value: "no", node: element, readAt: 1 }] }
}

function landedAnswer(
  revision: number,
  elements: readonly { node: string; value: string; version: number }[],
  runId: unknown = expect.any(String),
) {
  return { ok: true, revision, runId, elements }
}

function landedContent(
  revision: number,
  elements: readonly { node: string; value: string; version: number }[],
  runId: string,
) {
  return [
    { type: "text", text: `Landed revision ${String(revision)}.` },
    { type: "text", text: JSON.stringify(landedAnswer(revision, elements, runId)) },
  ]
}

function editCall(deck: string) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "airdesign_edit_deck", arguments: firstEdit(deck) },
  }
}

type EditReply = {
  ok: boolean
  revision: number
  runId: string
  refusal?: string
  elements: { node: string; value: string; version: number; closed?: true }[]
}

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const sessionRefusal = { ok: false, refusal: "session" }

function elementOf(stored: Stored | undefined, node = element): StoredElement {
  const body = stored?.register.elements[node]
  if (body === undefined) throw new Error("missing element")
  return body
}

function runOf(stored: Stored | undefined, node = element): string {
  const runId = elementOf(stored, node).runId
  if (runId === null) throw new Error("no run")
  return runId
}

function values(stored: Stored | undefined, node = element): string[] {
  return elementOf(stored, node).landed.map((item) => item.value)
}

describe("mcp route", () => {
  const mails: Mail[] = []
  const minted: string[] = []
  let base = ""
  let publicBase = ""
  let deck: Sql = openPool("postgres://deck@127.0.0.1/api")
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "mcp-session")
    deck = openPool(info.deck, "mcp-handler")
    const listen = new DeckListen(info.listen)
    const served = await serve({
      ...origins,
      session,
      deck,
      listen,
      now: () => 1_000_000,
      mint: () => {
        const id = `mint${String(minted.length)}`
        minted.push(id)
        return id
      },
      send: async (mail) => {
        mails.push(mail)
      },
    })
    const opened = await serve({
      ...origins,
      session,
      deck,
      listen,
      now: () => 1_000_000,
      hosts: ["localhost", "127.0.0.1", "[::1]", "mcp.airdesign.app"],
      send: async (mail) => {
        mails.push(mail)
      },
    })
    base = served.base
    publicBase = opened.base
    close = async () => {
      await served.close()
      await opened.close()
      await listen.close()
      await session.end()
      await deck.end()
    }
  })

  afterAll(async () => {
    await close()
  })

  async function sign(email: string): Promise<string> {
    const index = mails.length
    await ask(base, "POST", "/sign-in/email", { email })
    const code = mails[index]?.text.split("\n")[1]
    const signed = await ask(base, "POST", "/sign-in/code", { email, code })
    const sessionCookie = cookieFrom(signed.headers)
    if (sessionCookie === undefined) throw new Error("cookie")
    return sessionCookie
  }

  async function row(id: string): Promise<Stored | undefined> {
    const result = await deck.query<Stored>("select revision, register from deck.saved where id = $1", [id])
    return result.rows[0]
  }

  function fetchAt(target: string, forced: Record<string, string>) {
    return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const url = new URL(raw, target)
      const headers: Record<string, string> = {}
      new Headers(init?.headers).forEach((value, key) => {
        headers[key] = value
      })
      Object.assign(headers, forced)
      const payload =
        typeof init?.body === "string"
          ? Buffer.from(init.body)
          : init?.body instanceof Uint8Array
            ? Buffer.from(init.body)
            : undefined
      if (payload !== undefined) headers["content-length"] = String(payload.length)
      const sent = await new Promise<{ status: number; headers: Headers; body: Buffer }>((resolve, reject) => {
        const req = httpRequest(
          {
            hostname: "127.0.0.1",
            port: url.port,
            path: `${url.pathname}${url.search}`,
            method: init?.method ?? "GET",
            headers,
          },
          (res) => {
            const chunks: Buffer[] = []
            res.on("data", (chunk: Buffer) => chunks.push(chunk))
            res.on("end", () => {
              const responseHeaders = new Headers()
              for (const [key, value] of Object.entries(res.headers)) {
                if (typeof value === "string") responseHeaders.set(key, value)
                else if (Array.isArray(value)) responseHeaders.set(key, value.join(", "))
              }
              resolve({ status: res.statusCode ?? 0, headers: responseHeaders, body: Buffer.concat(chunks) })
            })
          },
        )
        req.on("error", reject)
        if (payload === undefined) req.end()
        else req.end(payload)
      })
      return new Response(sent.body, { status: sent.status, headers: sent.headers })
    }
  }

  async function posted(
    target: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<{ status: number; text: string }> {
    const response = await fetchAt(target, headers)(`${target}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify(body),
    })
    return { status: response.status, text: await response.text() }
  }

  async function withMcp(
    cookie: string,
    use: (client: Client) => Promise<void>,
    target = base,
    forced?: Record<string, string>,
  ): Promise<void> {
    const transport = new StreamableHTTPClientTransport(new URL(`${target}/mcp`), {
      requestInit: { headers: { cookie } },
      ...(forced === undefined ? {} : { fetch: fetchAt(target, forced) }),
    })
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(transport)
    try {
      await use(client)
    } finally {
      await client.close()
    }
  }

  async function connected(cookie: string, target = base): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(new URL(`${target}/mcp`), {
      requestInit: { headers: { cookie } },
    })
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(transport)
    return client
  }

  async function openedDeck(mark: string, email = address(mark)): Promise<{ id: string; cookie: string }> {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const cookie = await sign(email)
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    return { id: named.deck, cookie }
  }

  async function editText(client: Client, args: Record<string, unknown>): Promise<string> {
    const result = await client.callTool({ name: "airdesign_edit_deck", arguments: args })
    const block = result.content[0]
    if (block === undefined || block.type !== "text") throw new Error("text")
    return block.text
  }

  async function seeded(client: Client, id: string): Promise<void> {
    const edits = [
      { base: 0, changes: [{ value: "a1", node: element, readAt: 0 }] },
      { base: 1, changes: [{ value: "a2", node: element, readAt: 1 }] },
      { base: 2, changes: [{ value: "b1", node: sibling, readAt: 0 }] },
    ]
    for (const [index, edit] of edits.entries()) {
      expect(await editText(client, { deck: id, ...edit })).toBe(`Landed revision ${String(index + 1)}.`)
    }
  }

  async function ownServer(
    mark: string,
    fields: {
      readonly deck?: Sql
      readonly now?: () => number
      readonly session?: (pool: Sql) => Sql
      readonly logs?: Map<string, CallerLog>
    },
  ): Promise<{ readonly base: string; readonly close: () => Promise<void> }> {
    const info = await postgresInfo()
    const session = openPool(info.session, `mcp-${mark}-session`)
    const stored = openPool(info.deck, `mcp-${mark}-deck`)
    const listen = new DeckListen(info.listen)
    const served = await serve({
      ...origins,
      session: fields.session?.(session) ?? session,
      deck: fields.deck ?? stored,
      listen,
      now: fields.now ?? (() => 1_000_000),
      ...(fields.logs === undefined ? {} : { logs: fields.logs }),
      send: async () => undefined,
    })
    return {
      base: served.base,
      close: async () => {
        await served.close()
        await listen.close()
        await session.end()
        await stored.end()
      },
    }
  }

  function heldCapture(target: string, cookie: string, id: string): { release: () => void; answer: Promise<string> } {
    const payload = Buffer.from(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "airdesign_capture_slide", arguments: { deck: id } },
      }),
    )
    const url = new URL(`${target}/mcp`)
    let release = () => {}
    const answer = new Promise<string>((resolve, reject) => {
      const sent = httpRequest(
        {
          hostname: "127.0.0.1",
          port: url.port,
          path: url.pathname,
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "content-length": String(payload.length),
            cookie,
          },
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on("data", (chunk: Buffer) => chunks.push(chunk))
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
        },
      )
      sent.on("error", reject)
      sent.write(payload.subarray(0, 1))
      release = () => sent.end(payload.subarray(1))
    })
    return { release, answer }
  }

  it("refuses mcp without a session", async () => {
    const { id } = await openedDeck("unsigned")
    const before = await row(id)
    const missing = await posted(base, {}, editCall(id))
    expect({ status: missing.status, text: missing.text, stored: await row(id) }).toEqual({
      status: 401,
      text: JSON.stringify(sessionRefusal),
      stored: before,
    })
    const unknown = await posted(base, { cookie: "airdesign.session=missing" }, editCall(id))
    expect({ status: unknown.status, text: unknown.text, stored: await row(id) }).toEqual({
      status: 401,
      text: JSON.stringify(sessionRefusal),
      stored: before,
    })
  })

  it("answers session for a malformed cookie on mcp and a deck route", async () => {
    const { id } = await openedDeck("malformed")
    const before = await row(id)
    for (const value of ["%", "%E0%A4%A", "%00"]) {
      const cookie = `airdesign.session=${value}`
      const mcp = await posted(base, { cookie }, editCall(id))
      expect({ status: mcp.status, text: mcp.text }).toEqual({ status: 401, text: JSON.stringify(sessionRefusal) })
      const opened = await ask(base, "POST", "/decks/open", { deck: id }, cookie)
      expect({ status: opened.status, json: opened.json }).toEqual({ status: 401, json: sessionRefusal })
      expect(await row(id)).toEqual(before)
    }
  })

  it("answers session to an unsigned request whose host is not allowed", async () => {
    const { id } = await openedDeck("unsignedhost")
    const before = await row(id)
    const unsigned = await posted(base, { host: "evil.example" }, editCall(id))
    expect(unsigned.status).toBe(401)
    expect(JSON.parse(unsigned.text)).toEqual(sessionRefusal)
    expect(await row(id)).toEqual(before)
  })

  it("counts a call refused as deck, owner, field or a store failure toward the thirty", async () => {
    const logs = new Map<string, CallerLog>()
    function nearLimit(mark: string): string {
      const email = address(mark)
      logs.set(email, { events: Array.from({ length: 29 }, () => ({ kind: "tool" as const, at: 1_000_000 })) })
      return email
    }
    const counting = await ownServer("counted", { logs })
    const broken = await ownServer("uncounted", {
      deck: { query: () => Promise.reject(new Error("connect ECONNREFUSED")) } as unknown as Sql,
      logs,
    })
    try {
      const foreign = await openedDeck("theirs")
      const opened = await openedDeck("field", nearLimit("field"))
      const cases = [
        {
          text: editNext.deck,
          target: counting.base,
          cookie: await sign(nearLimit("nodeck")),
          id: deckName(),
          extra: {},
        },
        {
          text: editNext.owner,
          target: counting.base,
          cookie: await sign(nearLimit("noowner")),
          id: foreign.id,
          extra: {},
        },
        {
          text: editNext.field,
          target: counting.base,
          cookie: opened.cookie,
          id: opened.id,
          extra: { runId: "client-run" },
        },
        {
          text: storeFailure,
          target: broken.base,
          cookie: await sign(nearLimit("nostore")),
          id: deckName(),
          extra: {},
        },
      ]
      for (const item of cases) {
        await withMcp(
          item.cookie,
          async (client) => {
            expect(await editText(client, { ...firstEdit(item.id), ...item.extra })).toBe(item.text)
            expect(await editText(client, { ...firstEdit(item.id), ...item.extra })).toBe(toolLimit)
          },
          item.target,
        )
      }
      expect((await row(foreign.id))?.revision).toBe(0)
      expect((await row(opened.id))?.revision).toBe(0)
    } finally {
      await counting.close()
      await broken.close()
    }
  })

  it("refuses the thirty-first tool call until the injected clock leaves the window", async () => {
    let clock = 1_000_000
    const served = await ownServer("clock", { now: () => clock })
    try {
      const { id, cookie } = await openedDeck("clock")
      await withMcp(
        cookie,
        async (client) => {
          for (let call = 0; call < 30; call += 1) {
            const captured = await client.callTool({ name: "airdesign_capture_slide", arguments: { deck: id } })
            expect(captured.content).toEqual([{ type: "text", text: captureNext }])
          }
          expect(await editText(client, firstEdit(id))).toBe(toolLimit)
          expect((await row(id))?.revision).toBe(0)
          clock += 300_000
          expect(await editText(client, firstEdit(id))).toBe("Landed revision 1.")
        },
        served.base,
      )
      expect(values(await row(id))).toEqual(["21"])
    } finally {
      await served.close()
    }
  })

  it("lands two edits in one run and keeps the server run id", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const email = address("land")
    const firstCookie = await sign(email)
    const opened = await ask(base, "POST", "/decks/open", { deck: named.deck }, firstCookie)
    expect(opened.json).toMatchObject({ ok: true, revision: 0 })
    await withMcp(firstCookie, async (client) => {
      const listed = await client.listTools()
      const estimate = Math.ceil(Buffer.byteLength(JSON.stringify(listed)) / 4)
      expect(listed.tools.length).toBe(projectTools(catalog).length)
      expect(listed.tools.length).toBeLessThanOrEqual(20)
      expect(estimate).toBeLessThanOrEqual(8000)
      const before = minted.length
      const first = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: firstEdit(named.deck),
      })
      expect(first.isError).not.toBe(true)
      const started = await row(named.deck)
      const runId = runOf(started)
      expect(first.content).toEqual(landedContent(1, [{ node: element, value: "21", version: 1 }], runId))
      expect(first.structuredContent).toEqual(landedAnswer(1, [{ node: element, value: "21", version: 1 }], runId))
      expect(started?.revision).toBe(1)
      expect(values(started)).toEqual(["21"])
      expect(minted.slice(before)).toContain(runId)
      const watched = await ask(base, "POST", "/decks/watch", { deck: named.deck, cursor: 0 }, firstCookie)
      expect(watched.json).toEqual({ ok: true, deck: named.deck, revision: 1 })
      const secondCookie = await sign(email)
      const seen = await ask(base, "POST", "/decks/open", { deck: named.deck }, secondCookie)
      expect(seen.status).toBe(200)
      expect(seen.json).toMatchObject({
        ok: true,
        deck: named.deck,
        revision: 1,
        register: { elements: { [element]: { runId, landed: [{ actor: "agent", value: "21", visible: true }] } } },
      })
      const second = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: secondEdit(named.deck),
      })
      expect(second.isError).not.toBe(true)
      expect(second.content).toEqual(landedContent(2, [{ node: element, value: "22", version: 2 }], runId))
      const kept = await row(named.deck)
      expect(kept?.revision).toBe(2)
      expect(values(kept)).toEqual(["21", "22"])
      expect(elementOf(kept).runId).toBe(runId)
    })
  })

  it("refuses another account", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const owner = await sign(address("own"))
    await ask(base, "POST", "/decks/open", { deck: named.deck }, owner)
    await withMcp(owner, async (client) => {
      const landed = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: firstEdit(named.deck),
      })
      expect(landed.content).toEqual(
        landedContent(1, [{ node: element, value: "21", version: 1 }], runOf(await row(named.deck))),
      )
    })
    const before = await row(named.deck)
    const other = await sign(address("else"))
    await withMcp(other, async (client) => {
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: otherEdit(named.deck),
      })
      expect(refused.isError).toBe(true)
      const answer = { ok: false, revision: 0, refusal: "owner", elements: [] }
      expect(refused.content).toEqual([
        { type: "text", text: editNext.owner },
        { type: "text", text: JSON.stringify(answer) },
      ])
      expect(refused.structuredContent).toEqual(answer)
      expect(JSON.stringify(refused)).not.toContain("21")
    })
    expect(await row(named.deck)).toEqual(before)
  })

  it("lands one call on two elements at different versions, each at its own readAt", async () => {
    const { id, cookie } = await openedDeck("pair")
    const before = minted.length
    await withMcp(cookie, async (client) => {
      await seeded(client, id)
      const text = await editText(client, {
        deck: id,
        base: 3,
        changes: [
          { value: "a3", node: element, readAt: 2 },
          { value: "b2", node: sibling, readAt: 1 },
        ],
      })
      expect(text).toBe("Landed revision 4.")
    })
    const kept = await row(id)
    expect(kept?.revision).toBe(4)
    expect(values(kept)).toEqual(["a1", "a2", "a3"])
    expect(values(kept, sibling)).toEqual(["b1", "b2"])
    const runId = elementOf(kept).runId
    expect(minted.slice(before)).toContain(runId)
    expect(elementOf(kept, sibling).runId).toBe(runId)
  })

  it("answers stale for a readAt behind the element and lands nothing of the call", async () => {
    const { id, cookie } = await openedDeck("behind")
    await withMcp(cookie, async (client) => {
      await seeded(client, id)
      const seededRow = await row(id)
      const alone = await editText(client, {
        deck: id,
        base: 3,
        changes: [{ value: "late", node: element, readAt: 0 }],
      })
      expect(alone).toBe(editNext.stale)
      expect(await row(id)).toEqual(seededRow)
      const paired = await editText(client, {
        deck: id,
        base: 3,
        changes: [
          { value: "b2", node: sibling, readAt: 1 },
          { value: "late", node: element, readAt: 0 },
        ],
      })
      expect(paired).toBe(editNext.stale)
      expect(await row(id)).toEqual(seededRow)
    })
  })

  it("tells the agent the next step when an edit is stale", async () => {
    const { id, cookie } = await openedDeck("next")
    await withMcp(cookie, async (client) => {
      await seeded(client, id)
      const stale = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: id, base: 3, changes: [{ value: "late", node: element, readAt: 0 }] },
      })
      expect(stale.isError).toBe(true)
      const answer = {
        ok: false,
        revision: 3,
        refusal: "stale",
        elements: [{ node: element, value: "a2", version: 2 }],
      }
      expect(stale.content).toEqual([
        { type: "text", text: editNext.stale },
        { type: "text", text: JSON.stringify(answer) },
      ])
      expect(stale.structuredContent).toEqual(answer)
      expect((await row(id))?.revision).toBe(3)
      const resent = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: id, base: answer.revision, changes: [{ value: "late", node: element, readAt: 2 }] },
      })
      expect(resent.structuredContent).toEqual(landedAnswer(4, [{ node: element, value: "late", version: 3 }]))
    })
    const kept = await row(id)
    expect(kept?.revision).toBe(4)
    expect(values(kept)).toEqual(["a1", "a2", "late"])
  })

  it("lands two edits in a row, each at the version the previous answer carried", async () => {
    const { id, cookie } = await openedDeck("row")
    await withMcp(cookie, async (client) => {
      let readAt = 0
      let revision = 0
      for (const value of ["one", "two"]) {
        const result = await client.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: id, base: revision, changes: [{ value, node: sibling, readAt }] },
        })
        expect(result.isError).not.toBe(true)
        const answer = result.structuredContent as { revision: number; elements: { version: number }[] }
        expect(result.content.at(-1)).toEqual({ type: "text", text: JSON.stringify(answer) })
        readAt = answer.elements[0]?.version ?? -1
        revision = answer.revision
      }
      expect(readAt).toBe(2)
    })
    const kept = await row(id)
    expect(kept?.revision).toBe(2)
    expect(values(kept, sibling)).toEqual(["one", "two"])
  })

  it("refuses a text value whose run the new element's floor does not have and creates nothing", async () => {
    const { id, cookie } = await openedDeck("textfrom")
    const floor = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Before" }] }])
    const sent = JSON.stringify([{ from: 0, runs: [{ from: 3, text: "After" }] }])
    const before = await row(id)
    await withMcp(cookie, async (client) => {
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: id, base: 0, changes: [{ value: sent, node: created, readAt: 0, floor }] },
      })
      expect(refused.isError).toBe(true)
      const answer = {
        ok: false,
        revision: 0,
        refusal: "text-from",
        elements: [{ node: created, value: "", version: 0 }],
      }
      expect(refused.content).toEqual([
        { type: "text", text: editNext["text-from"] },
        { type: "text", text: "Paragraph 0 of the file has runs 0. Use one of them, or -1 for a new run." },
        { type: "text", text: JSON.stringify(answer) },
      ])
      expect(refused.structuredContent).toEqual(answer)
    })
    const kept = await row(id)
    expect(kept).toEqual(before)
    expect(kept?.register.nodes).not.toContain(created)
  })

  it("lands a call whose base is behind the revision when each readAt is current", async () => {
    const { id, cookie } = await openedDeck("oldbase")
    await withMcp(cookie, async (client) => {
      await seeded(client, id)
      const text = await editText(client, {
        deck: id,
        base: 0,
        changes: [{ value: "a3", node: element, readAt: 2 }],
      })
      expect(text).toBe("Landed revision 4.")
    })
    const kept = await row(id)
    expect(kept?.revision).toBe(4)
    expect(values(kept)).toEqual(["a1", "a2", "a3"])
  })

  it("opens a new element with the given floor, starts it and lands", async () => {
    const { id, cookie } = await openedDeck("created")
    const before = minted.length
    await withMcp(cookie, async (client) => {
      const text = await editText(client, {
        deck: id,
        base: 0,
        changes: [{ value: "After", node: created, readAt: 0, floor: "Before" }],
      })
      expect(text).toBe("Landed revision 1.")
    })
    const kept = await row(id)
    expect(kept?.revision).toBe(1)
    expect(kept?.register.nodes).toContain(created)
    const body = elementOf(kept, created)
    expect(body.floor).toBe("Before")
    expect(body.phase).toBe("running")
    expect(minted.slice(before)).toContain(body.runId)
    expect(values(kept, created)).toEqual(["After"])
  })

  it("answers person-protected after a person commits on the element during the run", async () => {
    const { id, cookie } = await openedDeck("guard")
    await withMcp(cookie, async (client) => {
      expect(await editText(client, firstEdit(id))).toBe("Landed revision 1.")
      const committed = await ask(
        base,
        "POST",
        "/decks/commit",
        { deck: id, batch: [{ value: "person", node: element }] },
        cookie,
      )
      expect(committed.json).toMatchObject({ ok: true, revision: 2 })
      const guarded = await row(id)
      expect(elementOf(guarded).guarded).toBe(true)
      const seen = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: id, base: 1, changes: [{ value: "agent", node: element, readAt: 1 }] },
      })
      const closed = {
        ok: false,
        revision: 2,
        refusal: "person-protected",
        elements: [{ node: element, value: "person", version: 2, closed: true }],
      }
      expect(seen.content).toEqual([
        { type: "text", text: editNext["person-protected"] },
        { type: "text", text: JSON.stringify(closed) },
      ])
      expect(seen.structuredContent).toEqual(closed)
      const kept = await row(id)
      expect(kept).toEqual(guarded)
      const again = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: id, base: 2, changes: [{ value: "agent", node: element, readAt: 2 }] },
      })
      const answer = {
        ok: false,
        revision: 2,
        refusal: "person-protected",
        elements: [{ node: element, value: "person", version: 2, closed: true }],
      }
      expect(again.content).toEqual([
        { type: "text", text: editNext["person-protected"] },
        { type: "text", text: JSON.stringify(answer) },
      ])
      expect(again.structuredContent).toEqual(answer)
      expect(await row(id)).toEqual(guarded)
      expect(values(kept).at(-1)).toBe("person")
    })
  })

  async function editAnswer(client: Client, args: Record<string, unknown>): Promise<EditReply> {
    const result = await client.callTool({ name: "airdesign_edit_deck", arguments: args })
    return result.structuredContent as EditReply
  }

  async function typed(id: string, cookie: string, value: string, revision: number): Promise<void> {
    const committed = await ask(base, "POST", "/decks/commit", { deck: id, batch: [{ value, node: element }] }, cookie)
    expect(committed.json).toMatchObject({ ok: true, revision })
  }

  it("an agent can edit a box again in a new turn after a person typed in it", async () => {
    const { id, cookie } = await openedDeck("again")
    await withMcp(cookie, async (client) => {
      const first = await editAnswer(client, firstEdit(id))
      await typed(id, cookie, "person", 2)
      expect(elementOf(await row(id)).guarded).toBe(true)
      const stopped = await client.callTool({ name: "airdesign_stop_run", arguments: { deck: id, runId: first.runId } })
      expect(stopped.structuredContent).toEqual({ ok: true, revision: 3, runId: first.runId, elements: [] })
      const earlier = await row(id)
      expect(elementOf(earlier).phase).toBe("stopped")
      const later = await editAnswer(client, {
        deck: id,
        base: 3,
        changes: [{ value: "later", node: element, readAt: 2 }],
      })
      expect(later).toEqual(landedAnswer(4, [{ node: element, value: "later", version: 3 }]))
      expect(later.runId).not.toBe(first.runId)
      const kept = await row(id)
      expect(kept?.revision).toBe(4)
      expect(runOf(kept)).toBe(later.runId)
      expect(elementOf(kept).guarded).toBe(false)
      expect(elementOf(kept).landed.slice(0, 2)).toEqual(elementOf(earlier).landed)
      expect(values(kept)).toEqual(["21", "person", "later"])
    })
  })

  it("an agent can edit a box again after the idle window, and a person still closes it inside the window", async () => {
    let clock = 1_000_000
    const served = await ownServer("idle", { now: () => clock })
    try {
      const { id, cookie } = await openedDeck("idle")
      await withMcp(
        cookie,
        async (client) => {
          const first = await editAnswer(client, firstEdit(id))
          clock += 599_999
          const second = await editAnswer(client, secondEdit(id))
          expect(second.runId).toBe(first.runId)
          await typed(id, cookie, "person", 3)
          const closedRow = await row(id)
          expect(elementOf(closedRow).guarded).toBe(true)
          clock += 599_999
          const closed = await editAnswer(client, {
            deck: id,
            base: 3,
            changes: [{ value: "no", node: element, readAt: 3 }],
          })
          expect(closed).toMatchObject({ ok: false, refusal: "person-protected" })
          expect(await row(id)).toEqual(closedRow)
          clock += 600_000
          const captured = await client.callTool({ name: "airdesign_capture_slide", arguments: { deck: id } })
          expect(captured.content).toEqual([{ type: "text", text: captureNext }])
          const stale = await editAnswer(client, {
            deck: id,
            base: 3,
            changes: [{ value: "no", node: element, readAt: 1 }],
          })
          expect(stale).toEqual({
            ok: false,
            revision: 3,
            refusal: "stale",
            elements: [{ node: element, value: "person", version: 3 }],
          })
          expect(await row(id)).toEqual(closedRow)
          const later = await editAnswer(client, {
            deck: id,
            base: 3,
            changes: [{ value: "later", node: element, readAt: 3 }],
          })
          expect(later).toEqual(landedAnswer(4, [{ node: element, value: "later", version: 4 }]))
          expect(later.runId).not.toBe(first.runId)
          const kept = await row(id)
          expect(kept?.revision).toBe(4)
          expect(runOf(kept)).toBe(later.runId)
          expect(elementOf(kept).guarded).toBe(false)
          expect(elementOf(kept).landed.slice(0, 3)).toEqual(elementOf(closedRow).landed)
        },
        served.base,
      )
    } finally {
      await served.close()
    }
  })

  it("joins a second element in one turn and ends the idle turn on both in one write", async () => {
    let clock = 1_000_000
    const served = await ownServer("both", { now: () => clock })
    try {
      const { id, cookie } = await openedDeck("both")
      await withMcp(
        cookie,
        async (client) => {
          const first = await editAnswer(client, firstEdit(id))
          const second = await editAnswer(client, {
            deck: id,
            base: 1,
            changes: [{ value: "b", node: sibling, readAt: 0 }],
          })
          expect(second.runId).toBe(first.runId)
          expect(runOf(await row(id), sibling)).toBe(first.runId)
          clock += 600_000
          const later = await editAnswer(client, secondEdit(id))
          expect(later.runId).not.toBe(first.runId)
          const kept = await row(id)
          expect(kept?.revision).toBe(3)
          expect(elementOf(kept, sibling).phase).toBe("stopped")
          expect(runOf(kept, sibling)).toBe(first.runId)
        },
        served.base,
      )
    } finally {
      await served.close()
    }
  })

  it("counts a process restart as idle", async () => {
    const restarted = await ownServer("restart-turn", {})
    try {
      const { id, cookie } = await openedDeck("restart-turn")
      let firstRun = ""
      await withMcp(cookie, async (client) => {
        firstRun = (await editAnswer(client, firstEdit(id))).runId
      })
      await typed(id, cookie, "person", 2)
      await withMcp(
        cookie,
        async (client) => {
          const later = await editAnswer(client, {
            deck: id,
            base: 2,
            changes: [{ value: "later", node: element, readAt: 2 }],
          })
          expect(later).toEqual(landedAnswer(3, [{ node: element, value: "later", version: 3 }]))
          expect(later.runId).not.toBe(firstRun)
        },
        restarted.base,
      )
    } finally {
      await restarted.close()
    }
  })

  it("undoes only the named run, keeps the person's rows, and lands a later edit", async () => {
    const { id, cookie } = await openedDeck("undo")
    await withMcp(cookie, async (client) => {
      const first = await editAnswer(client, firstEdit(id))
      await client.callTool({ name: "airdesign_stop_run", arguments: { deck: id, runId: first.runId } })
      const second = await editAnswer(client, {
        deck: id,
        base: 2,
        changes: [{ value: "22", node: element, readAt: 1 }],
      })
      expect(second.runId).not.toBe(first.runId)
      await typed(id, cookie, "person", 4)
      const undone = await client.callTool({ name: "airdesign_undo_run", arguments: { deck: id, runId: second.runId } })
      expect(undone.structuredContent).toEqual({ ok: true, revision: 5, runId: second.runId, elements: [] })
      const kept = await row(id)
      expect(kept?.revision).toBe(5)
      expect(elementOf(kept).landed.map((item) => [item.value, item.visible])).toEqual([
        ["21", true],
        ["22", false],
        ["person", true],
      ])
      const later = await editAnswer(client, {
        deck: id,
        base: 5,
        changes: [{ value: "later", node: element, readAt: 2 }],
      })
      expect(later).toEqual(landedAnswer(6, [{ node: element, value: "later", version: 3 }]))
      expect(later.runId).not.toBe(first.runId)
      expect(later.runId).not.toBe(second.runId)
      expect(elementOf(await row(id)).landed.slice(0, 3)).toEqual(elementOf(kept).landed)
    })
  })

  it("answers owner to another account's stop_run and undo_run and changes nothing", async () => {
    const { id, cookie } = await openedDeck("runowner")
    let runId = ""
    await withMcp(cookie, async (client) => {
      runId = (await editAnswer(client, firstEdit(id))).runId
    })
    const before = await row(id)
    await withMcp(await sign(address("runthief")), async (client) => {
      for (const name of ["airdesign_stop_run", "airdesign_undo_run"]) {
        const result = await client.callTool({ name, arguments: { deck: id, runId } })
        const answer = { ok: false, revision: 0, refusal: "owner", elements: [] }
        expect(result.isError).toBe(true)
        expect(result.content).toEqual([
          { type: "text", text: editNext.owner },
          { type: "text", text: JSON.stringify(answer) },
        ])
        expect(result.structuredContent).toEqual(answer)
        expect(await row(id)).toEqual(before)
      }
    })
  })

  it("answers run-fenced to a bad or unknown run id and changes nothing", async () => {
    const { id, cookie } = await openedDeck("runfence")
    await withMcp(cookie, async (client) => {
      await editAnswer(client, firstEdit(id))
      const before = await row(id)
      for (const name of ["airdesign_stop_run", "airdesign_undo_run"]) {
        for (const runId of ["unknown", "../bad"]) {
          const result = await client.callTool({ name, arguments: { deck: id, runId } })
          const answer = { ok: false, revision: 1, refusal: "run-fenced", elements: [] }
          expect(result.content).toEqual([
            { type: "text", text: runNext["run-fenced"] },
            { type: "text", text: JSON.stringify(answer) },
          ])
          expect(await row(id)).toEqual(before)
        }
      }
    })
  })

  it("answers a second stop_run ok with no change", async () => {
    const { id, cookie } = await openedDeck("runtwice")
    await withMcp(cookie, async (client) => {
      const { runId } = await editAnswer(client, firstEdit(id))
      await client.callTool({ name: "airdesign_stop_run", arguments: { deck: id, runId } })
      const stopped = await row(id)
      const again = await client.callTool({ name: "airdesign_stop_run", arguments: { deck: id, runId } })
      expect(again.structuredContent).toEqual({ ok: true, revision: 2, runId, elements: [] })
      expect(await row(id)).toEqual(stopped)
    })
  })

  async function racingServer(
    mark: string,
    now: () => number,
  ): Promise<{ readonly base: string; readonly race: () => void; readonly close: () => Promise<void> }> {
    const info = await postgresInfo()
    const stored = openPool(info.deck, `mcp-${mark}-race`)
    let racing = false
    const racer = new Proxy(stored, {
      get(target, prop, receiver) {
        if (prop !== "query") return Reflect.get(target, prop, receiver)
        const query = target.query.bind(target) as (sql: unknown, params?: unknown[]) => Promise<unknown>
        return async (sql: unknown, params?: unknown[]) => {
          if (racing && typeof sql === "string" && sql.includes("update deck.saved")) {
            racing = false
            await query("update deck.saved set revision = revision + 1 where id = $1", [params?.[0]])
          }
          return query(sql, params)
        }
      },
    }) as Sql
    const served = await ownServer(mark, { deck: racer, now })
    return {
      base: served.base,
      race: () => {
        racing = true
      },
      close: async () => {
        await served.close()
        await stored.end()
      },
    }
  }

  it("answers stale when a stop_run or undo_run loses its write, and the run stays live", async () => {
    const served = await racingServer("lostend", () => 1_000_000)
    try {
      for (const name of ["airdesign_stop_run", "airdesign_undo_run"]) {
        const { id, cookie } = await openedDeck("lostend")
        await withMcp(
          cookie,
          async (client) => {
            const first = await editAnswer(client, firstEdit(id))
            const before = await row(id)
            served.race()
            const lost = await client.callTool({ name, arguments: { deck: id, runId: first.runId } })
            const answer = { ok: false, revision: 2, refusal: "stale", elements: [] }
            expect(lost.content).toEqual([
              { type: "text", text: runNext.stale },
              { type: "text", text: JSON.stringify(answer) },
            ])
            const kept = await row(id)
            expect(kept?.revision).toBe(2)
            expect(kept?.register).toEqual(before?.register)
            const next = await editAnswer(client, secondEdit(id))
            expect(next.runId).toBe(first.runId)
          },
          served.base,
        )
      }
    } finally {
      await served.close()
    }
  })

  it("answers stale when the edit that ends an idle turn loses its write, and the old run stays live", async () => {
    let clock = 1_000_000
    const served = await racingServer("lostidle", () => clock)
    try {
      const { id, cookie } = await openedDeck("lostidle")
      await withMcp(
        cookie,
        async (client) => {
          const first = await editAnswer(client, firstEdit(id))
          const before = await row(id)
          clock += 600_000
          served.race()
          const lost = await editAnswer(client, secondEdit(id))
          expect(lost).toMatchObject({ ok: false, revision: 2, refusal: "stale" })
          const kept = await row(id)
          expect(kept?.revision).toBe(2)
          expect(kept?.register).toEqual(before?.register)
          expect(elementOf(kept).phase).toBe("running")
          expect(runOf(kept)).toBe(first.runId)
        },
        served.base,
      )
    } finally {
      await served.close()
    }
  })

  it("counts stop_run and undo_run toward the thirty", async () => {
    const { id, cookie } = await openedDeck("runlimit")
    await withMcp(cookie, async (client) => {
      for (let call = 0; call < 30; call += 1) {
        const name = call % 2 === 0 ? "airdesign_stop_run" : "airdesign_undo_run"
        const result = await client.callTool({ name, arguments: { deck: id, runId: "unknown" } })
        expect(result.content[0]).toEqual({ type: "text", text: runNext["run-fenced"] })
      }
      for (const name of ["airdesign_stop_run", "airdesign_undo_run"]) {
        const result = await client.callTool({ name, arguments: { deck: id, runId: "unknown" } })
        expect(result.content).toEqual([{ type: "text", text: toolLimit }])
      }
      expect(await editText(client, firstEdit(id))).toBe(toolLimit)
      expect((await row(id))?.revision).toBe(0)
    })
  })

  it("checks every change on a new element against the first change's floor", async () => {
    const { id, cookie } = await openedDeck("twofloor")
    const floor = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "One" }] }])
    const good = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Two" }] }])
    const bad = JSON.stringify([{ from: 9, runs: [{ from: 4, text: "bad" }] }])
    const before = await row(id)
    await withMcp(cookie, async (client) => {
      const unfloored = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: id,
          base: 0,
          changes: [
            { value: good, node: created, readAt: 0, floor },
            { value: bad, node: created, readAt: 1 },
          ],
        },
      })
      expect(unfloored.isError).toBe(true)
      expect(unfloored.content).toEqual([
        { type: "text", text: editNext["text-from"] },
        { type: "text", text: "The file has paragraphs 0." },
        {
          type: "text",
          text: JSON.stringify({
            ok: false,
            revision: 0,
            refusal: "text-from",
            elements: [{ node: created, value: "", version: 0 }],
          }),
        },
      ])
      expect(await row(id)).toEqual(before)
      const refloored = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: id,
          base: 0,
          changes: [
            { value: good, node: created, readAt: 0, floor },
            { value: bad, node: created, readAt: 1, floor: "plain" },
          ],
        },
      })
      expect(refloored.isError).toBe(true)
      expect(refloored.structuredContent).toEqual({
        ok: false,
        revision: 0,
        refusal: "field",
        elements: [{ node: created, value: "", version: 0 }],
      })
      expect(await row(id)).toEqual(before)
      const landed = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: id,
          base: 0,
          changes: [
            { value: good, node: created, readAt: 0, floor },
            { value: good.replace("Two", "Three"), node: created, readAt: 1 },
          ],
        },
      })
      expect(landed.structuredContent).toEqual(
        landedAnswer(1, [{ node: created, value: good.replace("Two", "Three"), version: 2 }]),
      )
    })
    const kept = await row(id)
    expect(kept?.revision).toBe(1)
    expect(elementOf(kept, created).floor).toBe(floor)
    expect(values(kept, created)).toEqual([good, good.replace("Two", "Three")])
  })

  it("starts a fresh run on a stopped element and keeps the earlier run's rows", async () => {
    const { id, cookie } = await openedDeck("restart")
    const before = minted.length
    await withMcp(cookie, async (client) => {
      await seeded(client, id)
      const earlier = await row(id)
      const firstRun = elementOf(earlier).runId
      expect(elementOf(earlier, sibling).runId).toBe(firstRun)
      await deck.query("update deck.saved set register = jsonb_set(register, $2, to_jsonb($3::text)) where id = $1", [
        id,
        ["elements", element, "phase"],
        "stopped",
      ])
      const text = await editText(client, {
        deck: id,
        base: 3,
        changes: [{ value: "a3", node: element, readAt: 2 }],
      })
      expect(text).toBe("Landed revision 4.")
      const kept = await row(id)
      const fresh = elementOf(kept).runId
      expect(minted.slice(before)).toContain(fresh)
      expect(fresh).not.toBe(firstRun)
      expect(elementOf(kept).phase).toBe("running")
      expect(elementOf(kept).landed.slice(0, 2)).toEqual(elementOf(earlier).landed)
      expect(elementOf(kept).landed[2]).toMatchObject({ value: "a3", runId: fresh })
      expect(elementOf(kept, sibling)).toEqual(elementOf(earlier, sibling))
    })
  })

  it("refuses a client run id and leaves the stored run", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const cookie = await sign(address("id"))
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    await withMcp(cookie, async (client) => {
      const before = minted.length
      const landed = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: firstEdit(named.deck),
      })
      expect(landed.content).toEqual(
        landedContent(1, [{ node: element, value: "21", version: 1 }], runOf(await row(named.deck))),
      )
      const started = await row(named.deck)
      expect(minted.slice(before)).toContain(elementOf(started).runId)
      for (const extra of [{ runId: "client-run" }, { readAt: 5 }, { actor: "person" }] as const) {
        const refused = await client.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: named.deck, base: 1, changes: [{ value: "99", node: element, readAt: 1 }], ...extra },
        })
        expect(refused.isError).toBe(true)
        expect(refused.content).toEqual([
          { type: "text", text: editNext.field },
          { type: "text", text: JSON.stringify({ ok: false, revision: 1, refusal: "field", elements: [] }) },
        ])
        const kept = await row(named.deck)
        expect(kept).toEqual(started)
        expect(minted.slice(before)).toContain(elementOf(kept).runId)
      }
    })
  })

  it("refuses a deck that was never opened", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const cookie = await sign(address("miss"))
    await withMcp(cookie, async (client) => {
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: firstEdit(named.deck),
      })
      expect(refused.isError).toBe(true)
      const answer = { ok: false, revision: 0, refusal: "deck", elements: [] }
      expect(refused.content).toEqual([
        { type: "text", text: editNext.deck },
        { type: "text", text: JSON.stringify(answer) },
      ])
      expect(refused.structuredContent).toEqual(answer)
    })
    const counted = await deck.query<{ count: string }>(
      "select count(*)::text as count from deck.saved where id = $1",
      [named.deck],
    )
    expect(counted.rows[0]?.count).toBe("0")
  })

  it("refuses the thirty-first tool call after a new sign-in", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const email = address("cap")
    const cookie = await sign(email)
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    await withMcp(cookie, async (client) => {
      for (let call = 0; call < 30; call += 1) {
        const captured = await client.callTool({
          name: "airdesign_capture_slide",
          arguments: { deck: named.deck },
        })
        expect(captured.isError).toBe(true)
        expect(captured.content).toEqual([{ type: "text", text: captureNext }])
      }
      const blocked = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: firstEdit(named.deck),
      })
      expect(blocked.isError).toBe(true)
      expect(blocked.content).toEqual([{ type: "text", text: toolLimit }])
    })
    const kept = await row(named.deck)
    expect(kept?.revision).toBe(0)
    expect(kept?.register.elements).toEqual({})
    const again = await sign(email)
    await withMcp(again, async (client) => {
      const blocked = await client.callTool({
        name: "airdesign_capture_slide",
        arguments: { deck: named.deck },
      })
      expect(blocked.isError).toBe(true)
      expect(blocked.content).toEqual([{ type: "text", text: toolLimit }])
    })
    expect(await row(named.deck)).toEqual(kept)
  })

  it("allows a configured host and refuses any other host or origin", async () => {
    const { id, cookie } = await openedDeck("host")
    const before = await row(id)
    const unsigned = await posted(publicBase, { host: "mcp.airdesign.app" }, editCall(id))
    expect({ status: unsigned.status, json: JSON.parse(unsigned.text), stored: await row(id) }).toEqual({
      status: 401,
      json: sessionRefusal,
      stored: before,
    })
    await withMcp(
      cookie,
      async (client) => {
        const listed = await client.listTools()
        expect(listed.tools.map((tool) => tool.name)).toEqual(projectTools(catalog).map((tool) => tool.name))
      },
      publicBase,
      { host: "mcp.airdesign.app" },
    )
    const foreign = await posted(base, { host: "evil.example", cookie }, editCall(id))
    expect({ status: foreign.status, stored: await row(id) }).toEqual({ status: 403, stored: before })
    expect(foreign.text).toContain("Invalid Host")
    const origin = await posted(
      publicBase,
      { host: "mcp.airdesign.app", origin: "https://evil.example", cookie },
      editCall(id),
    )
    expect({ status: origin.status, stored: await row(id) }).toEqual({ status: 403, stored: before })
    expect(origin.text).toContain("Invalid Origin")
  })

  it("counts overlapping tool calls once each", async () => {
    const requests = 33
    let lookups = 0
    let markAllSignedIn = () => {}
    const allSignedIn = new Promise<void>((resolve) => {
      markAllSignedIn = resolve
    })
    const served = await ownServer("overlap", {
      session: (pool) =>
        new Proxy(pool, {
          get(target, prop, receiver) {
            if (prop !== "query") return Reflect.get(target, prop, receiver)
            const query = target.query.bind(target) as (sql: unknown, params?: unknown[]) => Promise<unknown>
            return async (sql: unknown, params?: unknown[]) => {
              const result = await query(sql, params)
              if (typeof sql === "string" && sql.includes("session.access")) {
                lookups += 1
                if (lookups === requests) markAllSignedIn()
              }
              return result
            }
          },
        }) as Sql,
    })
    try {
      const { id, cookie } = await openedDeck("race")
      const held = Array.from({ length: requests }, () => heldCapture(served.base, cookie, id))
      await allSignedIn
      await new Promise((resolve) => setImmediate(resolve))
      for (const call of held) call.release()
      const texts = await Promise.all(held.map((call) => call.answer))
      expect(texts.filter((text) => text.includes(captureNext))).toHaveLength(30)
      expect(texts.filter((text) => text.includes(toolLimit))).toHaveLength(3)
    } finally {
      await served.close()
    }
  })

  it("lists the agent tools on POST /mcp for a signed-in caller", async () => {
    const cookie = await sign(address("list"))
    await withMcp(cookie, async (client) => {
      const listed = await client.listTools()
      expect(listed.tools.map((tool) => tool.name)).toEqual(projectTools(catalog).map((tool) => tool.name))
    })
  })

  it("lands one of two edits sent at the same base", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const info = await postgresInfo()
    const session = openPool(info.session, "mcp-lost-session")
    const stored = openPool(info.deck, "mcp-lost-deck")
    const listen = new DeckListen(info.listen)
    let arrived = 0
    let markAllSignedIn = () => {}
    const bothLoaded = new Promise<void>((resolve) => {
      markAllSignedIn = resolve
    })
    const holding = new Proxy(stored, {
      get(target, prop, receiver) {
        if (prop !== "query") return Reflect.get(target, prop, receiver)
        const query = target.query.bind(target) as (sql: unknown, params?: unknown[]) => Promise<unknown>
        return async (sql: unknown, params?: unknown[]) => {
          if (typeof sql === "string" && sql.includes("update deck.saved")) {
            arrived += 1
            if (arrived === 2) markAllSignedIn()
            await bothLoaded
          }
          return query(sql, params)
        }
      },
    }) as Sql
    const served = await serve({
      ...origins,
      session,
      deck: holding,
      listen,
      now: () => 1_000_000,
      send: async () => undefined,
    })
    const cookie = await sign(address("pair"))
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const [left, right] = await Promise.all([connected(cookie, served.base), connected(cookie, served.base)])
    try {
      const [first, second] = await Promise.all([
        left.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: named.deck, base: 0, changes: [{ value: "21", node: element, readAt: 0 }] },
        }),
        right.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: named.deck, base: 0, changes: [{ value: "22", node: element, readAt: 0 }] },
        }),
      ])
      const texts = [first, second].map((result) => {
        const block = result.content[0]
        if (block === undefined || block.type !== "text") throw new Error("text")
        return block.text
      })
      expect(texts.filter((text) => text === "Landed revision 1.")).toHaveLength(1)
      expect(texts.filter((text) => text === editNext.stale)).toHaveLength(1)
      const kept = await row(named.deck)
      expect(kept?.revision).toBe(1)
      expect(elementOf(kept).landed).toHaveLength(1)
      const value = elementOf(kept).landed[0]?.value
      expect(value === "21" || value === "22").toBe(true)
      const lost = [first, second].find((result) => result.isError === true)
      if (lost === undefined) throw new Error("no lost write")
      const stored = { ok: false, revision: 1, refusal: "stale", elements: [{ node: element, value, version: 1 }] }
      expect(lost.structuredContent).toEqual(stored)
      expect(lost.content).toEqual([
        { type: "text", text: editNext.stale },
        { type: "text", text: JSON.stringify(stored) },
      ])
      const resent = await left.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: named.deck, base: 1, changes: [{ value: "23", node: element, readAt: 1 }] },
      })
      expect(resent.structuredContent).toEqual(landedAnswer(2, [{ node: element, value: "23", version: 2 }]))
      const after = await row(named.deck)
      expect(after?.revision).toBe(2)
      expect(values(after)).toEqual([value, "23"])
    } finally {
      await Promise.all([left.close(), right.close()])
      await served.close()
      await listen.close()
      await session.end()
      await stored.end()
    }
  })

  it("refuses another account's capture", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const owner = await sign(address("capown"))
    await ask(base, "POST", "/decks/open", { deck: named.deck }, owner)
    const before = await row(named.deck)
    const other = await sign(address("capelse"))
    await withMcp(other, async (client) => {
      const refused = await client.callTool({
        name: "airdesign_capture_slide",
        arguments: { deck: named.deck },
      })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([{ type: "text", text: editNext.owner }])
    })
    expect(await row(named.deck)).toEqual(before)
  })

  it("refuses a body over the cap and accepts one under it", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const cookie = await sign(address("size"))
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const nodes = Array.from({ length: 100 }, (_, index) => `258.${String(index)}`)
    const call = (texts: readonly string[]) =>
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "airdesign_edit_deck",
          arguments: {
            deck: named.deck,
            base: 0,
            changes: nodes.map((node, index) => ({ value: texts[index] ?? "", node, readAt: 0 })),
          },
        },
      })
    const packed = (wire: number) =>
      nodes.map((_, index) => {
        const share = Math.floor(wire / nodes.length) + (index < wire % nodes.length ? 1 : 0)
        return `${share % 2 === 1 ? "y" : ""}${'"'.repeat(Math.floor(share / 2))}`
      })
    const emptySize = Buffer.byteLength(call(nodes.map(() => "")))
    const underValues = packed(bodyCap - emptySize - 1)
    const under = call(underValues)
    const over = call(packed(bodyCap))
    expect(Buffer.byteLength(under)).toBe(bodyCap - 1)
    expect(Buffer.byteLength(over)).toBeGreaterThan(bodyCap)
    const blocked = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        cookie,
      },
      body: over,
    })
    const blockedText = await blocked.text()
    expect(blocked.status).toBe(413)
    expect(JSON.parse(blockedText)).toEqual({ ok: false, refusal: "size" })
    expect(await row(named.deck)).toMatchObject({ revision: 0, register: { elements: {} } })
    const allowed = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        cookie,
      },
      body: under,
    })
    const allowedText = await allowed.text()
    expect(allowed.status).toBe(200)
    expect(allowedText).toContain("Landed revision 1.")
    const kept = await row(named.deck)
    expect(kept?.revision).toBe(1)
    expect(nodes.map((node) => values(kept, node)[0])).toEqual(underValues)
  })

  it("answers a fixed sentence when the store throws", async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "mcp-throw-session")
    const listen = new DeckListen(info.listen)
    const broken = {
      query: () => Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:1")),
    } as unknown as Sql
    const denied = await serve({
      ...origins,
      session,
      deck: broken,
      listen,
      now: () => 1_000_000,
      send: async () => undefined,
    })
    const saving = new Proxy(deck, {
      get(target, prop, receiver) {
        if (prop !== "query") return Reflect.get(target, prop, receiver)
        const query = target.query.bind(target) as (sql: unknown, params?: unknown[]) => Promise<unknown>
        return (sql: unknown, params?: unknown[]) => {
          if (typeof sql === "string" && sql.includes("update deck.saved")) {
            return Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:1"))
          }
          return query(sql, params)
        }
      },
    }) as Sql
    const writer = await serve({
      ...origins,
      session,
      deck: saving,
      listen,
      now: () => 1_000_000,
      send: async () => undefined,
    })
    try {
      const cookie = await sign(address("throw"))
      const named = readDeckId(deckName())
      if (!named.ok) throw new Error(named.refusal)
      await withMcp(
        cookie,
        async (client) => {
          const refused = await client.callTool({
            name: "airdesign_edit_deck",
            arguments: firstEdit(named.deck),
          })
          expect(refused.isError).toBe(true)
          expect(refused.content).toEqual([
            { type: "text", text: storeFailure },
            { type: "text", text: JSON.stringify({ ok: false, revision: 0, refusal: "store", elements: [] }) },
          ])
          expect(JSON.stringify(refused)).not.toContain("ECONNREFUSED")
        },
        denied.base,
      )
      const opened = readDeckId(deckName())
      if (!opened.ok) throw new Error(opened.refusal)
      await ask(base, "POST", "/decks/open", { deck: opened.deck }, cookie)
      const before = await row(opened.deck)
      await withMcp(
        cookie,
        async (client) => {
          const refused = await client.callTool({
            name: "airdesign_edit_deck",
            arguments: firstEdit(opened.deck),
          })
          expect(refused.isError).toBe(true)
          const answer = {
            ok: false,
            revision: 0,
            refusal: "store",
            elements: [{ node: element, value: "", version: 0 }],
          }
          expect(refused.content).toEqual([
            { type: "text", text: storeFailure },
            { type: "text", text: JSON.stringify(answer) },
          ])
          expect(refused.structuredContent).toEqual(answer)
          expect(JSON.stringify(refused)).not.toContain("ECONNREFUSED")
        },
        writer.base,
      )
      expect(await row(opened.deck)).toEqual(before)
    } finally {
      await writer.close()
      await denied.close()
      await listen.close()
      await session.end()
    }
  })

  it("keeps the server run id when params name one", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const cookie = await sign(address("param"))
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const before = minted.length
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "airdesign_edit_deck",
        arguments: firstEdit(named.deck),
        runId: "client-side",
      },
    })
    const response = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        cookie,
      },
      body,
    })
    const text = await response.text()
    expect(response.status).toBe(200)
    expect(text).toContain("Landed revision 1.")
    const kept = await row(named.deck)
    expect(minted.slice(before)).toEqual([elementOf(kept).runId])
    expect(elementOf(kept).runId).not.toBe("client-side")
    expect(values(kept)).toEqual(["21"])
  })
})
