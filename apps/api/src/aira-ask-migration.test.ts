import { Client } from "pg"
import { expect, it } from "vitest"

import { sharedCluster, unmigratedDatabase } from "./testing/harness.js"
import { migrations } from "./platform/migrations.js"
import { applySchema } from "./platform/schema.js"

it("names each ask once at migration 16 and keeps every row it found", async () => {
  const database = await unmigratedDatabase()
  const db = new Client({ connectionString: database.admin })
  try {
    const template = new URL((await sharedCluster()).admin)
    const address = new URL(database.admin)
    expect(address.host).toBe(template.host)
    expect(address.pathname).not.toBe(template.pathname)
    await db.connect()
    expect(await applySchema(db, migrations.slice(0, 15))).toEqual({ applied: 15, at: 15 })
    await db.query("insert into session.account (email) values ('a@example.com'), ('b@example.com')")
    await db.query(`
      insert into session.aira_ask (email, ask, stopped) values
        ('a@example.com', 'twice', null),
        ('a@example.com', 'twice', now()),
        ('a@example.com', 'thrice', now()),
        ('a@example.com', 'thrice', null),
        ('a@example.com', 'thrice', null),
        ('a@example.com', null, null),
        ('a@example.com', null, null),
        ('b@example.com', 'twice', null),
        ('a@example.com', 'alone', now())
    `)
    const before = await db.query<{ id: string; stopped: Date | null; started: Date }>(
      "select id, stopped, started from session.aira_ask order by id",
    )

    expect(await applySchema(db)).toEqual({ applied: migrations.length - 15, at: migrations.length })

    const after = await db.query<{
      id: string
      email: string
      ask: string | null
      stopped: Date | null
      started: Date
      followed: boolean
    }>("select id, email, ask, stopped, started, followed from session.aira_ask order by id")
    expect(after.rows.map(({ id, stopped, started }) => ({ id, stopped, started }))).toEqual(before.rows)
    expect(after.rows.map(({ email, ask, followed }) => [email, ask, followed])).toEqual([
      ["a@example.com", null, true],
      ["a@example.com", "twice", true],
      ["a@example.com", null, true],
      ["a@example.com", null, true],
      ["a@example.com", "thrice", true],
      ["a@example.com", null, true],
      ["a@example.com", null, true],
      ["b@example.com", "twice", true],
      ["a@example.com", "alone", true],
    ])
    await expect(
      db.query("insert into session.aira_ask (email, ask) values ('a@example.com', 'twice')"),
    ).rejects.toMatchObject({ code: "23505", constraint: "aira_ask_email" })
    await expect(
      db.query("insert into session.aira_ask (email, ask) values ('a@example.com', null)"),
    ).resolves.toMatchObject({ rowCount: 1 })
  } finally {
    try {
      await db.end()
    } finally {
      await database.drop()
    }
  }
})
