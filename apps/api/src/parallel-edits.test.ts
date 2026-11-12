import { randomBytes } from "node:crypto"

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const element = "258.7"
const revisionWrite = "update deck.saved"
const turnSave = "insert into session.agent_turn"
const turnRead = "from session.agent_turn"

type Stored = {
  readonly revision: number
  readonly register: {
    readonly elements: Record<string, { readonly landed: readonly { value: string; runId?: string }[] }>
  }
}

type Gate = { readonly opened: Promise<void>; readonly open: () => void }

function gate(): Gate {
  let open = () => {}
  const opened = new Promise<void>((resolve) => {
    open = resolve
  })
  return { opened, open }
}

type Around = (sql: string, run: () => Promise<unknown>) => Promise<unknown>

function watched(pool: Sql, around: Around): Sql {
  return new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop !== "query") return Reflect.get(target, prop, receiver)
      const query = target.query.bind(target) as (sql: unknown, params?: unknown[]) => Promise<unknown>
      return async (sql: unknown, params?: unknown[]) =>
        typeof sql === "string" ? around(sql, () => query(sql, params)) : query(sql, params)
    },
  }) as Sql
}

type Order = "turn saved before the loser reads it" | "loser reads before the turn is saved"

async function twoEditsAtOneBase(order: Order): Promise<{ texts: string[]; kept: Stored | undefined }> {
  const info = await postgresInfo()
  const sessionPool = openPool(info.session, "parallel-session")
  const deckPool = openPool(info.deck, "parallel-deck")
  const listen = new DeckListen(info.listen)
  const mails: Mail[] = []
  const bothWriting = gate()
  const turnSaved = gate()
  const loserRead = gate()
  let writes = 0
  let turnSaves = 0
  let readsAfterWrites = 0
  let writing = false
  const deck = watched(deckPool, async (sql, run) => {
    if (sql.includes(revisionWrite)) {
      writes += 1
      if (writes === 2) {
        writing = true
        bothWriting.open()
      }
      await bothWriting.opened
    }
    return run()
  })
  const session = watched(sessionPool, async (sql, run) => {
    if (sql.includes(turnSave)) {
      turnSaves += 1
      const first = turnSaves === 1
      if (first && order === "loser reads before the turn is saved") await loserRead.opened
      const saved = await run()
      if (first) turnSaved.open()
      return saved
    }
    if (sql.includes(turnRead) && writing) {
      readsAfterWrites += 1
      const first = readsAfterWrites === 1
      if (first && order === "turn saved before the loser reads it") await turnSaved.opened
      const read = await run()
      if (first) loserRead.open()
      return read
    }
    return run()
  })
  const served = await serve({
    ...origins,
    session,
    deck,
    listen,
    now: () => 1_000_000,
    send: async (mail) => void mails.push(mail),
  })
  const id = `deck${randomBytes(4).toString("hex")}`
  const cookie = await signInByCode(served.base, mails, `pair${randomBytes(4).toString("hex")}@example.com`)
  await ask(served.base, "POST", "/decks/open", { deck: id }, cookie)
  const connect = async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${served.base}/mcp`), {
      requestInit: { headers: { cookie } },
    })
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(transport)
    return client
  }
  const [left, right] = await Promise.all([connect(), connect()])
  try {
    const answers = await Promise.all(
      [left, right].map((client, index) =>
        client.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: id, base: 0, changes: [{ value: String(21 + index), node: element, readAt: 0 }] },
        }),
      ),
    )
    const texts = answers.map((result) => {
      const block = result.content[0]
      if (block === undefined || block.type !== "text") throw new Error("text")
      return block.text
    })
    const kept = await deckPool.query<Stored>("select revision, register from deck.saved where id = $1", [id])
    return { texts, kept: kept.rows[0] }
  } finally {
    await Promise.all([left.close(), right.close()])
    await served.close()
    await listen.close()
    await sessionPool.end()
    await deckPool.end()
  }
}

describe("two edits of one account sent at the same base and read", () => {
  it("both land in one run when the first call's turn is saved before the second re-reads after losing the write", async () => {
    const { texts, kept } = await twoEditsAtOneBase("turn saved before the loser reads it")
    expect(texts.toSorted()).toEqual(["Landed revision 1.", "Landed revision 2."])
    expect(kept?.revision).toBe(2)
    const landed = kept?.register.elements[element]?.landed ?? []
    expect(landed.map((row) => row.value).toSorted()).toEqual(["21", "22"])
    expect(new Set(landed.map((row) => row.runId)).size).toBe(1)
  })

  it.fails("both land when the second re-reads after losing the write before the first call's turn is saved", async () => {
    const { texts, kept } = await twoEditsAtOneBase("loser reads before the turn is saved")
    expect(texts.toSorted()).toEqual(["Landed revision 1.", "Landed revision 2."])
    expect(kept?.revision).toBe(2)
  })
})
