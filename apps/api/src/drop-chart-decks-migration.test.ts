import { randomBytes } from "node:crypto"
import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"

import { startEmptyCluster, type EmptyCluster } from "./testing/postgres-setup.js"
import { runBootstrap } from "./platform/provision.js"
import { applySchema } from "./platform/schema.js"
import { migrations } from "./platform/testing/migrations.js"

const secrets = {
  session: randomBytes(18).toString("base64url"),
  deck: randomBytes(18).toString("base64url"),
  listen: randomBytes(18).toString("base64url"),
  migrator: randomBytes(18).toString("base64url"),
}
const tables = ["deck.doom", "deck.doom_node", "deck.doom_edit", "session.agent_turn", "deck.media"]
const opened: Client[] = []
let cluster: EmptyCluster

function roleUrl(role: keyof typeof secrets | "postgres", database: string): string {
  const secret = role === "postgres" ? "" : `:${secrets[role]}`
  return `postgres://${role}${secret}@127.0.0.1:${String(cluster.port)}/${database}`
}

async function open(role: keyof typeof secrets | "postgres", database: string): Promise<Client> {
  const client = new Client({ connectionString: roleUrl(role, database) })
  await client.connect()
  opened.push(client)
  return client
}

async function deckRows(client: Client, deck: string): Promise<string[][]> {
  const rows: string[][] = []
  for (const table of tables) {
    const key = table === "deck.doom" ? "id" : "deck"
    const result = await client.query<{ row: string }>(
      `select to_jsonb(t)::text as row from ${table} t where ${key} = $1 order by 1`,
      [deck],
    )
    rows.push(result.rows.map(({ row }) => row))
  }
  return rows
}

beforeAll(async () => {
  cluster = await startEmptyCluster()
})

afterAll(async () => {
  await Promise.all(opened.map((client) => client.end().catch(() => undefined)))
  await cluster.stop()
})

it("drops decks with chart data, edits or revisions and keeps linked chart decks, even one whose run removed a row named chart", async () => {
  const admin = await open("postgres", "postgres")
  await admin.query("create database cutover")
  expect(
    await runBootstrap(
      {
        ADMIN_DATABASE_URL: roleUrl("postgres", "cutover"),
        SESSION_DATABASE_URL: roleUrl("session", "cutover"),
        DECK_DATABASE_URL: roleUrl("deck", "cutover"),
        LISTEN_DATABASE_URL: roleUrl("listen", "cutover"),
        MIGRATOR_DATABASE_URL: roleUrl("migrator", "cutover"),
      },
      () => undefined,
    ),
  ).toBe(0)
  const migrator = await open("migrator", "cutover")
  await applySchema(
    migrator,
    migrations.filter(({ id }) => id < 29),
  )
  await migrator.query(`
    insert into session.account (email) values ('owner@example.com');
    insert into deck.doom (id, owner, rev)
      select id, 'owner@example.com', 2 from unnest(array['a', 'b', 'c', 'd', 'replaced-only']) as id;
    insert into deck.doom_node (deck, id, type, node, revs) values
      ('a', 'part', 'frame', '{"type":"frame","chart":{"kind":"column","categories":[],"series":[]}}', '{}'),
      ('b', 'slide', 'slide', '{"type":"slide"}', '{}'),
      ('c', 'part', 'frame', '{"type":"frame"}', '{"chart":1}'),
      ('d', 'part', 'frame', '{"type":"frame","instance":{}}', '{}');
    insert into deck.doom_edit (deck, rev, once, edit, replaced) values
      ('a', 1, 'create', '{}', null),
      ('b', 1, 'create', '{"writes":[{"node":"part","prop":"chart","value":{}}]}', null),
      ('b', 2, 'delete', '{"writes":[{"node":"part","prop":"type","value":null}]}', null),
      ('c', 1, 'create', '{}', null),
      ('replaced-only', 1, 'delete', '{}', '[{"node":"part","key":"chart","value":{}}]'),
      ('d', 1, 'trim', '{}', '{"cells":[{"node":"part","key":["bar","chart"],"value":{}}]}');
    insert into session.agent_turn (email, deck, last_call, revision)
      select owner, id, 1, rev from deck.doom;
    insert into deck.media (key, deck, sha256, bytes) values
      ('old-media', 'a', 'old-hash', 12),
      ('kept-media', 'd', 'kept-hash', 14);
  `)
  const kept = await deckRows(migrator, "d")

  const throughCutover = migrations.filter(({ id }) => id <= 29)
  expect(await applySchema(migrator, throughCutover)).toEqual({ applied: 1, at: 29 })
  for (const id of ["a", "b", "c", "replaced-only"]) {
    expect(await deckRows(migrator, id)).toEqual([[], [], [], [], []])
  }
  expect(await deckRows(migrator, "d")).toEqual(kept)
  expect((await migrator.query("select key, owner from deck.original_delete order by key")).rows).toEqual([
    { key: "old-media", owner: "owner@example.com" },
  ])
  expect(await applySchema(migrator, throughCutover)).toEqual({ applied: 0, at: 29 })
})
