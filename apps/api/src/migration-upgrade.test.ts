import { Client } from "pg"
import { expect, it } from "vitest"

import { migrations } from "./migrations.js"
import { startEmptyCluster } from "./postgres-setup.js"
import { createRole, runSetup } from "./provision.js"
import { applySchema } from "./schema.js"

it("adds the import index and its deleted-row constraint after migration 6", async () => {
  const cluster = await startEmptyCluster()
  const url = `postgres://postgres@127.0.0.1:${String(cluster.port)}/postgres`
  const db = new Client({ connectionString: url })
  try {
    await db.connect()
    for (const role of ["session", "deck", "listen"]) await createRole(db, role, "local-test")
    expect(await applySchema(db, migrations.slice(0, 6))).toEqual({ applied: 6, at: 6 })
    expect((await db.query("select id from setup.migration order by id")).rows).toEqual(
      [1, 2, 3, 4, 5, 6].map((id) => ({ id })),
    )
    await expect(db.query("select import_index from deck.saved")).rejects.toMatchObject({ code: "42703" })
    const output: string[] = []
    expect(await runSetup({ MIGRATOR_DATABASE_URL: url }, (_stream, line) => output.push(line))).toBe(0)
    const latest = migrations.length
    expect(output).toEqual([`setup: roles 3, migrations ${String(latest - 6)} applied, now at ${String(latest)}`])
    expect((await db.query("select id from setup.migration order by id")).rows).toEqual(
      migrations.map(({ id }) => ({ id })),
    )
    await db.query("insert into session.account (email) values ('kept@example.com')")
    await db.query(
      `insert into deck.saved (id, revision, register, owner, import_index)
       values ('kept', 0, '{}', 'kept@example.com', '{"slides":[]}')`,
    )
    expect((await db.query("select import_index from deck.saved where id = 'kept'")).rows).toEqual([
      { import_index: { slides: [] } },
    ])
    await expect(
      db.query("update deck.saved set deleted = now(), register = null where id = 'kept'"),
    ).rejects.toMatchObject({ code: "23514", constraint: "saved_deleted_index_empty" })
    await expect(
      db.query("update deck.saved set deleted = now(), register = null, import_index = null where id = 'kept'"),
    ).resolves.toMatchObject({ rowCount: 1 })
  } finally {
    await db.end()
    await cluster.stop()
  }
})
