import { Client } from "pg"
import { afterAll, describe, expect, it } from "vitest"

import { postgresInfo } from "./testing/harness.js"
import { openPool } from "./index.js"

describe("roles", () => {
  const clients: Client[] = []
  const pools: { end: () => Promise<void> }[] = []

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.end().catch(() => undefined)))
    await Promise.all(pools.map((pool) => pool.end()))
  })

  it("keeps the deck role out of the session schema", async () => {
    const info = await postgresInfo()
    const deck = openPool(info.deck, "grant-deck")
    pools.push(deck)
    const listen = new Client({ connectionString: info.listen, application_name: "grant-listen" })
    clients.push(listen)
    await listen.connect()
    const role = await deck.query<{ role: string }>("select current_user as role")
    expect(role.rows[0]?.role).toBe("deck")
    await expect(deck.query("select email from session.account")).rejects.toThrow(/permission denied/)
    await expect(listen.query("update deck.saved set revision = revision")).rejects.toThrow(/permission denied/)
    const sync = await deck.query<{ synchronous_commit: string }>("show synchronous_commit")
    expect(sync.rows[0]?.synchronous_commit).toBe("on")
    expect(deck.options.pipeline).not.toBe(true)
  })

  it("keeps the once table from the listen and session roles", async () => {
    const info = await postgresInfo()
    const listen = new Client({ connectionString: info.listen, application_name: "grant-listen-once" })
    clients.push(listen)
    await listen.connect()
    const session = new Client({ connectionString: info.session, application_name: "grant-session-once" })
    clients.push(session)
    await session.connect()
    await expect(listen.query("select once from deck.once")).rejects.toThrow(/permission denied/)
    await expect(session.query("select once from deck.once")).rejects.toThrow(/permission denied/)
  })
})
