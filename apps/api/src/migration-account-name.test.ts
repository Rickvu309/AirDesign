import { Client } from "pg"
import { expect, it } from "vitest"
import { createRole } from "./platform/provision.js"
import { startEmptyCluster } from "./testing/postgres-setup.js"
import { applySchema } from "./platform/schema.js"
import { migrations } from "./platform/testing/migrations.js"

it("keeps existing accounts optional and asks new accounts for a name", async () => {
  const cluster = await startEmptyCluster()
  const db = new Client({ connectionString: `postgres://postgres@127.0.0.1:${String(cluster.port)}/postgres` })
  try {
    await db.connect()
    for (const role of ["session", "deck", "listen"]) await createRole(db, role, "local-test")
    await applySchema(
      db,
      migrations.filter(({ id }) => id < 17),
    )
    await db.query("insert into session.account (email) values ('existing@example.com')")
    await applySchema(
      db,
      migrations.filter(({ id }) => id <= 17),
    )
    await db.query("insert into session.account (email) values ('new@example.com')")
    expect((await db.query("select email, name from session.account order by email")).rows).toEqual([
      { email: "existing@example.com", name: "" },
      { email: "new@example.com", name: null },
    ])
    await db.query("update session.account set name = '林' where email = 'new@example.com'")
    await applySchema(
      db,
      migrations.filter(({ id }) => id <= 17),
    )
    expect((await db.query("select name from session.account where email = 'new@example.com'")).rows).toEqual([
      { name: "林" },
    ])
  } finally {
    await db.end()
    await cluster.stop()
  }
})
