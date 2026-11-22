import { randomBytes } from "node:crypto"
import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"

import { migrations } from "./platform/migrations.js"
import { startEmptyCluster, type EmptyCluster } from "./testing/postgres-setup.js"
import { runBootstrap } from "./platform/provision.js"
import { applySchema } from "./platform/schema.js"

const secrets = {
  session: randomBytes(18).toString("base64url"),
  deck: randomBytes(18).toString("base64url"),
  listen: randomBytes(18).toString("base64url"),
  migrator: randomBytes(18).toString("base64url"),
}
const tables = ["session.account", "session.access", "session.aira_ledger", "deck.saved"]
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

async function rows(client: Client): Promise<unknown[]> {
  const all: unknown[] = []
  for (const table of tables) all.push((await client.query(`select * from ${table} order by 1`)).rows)
  return all
}

beforeAll(async () => {
  cluster = await startEmptyCluster()
})

afterAll(async () => {
  await Promise.all(opened.map((client) => client.end().catch(() => undefined)))
  await cluster.stop()
})

it("keys a database at migration 4 to its accounts without changing a row, and deletes rows that predate the keys", async () => {
  const admin = await open("postgres", "postgres")
  await admin.query("create database keyed")
  const bootstrapped = await runBootstrap(
    {
      ADMIN_DATABASE_URL: roleUrl("postgres", "keyed"),
      SESSION_DATABASE_URL: roleUrl("session", "keyed"),
      DECK_DATABASE_URL: roleUrl("deck", "keyed"),
      LISTEN_DATABASE_URL: roleUrl("listen", "keyed"),
      MIGRATOR_DATABASE_URL: roleUrl("migrator", "keyed"),
    },
    () => undefined,
  )
  expect(bootstrapped).toBe(0)
  const migrator = await open("migrator", "keyed")
  await applySchema(migrator, migrations.slice(0, 4))
  await migrator.query(`
    insert into session.account (email) values ('kept@example.com');
    insert into session.access (token, email, issued) values ('kept', 'kept@example.com', now()), ('gone', 'gone@example.com', now());
    insert into session.aira_ledger (email, monday) values ('gone@example.com', now());
    insert into deck.saved (id, revision, register, owner) values ('kept', 1, '{}', 'kept@example.com'), ('gone', 1, '{}', 'gone@example.com');
  `)
  const before = await rows(migrator)
  expect(await applySchema(migrator, migrations.slice(0, 5))).toEqual({ applied: 1, at: 5 })
  expect(await rows(migrator)).toEqual(before)

  const deck = await open("deck", "keyed")
  const session = await open("session", "keyed")
  await expect(
    deck.query("insert into deck.saved (id, revision, register, owner) values ('late', 0, '{}', 'gone@example.com')"),
  ).rejects.toMatchObject({ code: "23503" })
  await expect(
    session.query("insert into session.aira_ledger (email, monday) values ('nobody@example.com', now())"),
  ).rejects.toMatchObject({ code: "23503" })
  await expect(deck.query("select session.delete_account('kept@example.com')")).rejects.toMatchObject({
    code: "42501",
  })

  await session.query("select session.delete_account('gone@example.com')")
  const [accounts, access, ledger, decks] = await rows(migrator)
  expect([accounts, access, ledger, decks]).toEqual([
    [{ email: "kept@example.com" }],
    [expect.objectContaining({ token: "kept" })],
    [],
    [expect.objectContaining({ id: "kept" })],
  ])
})
