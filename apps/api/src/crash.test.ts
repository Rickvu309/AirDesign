import { randomBytes } from "node:crypto"
import { readDeckId } from "@airdesign/catalog"
import { call, openDeck } from "@airdesign/engine"
import { Client } from "pg"
import { afterAll, describe, expect, it } from "vitest"

import { postgresInfo } from "./harness.js"
import { openPool, openSaved, readSaved, writeRevision } from "./index.js"

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("crash before commit", () => {
  const clients: Client[] = []
  const pools: { end: () => Promise<void> }[] = []

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.end().catch(() => undefined)))
    await Promise.all(pools.map((pool) => pool.end()))
  })

  it("leaves the old row and sends no notify when the session dies before commit", async () => {
    const info = await postgresInfo()
    const named = readDeckId(`crash${randomBytes(4).toString("hex")}`)
    if (!named.ok) throw new Error(named.refusal)
    const deck = openPool(info.deck, "crash-deck")
    pools.push(deck)
    const opened = await openSaved(deck, { deck: named.deck }, "a@example.com")
    if (!opened.ok) throw new Error(opened.refusal)
    const first = call(
      "commit_edits",
      openDeck(named.deck),
      { actor: "person" },
      {
        deck: named.deck,
        batch: [{ value: "one" }],
      },
    )
    if (!first.ok) throw new Error(first.refusal)
    const ear = new Client({ connectionString: info.listen, application_name: "crash-ear" })
    clients.push(ear)
    await ear.connect()
    const notes: string[] = []
    ear.on("notification", (message) => {
      if (typeof message.payload === "string" && message.payload.startsWith(`${named.deck}:`))
        notes.push(message.payload)
    })
    await ear.query("listen deck")
    const wrote = await writeRevision(deck, {
      id: first.deck.id,
      revision: first.deck.revision,
      register: first.deck.register,
      expected: opened.revision,
      key: first.key,
    })
    expect(wrote).toBe(true)
    const heard = Date.now()
    while (!notes.includes(`${named.deck}:1`)) {
      if (Date.now() - heard > 2000) throw new Error("the committed notify did not arrive")
      await delay(20)
    }

    const second = call(
      "commit_edits",
      first.deck,
      { actor: "person" },
      {
        deck: named.deck,
        batch: [{ value: "two" }],
      },
    )
    if (!second.ok) throw new Error(second.refusal)
    const writer = new Client({ connectionString: info.deck, application_name: "crash-writer" })
    clients.push(writer)
    writer.on("error", () => undefined)
    await writer.connect()
    await writer.query("begin")
    const pid = await writer.query<{ pid: number }>("select pg_backend_pid() as pid")
    const backend = pid.rows[0]?.pid
    if (backend === undefined) throw new Error("pid")
    const held = await writeRevision(writer, {
      id: second.deck.id,
      revision: second.deck.revision,
      register: second.deck.register,
      expected: first.deck.revision,
      key: second.key,
    })
    expect(held).toBe(true)
    await delay(100)
    expect(notes).toEqual([`${named.deck}:1`])
    const admin = new Client({ connectionString: info.admin, application_name: "crash-admin" })
    clients.push(admin)
    await admin.connect()
    await admin.query("select pg_terminate_backend($1::integer)", [backend])
    await delay(100)
    expect(notes).toEqual([`${named.deck}:1`])
    const saved = await readSaved(deck, named.deck)
    expect(saved?.revision).toBe(1)
    expect(saved?.register).toEqual(first.deck.register)
  })
})
