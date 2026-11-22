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

it("moves a stored scene deck's fold into one row per node with the live counts", async () => {
  const cluster = await startEmptyCluster()
  const url = `postgres://postgres@127.0.0.1:${String(cluster.port)}/postgres`
  const db = new Client({ connectionString: url })
  const at = (id: string) => ({ id, at: "a" })
  const node = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, rev: 1, type, ...extra })
  const fold = {
    rev: 3,
    nodes: {
      "s:1": node("s:1", "deck", { name: "Old" }),
      "s:2": node("s:2", "slideRow", { parent: at("s:1") }),
      "s:3": node("s:3", "slide", { parent: at("s:2") }),
      "s:4": node("s:4", "slide", { parent: null }),
      "s:5": node("s:5", "shape", { parent: at("s:3") }),
      "s:6": node("s:6", "slideRow", { parent: at("s:1"), hidden: true }),
      "s:7": node("s:7", "slide", { parent: at("s:6") }),
    },
    revs: { "s:5": { name: 2 } },
    onces: { first: 1 },
    runs: { "run-1": { phase: "running", guarded: ["s:5"] } },
  }
  try {
    await db.connect()
    for (const role of ["session", "deck", "listen"]) await createRole(db, role, "local-test")
    await applySchema(db, migrations.slice(0, 21))
    await db.query("insert into session.account (email) values ('kept@example.com')")
    await db.query(
      "insert into deck.scene (id, owner, name, rev, fold) values ('old', 'kept@example.com', 'Old', 3, $1::jsonb)",
      [JSON.stringify(fold)],
    )
    await applySchema(db, migrations)
    const rows = await db.query("select id, type, parent, revs from deck.scene_node where deck = 'old' order by id")
    expect(rows.rows).toEqual([
      { id: "s:1", type: "deck", parent: null, revs: {} },
      { id: "s:2", type: "slideRow", parent: "s:1", revs: {} },
      { id: "s:3", type: "slide", parent: "s:2", revs: {} },
      { id: "s:4", type: "slide", parent: null, revs: {} },
      { id: "s:5", type: "shape", parent: "s:3", revs: { name: 2 } },
      { id: "s:6", type: "slideRow", parent: "s:1", revs: {} },
      { id: "s:7", type: "slide", parent: "s:6", revs: {} },
    ])
    const head = await db.query("select rev, name, runs, elements, slides from deck.scene where id = 'old'")
    expect(head.rows).toEqual([{ rev: 3, name: "Old", runs: fold.runs, elements: 5, slides: 1 }])
    await expect(db.query("select fold from deck.scene")).rejects.toMatchObject({ code: "42703" })
  } finally {
    await db.end()
    await cluster.stop()
  }
})
