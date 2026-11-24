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

beforeAll(async () => {
  cluster = await startEmptyCluster()
})

afterAll(async () => {
  await Promise.all(opened.map((client) => client.end().catch(() => undefined)))
  await cluster.stop()
})

it("backfills connected timestamps on used grants at migration 5 and requires connected on used grants", async () => {
  const admin = await open("postgres", "postgres")
  await admin.query("create database grants_connected")
  const bootstrapped = await runBootstrap(
    {
      ADMIN_DATABASE_URL: roleUrl("postgres", "grants_connected"),
      SESSION_DATABASE_URL: roleUrl("session", "grants_connected"),
      DECK_DATABASE_URL: roleUrl("deck", "grants_connected"),
      LISTEN_DATABASE_URL: roleUrl("listen", "grants_connected"),
      MIGRATOR_DATABASE_URL: roleUrl("migrator", "grants_connected"),
    },
    () => undefined,
  )
  expect(bootstrapped).toBe(0)

  const migrator = await open("migrator", "grants_connected")
  await applySchema(migrator, migrations.slice(0, 5))
  await migrator.query(`
    insert into session.account (email) values ('person@example.com');
    insert into session.oauth_client (id, name, redirect_uris)
      values ('client-1', 'Claude', array['https://claude.ai/api/mcp/auth_callback']);
    insert into session.oauth_grant
      (id, principal, code, generation, revoked, client_id, redirect_uri, challenge, code_hash, code_expires)
    values
      ('open-grant', 'person@example.com', 'open', 0, false, 'client-1', 'https://claude.ai/api/mcp/auth_callback', 'c1', 'h1', 1700000600000),
      ('used-grant', 'person@example.com', 'used', 1, false, 'client-1', 'https://claude.ai/api/mcp/auth_callback', 'c2', 'h2', 1700000600000);
  `)

  expect(await applySchema(migrator)).toEqual({ applied: migrations.length - 5, at: migrations.length })

  const found = await migrator.query<{ id: string; connected: Date | null }>(
    "select id, connected from session.oauth_grant order by id",
  )
  expect(found.rows).toEqual([
    { id: "open-grant", connected: null },
    { id: "used-grant", connected: new Date(1_700_000_000_000) },
  ])

  const session = await open("session", "grants_connected")
  await expect(
    session.query(`
      insert into session.oauth_grant
        (id, principal, code, generation, revoked, client_id, redirect_uri, challenge, code_hash, code_expires, connected)
      values
        ('bad-used', 'person@example.com', 'used', 1, false, 'client-1', 'https://claude.ai/api/mcp/auth_callback', 'c3', 'h3', 1700000600000, null)
    `),
  ).rejects.toMatchObject({ code: "23514" })
})
