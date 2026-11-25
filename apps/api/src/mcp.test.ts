import { randomBytes } from "node:crypto"
import { request as httpRequest } from "node:http"

import { catalog, onceMeta, projectTools, doomRoutes } from "@airdesign/catalog"
import { limits, readFold, textFromMarkdown } from "@airdesign/doom"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { sessionRefusal, storeFailure, toolLimit, toolLimited } from "./testing/mcp-expected.js"

import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { openSql } from "./doom/doom-deck.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }

type Answer = Record<string, any>

const address = (mark: string) => `${mark}${randomBytes(4).toString("hex")}@example.com`

const listCall = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name: "airdesign_list_decks", arguments: {} },
}

describe("mcp route", () => {
  const mails: Mail[] = []
  let base = ""
  let publicBase = ""
  let deck: Sql = openPool("postgres://deck@127.0.0.1/api")
  let sessionDb: Sql = openPool("postgres://session@127.0.0.1/api")
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    sessionDb = openPool(info.session, "mcp-session")
    deck = openPool(info.deck, "mcp-handler")
    const listen = new DeckListen(info.listen)
    const send = async (mail: Mail) => {
      mails.push(mail)
    }
    const served = await serve({ ...origins, session: sessionDb, deck, listen, now: () => 1_000_000, send })
    const opened = await serve({
      ...origins,
      session: sessionDb,
      deck,
      listen,
      now: () => 1_000_000,
      hosts: ["localhost", "127.0.0.1", "[::1]", "mcp.airdesign.app"],
      send,
    })
    base = served.base
    publicBase = opened.base
    close = async () => {
      await served.close()
      await opened.close()
      await listen.close()
      await sessionDb.end()
      await deck.end()
    }
  })

  afterAll(async () => {
    await close()
  })

  const sign = (email: string) => signInByCode(base, mails, email)

  function posted(
    target: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<{ status: number; text: string }> {
    const payload = Buffer.from(typeof body === "string" ? body : JSON.stringify(body))
    const url = new URL(`${target}/mcp`)
    return new Promise((resolve, reject) => {
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
            ...headers,
          },
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on("data", (chunk: Buffer) => chunks.push(chunk))
          res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }))
        },
      )
      sent.on("error", reject)
      sent.end(payload)
    })
  }

  async function withMcp(cookie: string, use: (client: Client) => Promise<void>, target = base): Promise<void> {
    const transport = new StreamableHTTPClientTransport(new URL(`${target}/mcp`), {
      requestInit: { headers: { cookie } },
    })
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(transport)
    try {
      await use(client)
    } finally {
      await client.close()
    }
  }

  async function tool(client: Client, name: string, args: unknown, once?: string) {
    const result = await client.callTool({
      name: `airdesign_${name}`,
      arguments: args as Record<string, unknown>,
      ...(once === undefined ? {} : { _meta: { [onceMeta]: once } }),
    })
    return { ...result, answer: result.structuredContent as Answer }
  }

  async function made(client: Client, name = "Board"): Promise<Answer> {
    const result = await tool(client, "create_deck", { name })
    expect(result.isError, JSON.stringify(result.content)).not.toBe(true)
    return result.answer
  }

  async function stored(id: string) {
    const found = await deck.query<{ rev: number; name: string; fold: unknown }>(openSql, [id])
    return found.rows[0]
  }

  async function ownServer(
    mark: string,
    fields: { readonly now?: () => number; readonly session?: (pool: Sql) => Sql; readonly deck?: Sql },
  ) {
    const info = await postgresInfo()
    const session = openPool(info.session, `mcp-${mark}-session`)
    const stores = openPool(info.deck, `mcp-${mark}-deck`)
    const listen = new DeckListen(info.listen)
    const served = await serve({
      ...origins,
      session: fields.session?.(session) ?? session,
      deck: fields.deck ?? stores,
      listen,
      now: fields.now ?? (() => 1_000_000),
      send: async () => undefined,
    })
    return {
      base: served.base,
      close: async () => {
        await served.close()
        await listen.close()
        await session.end()
        await stores.end()
      },
    }
  }

  it("refuses mcp without a session and creates no deck", async () => {
    const before = await deck.query("select id from deck.doom")
    for (const headers of [
      {},
      { cookie: "airdesign.session=missing" },
      { cookie: "airdesign.session=%" },
      { host: "evil.example" },
    ]) {
      const refused = await posted(base, headers, listCall)
      expect({ status: refused.status, text: refused.text }).toEqual({
        status: 401,
        text: JSON.stringify(sessionRefusal),
      })
    }
    const create = { ...listCall, params: { name: "airdesign_create_deck", arguments: {} } }
    expect((await posted(base, {}, create)).status).toBe(401)
    expect((await deck.query("select id from deck.doom")).rowCount).toBe(before.rowCount)
  })

  it("lists the six agent tools for a signed-in caller", async () => {
    await withMcp(await sign(address("list")), async (client) => {
      const listed = await client.listTools()
      expect(listed.tools.map((tool) => tool.name)).toEqual(projectTools(catalog).map((each) => each.name))
      expect(listed.tools).toHaveLength(6)
    })
  })

  it("makes a doom deck, reads it, edits it in a run, reads it again and stops the run", async () => {
    await withMcp(await sign(address("flow")), async (client) => {
      const first = await made(client)
      expect(first).toMatchObject({ ok: true, name: "Board", slides: [expect.any(String)] })
      const row = await stored(first.deck)
      expect(row).toMatchObject({ rev: first.rev, name: "Board" })

      const listed = await tool(client, "list_decks", {})
      expect(listed.answer.decks).toEqual([{ deck: first.deck, name: "Board", rev: first.rev }])

      const landed = await tool(client, "edit_deck", {
        deck: first.deck,
        base: first.rev,
        changes: [
          { op: "add", kind: "text", slide: first.slides[0], text: "Q3 **board** update", textStyle: "heading" },
          {
            op: "add",
            kind: "kpi",
            slide: first.slides[0],
            items: [{ title: "Revenue", value: "$4.2M", note: "+12%" }],
          },
        ],
      })
      expect(landed.isError).not.toBe(true)
      expect(landed.answer).toMatchObject({ ok: true, deck: first.deck, rev: first.rev + 1, runId: expect.any(String) })
      expect(landed.answer.added).toHaveLength(2)

      const read = await tool(client, "read_deck", { deck: first.deck })
      expect(read.answer.rev).toBe(first.rev + 1)
      const lines = read.answer.layers as string
      expect(lines).toContain('text="Q3 **board** update"')
      expect(lines).toContain("Revenue")

      const folded = readFold((await stored(first.deck))!.fold)!
      expect(folded.runs.get(landed.answer.runId)?.phase).toBe("running")
      const stopped = await tool(client, "stop_run", { deck: first.deck, runId: landed.answer.runId })
      expect(stopped.answer).toMatchObject({ ok: true, rev: first.rev + 2 })
      const fenced = await tool(client, "edit_deck", {
        deck: first.deck,
        base: first.rev + 2,
        runId: landed.answer.runId,
        changes: [{ op: "add", kind: "text", slide: first.slides[0], text: "late" }],
      })
      expect(fenced.answer).toMatchObject({ ok: false, refusal: "run-fenced" })
      expect(readFold((await stored(first.deck))!.fold)!.rev).toBe(first.rev + 2)
    })
  })

  it("makes one deck and lands one edit for a call sent again with the same once", async () => {
    await withMcp(await sign(address("once")), async (client) => {
      const created = await tool(client, "create_deck", { name: "Once" }, "create-1")
      const again = await tool(client, "create_deck", { name: "Once" }, "create-1")
      expect(again.answer).toEqual(created.answer)
      expect((await tool(client, "list_decks", {})).answer.decks).toHaveLength(1)
      const args = {
        deck: created.answer.deck,
        base: created.answer.rev,
        changes: [
          { op: "add", kind: "cards", slide: created.answer.slides[0], items: [{ title: "A", points: ["one"] }] },
        ],
      }
      const first = await tool(client, "edit_deck", args, "edit-1")
      const second = await tool(client, "edit_deck", args, "edit-1")
      expect(second.answer).toEqual(first.answer)
      expect((await stored(created.answer.deck))!.rev).toBe(created.answer.rev + 1)
    })
  })

  it("refuses another account's deck for a read and an edit, and changes nothing", async () => {
    let owned: Answer = {}
    await withMcp(await sign(address("owns")), async (client) => {
      owned = await made(client)
    })
    const before = await stored(owned.deck)
    await withMcp(await sign(address("else")), async (client) => {
      const read = await tool(client, "read_deck", { deck: owned.deck })
      expect(read.isError).toBe(true)
      expect(read.answer).toMatchObject({ ok: false, refusal: "owner" })
      const edit = await tool(client, "edit_deck", {
        deck: owned.deck,
        base: owned.rev,
        changes: [{ op: "add", kind: "text", slide: owned.slides[0], text: "mine now" }],
      })
      expect(edit.answer).toMatchObject({ ok: false, refusal: "owner" })
      expect((await tool(client, "stop_run", { deck: owned.deck, runId: "run" })).answer).toMatchObject({
        ok: false,
        refusal: "owner",
      })
      expect((await tool(client, "list_decks", {})).answer.decks).toEqual([])
    })
    expect(await stored(owned.deck)).toEqual(before)
  })

  it("refuses a deck that was never made with deck and makes nothing", async () => {
    await withMcp(await sign(address("miss")), async (client) => {
      const refused = await tool(client, "read_deck", { deck: "neverthere" })
      expect(refused.answer).toMatchObject({ ok: false, refusal: "deck" })
    })
    expect(await stored("neverthere")).toBeUndefined()
  })

  it("closes a layer to the run once the person changes it, through the doom edit route", async () => {
    const email = address("person")
    const cookie = await sign(email)
    await withMcp(cookie, async (client) => {
      const first = await made(client)
      const landed = await tool(client, "edit_deck", {
        deck: first.deck,
        base: first.rev,
        changes: [{ op: "add", kind: "frame", slide: first.slides[0] }],
      })
      const added = (landed.answer.added as { id: string }[])[0]!.id
      const typed = await ask(
        base,
        "POST",
        doomRoutes.edit.path,
        {
          deck: first.deck,
          edit: {
            once: "typed-1",
            author: { kind: "person", id: "tab-1" },
            writes: [{ node: added, prop: "name", value: "Mine" }],
          },
        },
        cookie,
      )
      expect(typed.json).toMatchObject({ ok: true, rev: first.rev + 2 })
      const closed = await tool(client, "edit_deck", {
        deck: first.deck,
        base: first.rev + 2,
        runId: landed.answer.runId,
        changes: [{ op: "set", target: added, name: "Agent" }],
      })
      expect(closed.answer).toMatchObject({ ok: false, refusal: "person-protected", refused: "person", node: added })
      const reopened = await tool(client, "edit_deck", {
        deck: first.deck,
        base: first.rev + 2,
        changes: [{ op: "set", target: added, name: "Agent" }],
      })
      expect(reopened.answer).toMatchObject({ ok: true })
      const read = await tool(client, "read_deck", { deck: first.deck })
      expect(read.answer.layers).toContain('name="Agent"')
    })
  })

  it("refuses text a person typed after the agent read it as stale, and lands it after a fresh read", async () => {
    const cookie = await sign(address("typed"))
    await withMcp(cookie, async (client) => {
      const first = await made(client)
      const title = (await stored(first.deck))!
      const fold = readFold(title.fold)!
      const node = fold.children.get(first.slides[0])![0]!
      const typed = await ask(
        base,
        "POST",
        doomRoutes.edit.path,
        {
          deck: first.deck,
          edit: {
            once: "typed-1",
            author: { kind: "person", id: "tab-1" },
            writes: [
              {
                node,
                prop: "text",
                value: textFromMarkdown("Typed", "title"),
                base: fold.revs.get(node)!.get("text"),
              },
            ],
          },
        },
        cookie,
      )
      expect(typed.json).toMatchObject({ ok: true })
      const change = { op: "set", target: `${first.slides[0]}.title`, text: "Agent" }
      const stale = await tool(client, "edit_deck", { deck: first.deck, base: first.rev, changes: [change] })
      expect(stale.answer).toMatchObject({ ok: false, refusal: "stale", refused: "stale", prop: "text" })
      const fresh = await tool(client, "edit_deck", { deck: first.deck, base: first.rev + 1, changes: [change] })
      expect(fresh.answer).toMatchObject({ ok: true })
    })
  })

  it("names the change, its place and the field when a batch is refused, and lands none of it", async () => {
    await withMcp(await sign(address("named")), async (client) => {
      const first = await made(client)
      const refused = await tool(client, "edit_deck", {
        deck: first.deck,
        base: first.rev,
        changes: [
          { op: "add", kind: "text", slide: first.slides[0], text: "A" },
          { op: "set", target: "z:9", text: "B" },
        ],
      })
      expect(refused.isError).toBe(true)
      expect(refused.answer).toMatchObject({ refusal: "dead", change: "set z:9", at: 1, field: "target", node: "z:9" })
      expect((await stored(first.deck))!.rev).toBe(first.rev)
    })
  })

  it("counts a refusal toward the ninety, and refuses the ninety-first call until the clock leaves the window", async () => {
    let clock = 1_000_000
    const served = await ownServer("clock", { now: () => clock })
    try {
      const cookie = await sign(address("clock"))
      await withMcp(
        cookie,
        async (client) => {
          expect((await tool(client, "read_deck", { deck: "neverthere" })).answer.refusal).toBe("deck")
          for (let call = 1; call < 90; call += 1) expect((await tool(client, "list_decks", {})).isError).toBeFalsy()
          const blocked = await client.callTool({ name: "airdesign_list_decks", arguments: {} })
          expect(blocked.isError).toBe(true)
          expect(blocked.structuredContent).toEqual(toolLimited)
          clock += 300_000
          expect((await tool(client, "list_decks", {})).isError).toBeFalsy()
        },
        served.base,
      )
    } finally {
      await served.close()
    }
  })

  it("refuses the ninety-first tool call after a new sign-in", async () => {
    const email = address("cap")
    const cookie = await sign(email)
    await withMcp(cookie, async (client) => {
      for (let call = 0; call < 90; call += 1) expect((await tool(client, "list_decks", {})).isError).toBeFalsy()
      const blocked = await client.callTool({ name: "airdesign_list_decks", arguments: {} })
      expect(blocked.structuredContent).toEqual(toolLimited)
    })
    await withMcp(await sign(email), async (client) => {
      const blocked = await client.callTool({ name: "airdesign_list_decks", arguments: {} })
      expect(blocked.structuredContent).toEqual(toolLimited)
    })
  })

  it("counts overlapping tool calls once each", async () => {
    const requests = 93
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
      const cookie = await sign(address("race"))
      const payload = Buffer.from(JSON.stringify(listCall))
      const url = new URL(`${served.base}/mcp`)
      const held = Array.from({ length: requests }, () => {
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
      })
      await allSignedIn
      await new Promise((resolve) => setImmediate(resolve))
      for (const call of held) call.release()
      const texts = await Promise.all(held.map((call) => call.answer))
      expect(texts.filter((text) => !text.includes(toolLimit))).toHaveLength(90)
      expect(texts.filter((text) => text.includes(toolLimit))).toHaveLength(3)
    } finally {
      await served.close()
    }
  })

  it("allows a configured host and refuses any other host or origin", async () => {
    const cookie = await sign(address("host"))
    const unsigned = await posted(publicBase, { host: "mcp.airdesign.app" }, listCall)
    expect({ status: unsigned.status, json: JSON.parse(unsigned.text) }).toEqual({ status: 401, json: sessionRefusal })
    const allowed = await posted(publicBase, { host: "mcp.airdesign.app", cookie }, listCall)
    expect(allowed.status).toBe(200)
    const foreign = await posted(base, { host: "evil.example", cookie }, listCall)
    expect(foreign.status).toBe(403)
    expect(foreign.text).toContain("Invalid Host")
    const origin = await posted(
      publicBase,
      { host: "mcp.airdesign.app", origin: "https://evil.example", cookie },
      listCall,
    )
    expect(origin.status).toBe(403)
    expect(origin.text).toContain("Invalid Origin")
  })

  it("refuses a body over the cap, and answers one under it", async () => {
    const cookie = await sign(address("size"))
    const padded = (size: number) =>
      JSON.stringify({ ...listCall, params: { ...listCall.params, pad: "x".repeat(size) } })
    const over = padded(limits.body)
    expect(Buffer.byteLength(over)).toBeGreaterThan(limits.body)
    const blocked = await posted(base, { cookie }, over)
    expect(blocked.status).toBe(413)
    expect(JSON.parse(blocked.text)).toEqual({ ok: false, refusal: "size" })
    const under = padded(limits.body - Buffer.byteLength(padded(0)) - 1)
    expect(Buffer.byteLength(under)).toBe(limits.body - 1)
    expect((await posted(base, { cookie }, under)).status).toBe(200)
  })

  it("answers a fixed word when the store throws, and leaks nothing of the error", async () => {
    const broken = { query: () => Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:1")) } as unknown as Sql
    const served = await ownServer("throw", { deck: broken })
    try {
      const cookie = await sign(address("throw"))
      await withMcp(
        cookie,
        async (client) => {
          const refused = await tool(client, "create_deck", {})
          expect(refused.isError).toBe(true)
          expect(refused.answer).toMatchObject(storeFailure)
          for (const name of ["list_decks", "read_deck", "edit_deck", "stop_run"]) {
            const args = {
              list_decks: {},
              read_deck: { deck: "a" },
              edit_deck: { deck: "a", base: 0, changes: [{ op: "delete", nodes: ["a:1"] }] },
              stop_run: { deck: "a", runId: "r" },
            }[name]
            const answered = await tool(client, name, args)
            expect(answered.answer).toMatchObject(storeFailure)
            expect(JSON.stringify(answered)).not.toContain("ECONNREFUSED")
          }
        },
        served.base,
      )
    } finally {
      await served.close()
    }
  })
})
