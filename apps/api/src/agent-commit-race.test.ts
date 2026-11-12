import { randomBytes } from "node:crypto"

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const edited = "259.1"
const other = "259.2"
const revisionWrite = "update deck.saved"

type Reply = { readonly ok: boolean; readonly refusal?: string; readonly revision?: number }
type Stored = { readonly revision: number; readonly register: { readonly elements: Record<string, unknown> } }
type Landed = Record<string, { landed: { value: string; visible: boolean }[] } | undefined>
type Opened = { id: string; cookie: string; email: string; client: Client }
const floor = { kind: "shape", value: "", box: null, grouped: false }

describe("an agent edit that meets a person's edit on another element while it is stored", () => {
  const mails: Mail[] = []
  let base = ""
  let pool: Sql = openPool("postgres://deck@127.0.0.1/api")
  let personEdits = 0
  let racesLeft = 0
  let personWriting = false
  let person = async () => {}
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "race-session")
    pool = openPool(info.deck, "race-deck")
    const racing = new Proxy(pool, {
      get(target, key) {
        const member = Reflect.get(target, key) as unknown
        if (key !== "query" || typeof member !== "function") return typeof member === "function" ? member.bind(target) : member
        return async (...args: unknown[]) => {
          if (!personWriting && racesLeft > 0 && typeof args[0] === "string" && args[0].includes(revisionWrite)) {
            racesLeft -= 1
            personEdits += 1
            personWriting = true
            try {
              await person()
            } finally {
              personWriting = false
            }
          }
          return (member as (...query: unknown[]) => Promise<unknown>).apply(target, args)
        }
      },
    }) as Sql
    const listen = new DeckListen(info.listen)
    const served = await serve({ ...origins, session, deck: racing, listen, send: async (mail) => void mails.push(mail) })
    base = served.base
    close = async () => {
      await served.close()
      await listen.close()
      await session.end()
      await pool.end()
    }
  })

  afterAll(async () => {
    await close()
  })

  async function stored(id: string): Promise<Stored> {
    const result = await pool.query<Stored>("select revision, register from deck.saved where id = $1", [id])
    const row = result.rows[0]
    if (row === undefined) throw new Error("row")
    return row
  }

  async function toolCalls(email: string): Promise<number> {
    const result = await pool.query<{ events: { kind: string }[] }>(
      "select events from session.caller_log where email = $1",
      [email],
    )
    return (result.rows[0]?.events ?? []).filter((event) => event.kind === "tool").length
  }

  async function turnRevision(email: string, id: string): Promise<number | undefined> {
    const result = await pool.query<{ revision: number }>(
      "select revision from session.agent_turn where email = $1 and deck = $2",
      [email, id],
    )
    return result.rows[0]?.revision
  }

  const indexPage = (id: string, cookie: string) =>
    ask(
      base,
      "POST",
      "/decks/index",
      {
        deck: id,
        once: "race-index",
        offset: 0,
        total: 2,
        slides: [{ id: "259", position: 0, layout: [] }],
        elements: [
          { node: edited, ...floor },
          { node: other, ...floor },
        ],
      },
      cookie,
    )

  async function connected(indexed: boolean): Promise<Opened> {
    const id = `deck${randomBytes(4).toString("hex")}`
    const email = `race${randomBytes(4).toString("hex")}@example.com`
    const cookie = await signInByCode(base, mails, email)
    await ask(base, "POST", "/decks/open", { deck: id }, cookie)
    if (indexed) await indexPage(id, cookie)
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { cookie } } })
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(transport)
    person = indexed
      ? async () => {
          await ask(base, "POST", "/decks/commit", { deck: id, batch: [{ value: "person", node: other }] }, cookie)
        }
      : async () => {
          await indexPage(id, cookie)
        }
    return { id, cookie, email, client }
  }

  async function agentEdit(client: Client, id: string, revision: number): Promise<Reply> {
    const answer = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: { deck: id, base: revision, changes: [{ node: edited, readAt: 0, value: "agent" }] },
    })
    return answer.structuredContent as Reply
  }

  it("lands once, because the person's edit touched no element the agent wrote", async () => {
    const { id, email, client } = await connected(true)
    try {
      const before = await stored(id)
      racesLeft = 1
      personEdits = 0
      const answer = await agentEdit(client, id, before.revision)
      expect(personEdits).toBe(1)
      expect(answer.ok).toBe(true)
      const after = await stored(id)
      expect(after.revision).toBe(before.revision + 2)
      const elements = after.register.elements as Landed
      expect(elements[edited]?.landed.filter((row) => row.value.includes("agent"))).toHaveLength(1)
      expect(elements[other]?.landed.some((row) => row.visible && row.value.includes("person"))).toBe(true)
      expect(await toolCalls(email)).toBe(1)
      expect(await turnRevision(email, id)).toBe(after.revision)
    } finally {
      racesLeft = 0
      await client.close()
    }
  })

  it("is refused after three tries when a person's edit keeps winning, and stores nothing of it", async () => {
    const { id, email, client } = await connected(true)
    try {
      const before = await stored(id)
      racesLeft = 10
      personEdits = 0
      const answer = await agentEdit(client, id, before.revision)
      racesLeft = 0
      expect(personEdits).toBe(3)
      expect(answer.ok).toBe(false)
      expect(answer.refusal).toBe("stale")
      const after = await stored(id)
      expect(after.revision).toBe(before.revision + 3)
      const elements = after.register.elements as Landed
      expect(elements[edited]?.landed.some((row) => row.value.includes("agent")) ?? false).toBe(false)
      expect(await toolCalls(email)).toBe(1)
    } finally {
      racesLeft = 0
      await client.close()
    }
  })

  it("lands once when the deck's index arrives between the read and the write, and counts one tool call", async () => {
    const { id, email, client } = await connected(false)
    try {
      const before = await stored(id)
      racesLeft = 1
      personEdits = 0
      const answer = await agentEdit(client, id, before.revision)
      expect(personEdits).toBe(1)
      expect(answer.ok).toBe(true)
      const after = await stored(id)
      const elements = after.register.elements as Landed
      expect(elements[edited]?.landed.filter((row) => row.value.includes("agent"))).toHaveLength(1)
      expect(await toolCalls(email)).toBe(1)
      expect(await turnRevision(email, id)).toBe(after.revision)
    } finally {
      racesLeft = 0
      await client.close()
    }
  })
})
