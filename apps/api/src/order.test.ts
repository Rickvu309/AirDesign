import { randomBytes } from "node:crypto"
import { readDeckId } from "@airdesign/catalog"
import { call, openDeck } from "@airdesign/engine"
import { Client } from "pg"
import { afterAll, describe, expect, it } from "vitest"

import { postgresInfo } from "./harness.js"
import { commitEdits, openPool, openSaved, writeRevision } from "./index.js"

describe("two sessions on one row", () => {
  const clients: Client[] = []
  const pools: { end: () => Promise<void> }[] = []

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.end().catch(() => undefined)))
    await Promise.all(pools.map((pool) => pool.end()))
  })

  it("waits while the first session holds the row, then lands both revisions in order", async () => {
    const info = await postgresInfo()
    const named = readDeckId(`order${randomBytes(4).toString("hex")}`)
    if (!named.ok) throw new Error(named.refusal)
    const deck = openPool(info.deck, "order-store")
    pools.push(deck)
    const opened = await openSaved(deck, { deck: named.deck })
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

    const holder = new Client({ connectionString: info.deck, application_name: "order-holder" })
    clients.push(holder)
    await holder.connect()
    const ear = new Client({ connectionString: info.listen, application_name: "order-ear" })
    clients.push(ear)
    await ear.connect()
    const notes: string[] = []
    ear.on("notification", (message) => {
      if (typeof message.payload === "string" && message.payload.startsWith(`${named.deck}:`))
        notes.push(message.payload)
    })
    await ear.query("listen deck")
    const admin = new Client({ connectionString: info.admin, application_name: "order-admin" })
    clients.push(admin)
    await admin.connect()

    await holder.query("begin")
    const held = await writeRevision(holder, {
      id: first.deck.id,
      revision: first.deck.revision,
      register: first.deck.register,
      expected: 0,
      key: first.key,
    })
    expect(held).toBe(true)
    expect(notes).toEqual([])

    const waiter = openPool(info.deck, "order-waiter")
    pools.push(waiter)
    let finished = false
    const second = commitEdits(waiter, { deck: named.deck, batch: [{ value: "two" }] }).finally(() => {
      finished = true
    })
    const started = Date.now()
    let waiting = false
    while (!waiting) {
      const found = await admin.query(
        "select pid from pg_stat_activity where application_name = $1 and wait_event_type = 'Lock'",
        ["order-waiter"],
      )
      waiting = found.rows.length > 0
      if (!waiting && Date.now() - started > 3000) throw new Error("the second session did not wait")
      if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20))
    }
    expect(finished).toBe(false)
    expect(notes).toEqual([])
    await holder.query("commit")
    const landed = await second
    expect(landed).toEqual({ ok: true, deck: named.deck, revision: 2, key: `${named.deck}:2` })
    const heard = Date.now()
    while (notes.length < 2) {
      if (Date.now() - heard > 2000) break
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    expect(notes).toEqual([`${named.deck}:1`, `${named.deck}:2`])
    const saved = await deck.query<{ revision: number; register: { landed: { value: string }[] } }>(
      "select revision, register from deck.saved where id = $1",
      [named.deck],
    )
    expect(saved.rows[0]?.revision).toBe(2)
    expect(saved.rows[0]?.register.landed.map((row) => row.value)).toEqual(["one", "two"])
  })
})
