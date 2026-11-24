import { createHash, randomBytes } from "node:crypto"
import { Client } from "pg"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import type { Migration } from "../migration.js"
import { migrations } from "../migrations.js"
import { startEmptyCluster, type EmptyCluster } from "../../testing/postgres-setup.js"
import { createRole, runBootstrap, runSetup, type Environment, type Write } from "../provision.js"
import { applySchema, migrationLock } from "../schema.js"

type Outcome = { readonly code: number; readonly stdout: string[]; readonly stderr: string[] }

const appRoles = ["session", "deck", "listen"] as const

const secrets = {
  session: randomBytes(18).toString("base64url"),
  deck: randomBytes(18).toString("base64url"),
  listen: randomBytes(18).toString("base64url"),
  migrator: randomBytes(18).toString("base64url"),
}

const latest = migrations.length

const first: Migration = migrations[0] ?? { id: 0, sql: "" }

function line(applied: number, at: number): string {
  return `setup: roles 3, migrations ${String(applied)} applied, now at ${String(at)}`
}

async function capture(step: (env: Environment, write: Write) => Promise<number>, env: Environment): Promise<Outcome> {
  const stdout: string[] = []
  const stderr: string[] = []
  const code = await step(env, (stream, written) => {
    ;(stream === "stdout" ? stdout : stderr).push(written)
  })
  return { code, stdout, stderr }
}

describe("database migrations", () => {
  let cluster: EmptyCluster
  let counter = 0
  const opened: Client[] = []

  const superUrl = (database: string): string => `postgres://postgres@127.0.0.1:${String(cluster.port)}/${database}`

  const roleUrl = (role: keyof typeof secrets, database: string): string =>
    `postgres://${role}:${secrets[role]}@127.0.0.1:${String(cluster.port)}/${database}`

  async function open(url: string, applicationName = "migrations-test"): Promise<Client> {
    const client = new Client({ connectionString: url, application_name: applicationName })
    await client.connect()
    opened.push(client)
    return client
  }

  function environmentOf(database: string): Environment {
    return {
      ADMIN_DATABASE_URL: superUrl(database),
      SESSION_DATABASE_URL: roleUrl("session", database),
      DECK_DATABASE_URL: roleUrl("deck", database),
      LISTEN_DATABASE_URL: roleUrl("listen", database),
      MIGRATOR_DATABASE_URL: roleUrl("migrator", database),
    }
  }

  async function emptyDatabase(): Promise<string> {
    counter += 1
    const database = `migrate_${String(counter)}`
    const admin = await open(superUrl("postgres"))
    await admin.query(`create database ${database}`)
    return database
  }

  async function bootstrappedDatabase(): Promise<string> {
    const database = await emptyDatabase()
    expect(await capture(runBootstrap, environmentOf(database))).toEqual({
      code: 0,
      stdout: ["bootstrap: roles 4"],
      stderr: [],
    })
    return database
  }

  function deployEnvironment(database: string): Environment {
    return { MIGRATOR_DATABASE_URL: roleUrl("migrator", database) }
  }

  async function recordedIds(client: Client): Promise<number[]> {
    const found = await client.query<{ id: number }>("select id from setup.migration order by id")
    return found.rows.map((row) => row.id)
  }

  async function waitForAdvisoryLock(watcher: Client, names: readonly string[]): Promise<void> {
    const started = Date.now()
    for (;;) {
      const found = await watcher.query<{ waiting: number }>(
        `select count(*)::integer as waiting from pg_stat_activity
         where application_name = any($1::text[]) and wait_event_type = 'Lock' and wait_event = 'advisory'`,
        [names],
      )
      if (found.rows[0]?.waiting === names.length) return
      if (Date.now() - started > 4000) throw new Error("the runs did not wait for the lock")
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }

  beforeAll(async () => {
    cluster = await startEmptyCluster()
  })

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((client) => client.end().catch(() => undefined)))
  })

  afterAll(async () => {
    await cluster.stop()
  })

  it("numbers the migrations from 1 with no gap", () => {
    expect(migrations.map((migration) => migration.id)).toEqual(migrations.map((_migration, index) => index + 1))
  })

  it("keeps migration 1 byte for byte as the old setup ran it", () => {
    expect(createHash("sha256").update(first.sql).digest("hex")).toBe(
      "49a01b229cf2656a79c4ad3e8c240f7b91eb83bc731c33933d07fb7650114521",
    )
  })

  it("gives a fresh database every migration with its tables and grants", async () => {
    const database = await bootstrappedDatabase()
    expect(await capture(runSetup, deployEnvironment(database))).toEqual({
      code: 0,
      stdout: [line(latest, latest)],
      stderr: [],
    })
    const admin = await open(superUrl(database))
    expect(await recordedIds(admin)).toEqual(migrations.map((migration) => migration.id))
    const full = "DELETE INSERT SELECT UPDATE"
    const noDelete = "INSERT SELECT UPDATE"
    const sessionRights: readonly (readonly [string, string])[] = [
      ["access", full],
      ["account", full],
      ["agent_turn", full],
      ["aira_ask", full],
      ["aira_ledger", noDelete],
      ["aira_turn", noDelete],
      ["caller_log", full],
      ["code", full],
      ["credit_history", "INSERT SELECT"],
      ["credits", noDelete],
      ["oauth_client", noDelete],
      ["oauth_grant", noDelete],
      ["oauth_token", noDelete],
      ["sent", full],
    ]
    const deckRights = [
      ["doom", full],
      ["doom_edit", "INSERT SELECT"],
      ["doom_node", noDelete],
      ["media", "DELETE INSERT SELECT"],
      ["original_delete", full],
    ] as const
    const tables = await admin.query<{ name: string; tableowner: string }>(
      `select schemaname || '.' || tablename as name, tableowner from pg_tables
       where schemaname in ('session', 'deck', 'setup') order by name`,
    )
    const named = [
      ...deckRights.map(([table]) => `deck.${table}`),
      ...sessionRights.map(([table]) => `session.${table}`),
      "setup.migration",
    ]
    expect(tables.rows).toEqual(named.map((name) => ({ name, tableowner: "migrator" })))
    const grants = await admin.query<{ grantee: string; name: string; rights: string }>(
      `select grantee, table_schema || '.' || table_name as name,
         string_agg(privilege_type, ' ' order by privilege_type) as rights
       from information_schema.role_table_grants
       where grantee in ('session', 'deck', 'listen')
       group by grantee, table_schema, table_name order by grantee, name`,
    )
    expect(grants.rows).toEqual([
      ...deckRights.map(([table, rights]) => ({ grantee: "deck", name: `deck.${table}`, rights })),
      ...sessionRights.map(([table, rights]) => ({ grantee: "session", name: `session.${table}`, rights })),
    ])
    const session = await open(roleUrl("session", database))
    await expect(
      session.query(
        "insert into session.sent (email, code, token, issued) values ('a@example.com', 'c', 't', now()) returning id",
      ),
    ).resolves.toMatchObject({ rowCount: 1 })
  })

  it("applies nothing and changes no row on a second run", async () => {
    const database = await bootstrappedDatabase()
    await capture(runSetup, deployEnvironment(database))
    const admin = await open(superUrl(database))
    await admin.query("insert into session.account (email) values ('kept@example.com')")
    const before = await admin.query("select id, applied from setup.migration order by id")
    expect(await capture(runSetup, deployEnvironment(database))).toEqual({
      code: 0,
      stdout: [line(0, latest)],
      stderr: [],
    })
    const after = await admin.query("select id, applied from setup.migration order by id")
    expect(after.rows).toEqual(before.rows)
    const accounts = await admin.query("select email from session.account")
    expect(accounts.rows).toEqual([{ email: "kept@example.com" }])
  })

  it("gives a database at migration 1 only the later ones and keeps its rows", async () => {
    const database = await bootstrappedDatabase()
    const migrator = await open(roleUrl("migrator", database))
    expect(await applySchema(migrator, [first])).toEqual({ applied: 1, at: 1 })
    await migrator.query("insert into session.account (email) values ('kept@example.com')")
    const later: readonly Migration[] = [
      first,
      { id: 2, sql: "alter table session.account add column note text" },
      { id: 3, sql: "create table deck.later (id integer primary key)" },
    ]
    expect(await applySchema(migrator, later)).toEqual({ applied: 2, at: 3 })
    expect(await recordedIds(migrator)).toEqual([1, 2, 3])
    const accounts = await migrator.query("select email, note from session.account")
    expect(accounts.rows).toEqual([{ email: "kept@example.com", note: null }])
    await expect(migrator.query("select id from deck.later")).resolves.toMatchObject({ rowCount: 0 })
  })

  it("names the stored replaced values of an agent's edit at migration 26, keeping each row's value", async () => {
    const database = await bootstrappedDatabase()
    const migrator = await open(roleUrl("migrator", database))
    await applySchema(
      migrator,
      migrations.filter((migration) => migration.id < 26),
    )
    await migrator.query("insert into session.account (email) values ('kept@example.com')")
    await migrator.query("insert into deck.doom (id, owner, rev) values ('fresh', 'kept@example.com', 1)")
    await migrator.query(
      `insert into deck.doom_edit (deck, rev, once, edit, was) values ('fresh', 1, 'a1', '{}', '[{"node":"s:4"}]')`,
    )
    expect(await applySchema(migrator)).toEqual({ applied: 2, at: latest })
    const kept = await migrator.query("select replaced from deck.doom_edit where deck = 'fresh'")
    expect(kept.rows).toEqual([{ replaced: [{ node: "s:4" }] }])
  })

  it("drops the old deck tables at migration 25 and queues their stored files, keeping a Doom deck's media", async () => {
    const database = await bootstrappedDatabase()
    const migrator = await open(roleUrl("migrator", database))
    await applySchema(
      migrator,
      migrations.filter((migration) => migration.id < 25),
    )
    await migrator.query("insert into session.account (email) values ('kept@example.com')")
    await migrator.query(
      `insert into deck.saved (id, revision, register, owner, original_key, original_bytes, original_sha256, original_stored)
       values ('old', 3, '{"old":true}', 'kept@example.com', 'originals/old', 21, 'ab', true)`,
    )
    await migrator.query(
      "insert into deck.once (email, deck, once, revision, notify) values ('kept@example.com', 'old', 'k', 3, 'old:3')",
    )
    await migrator.query("insert into deck.doom (id, owner, rev) values ('fresh', 'kept@example.com', 1)")
    await migrator.query(
      `insert into deck.media (key, deck, sha256, bytes)
       values ('media/old', 'old', 'aa', 5), ('media/fresh', 'fresh', 'bb', 6)`,
    )
    expect(
      await applySchema(
        migrator,
        migrations.filter((migration) => migration.id <= 25),
      ),
    ).toEqual({ applied: 1, at: 25 })
    const gone = await migrator.query<{ saved: string | null; once: string | null }>(
      "select to_regclass('deck.saved')::text as saved, to_regclass('deck.once')::text as once",
    )
    expect(gone.rows).toEqual([{ saved: null, once: null }])
    const queued = await migrator.query<{ key: string }>("select key from deck.original_delete order by key")
    expect(queued.rows.map((row) => row.key)).toEqual(["media/old", "originals/old"])
    const media = await migrator.query<{ key: string }>("select key from deck.media order by key")
    expect(media.rows.map((row) => row.key)).toEqual(["media/fresh"])
  })

  it("rolls a failed migration back, records nothing, and applies it on the next run", async () => {
    const database = await bootstrappedDatabase()
    const migrator = await open(roleUrl("migrator", database))
    const second: Migration = { id: 2, sql: "create table deck.second (id integer)" }
    const fourth: Migration = { id: 4, sql: "create table deck.fourth (id integer)" }
    const broken: Migration = { id: 3, sql: "create table deck.third (id integer); select 1 / 0" }
    await expect(applySchema(migrator, [first, second, broken, fourth])).rejects.toMatchObject({ code: "22012" })
    expect(await recordedIds(migrator)).toEqual([1, 2])
    const tables = await migrator.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'deck' order by tablename",
    )
    expect(tables.rows.map((row) => row.tablename)).toEqual(["once", "saved", "second"])
    const repaired: Migration = { id: 3, sql: "create table deck.third (id integer)" }
    expect(await applySchema(migrator, [first, second, repaired, fourth])).toEqual({ applied: 2, at: 4 })
    expect(await recordedIds(migrator)).toEqual([1, 2, 3, 4])
    await expect(migrator.query("select id from deck.third")).resolves.toMatchObject({ rowCount: 0 })
  })

  it("records a database made by the old setup at migration 1 without running it twice", async () => {
    const database = await emptyDatabase()
    const admin = await open(superUrl(database))
    for (const role of appRoles) await createRole(admin, role, secrets[role])
    await admin.query(first.sql)
    await admin.query("insert into session.account (email) values ('old@example.com')")
    expect(await capture(runBootstrap, environmentOf(database))).toEqual({
      code: 0,
      stdout: ["bootstrap: roles 4"],
      stderr: [],
    })
    expect(await capture(runSetup, deployEnvironment(database))).toEqual({
      code: 0,
      stdout: [line(latest - 1, latest)],
      stderr: [],
    })
    expect(await recordedIds(admin)).toEqual(migrations.map((migration) => migration.id))
    const accounts = await admin.query("select email from session.account")
    expect(accounts.rows).toEqual([{ email: "old@example.com" }])
    const owners = await admin.query<{ owner: string }>(
      `select distinct pg_get_userbyid(relowner) as owner from pg_class
       join pg_namespace on pg_namespace.oid = relnamespace
       where nspname in ('session', 'deck', 'setup') and relkind in ('r', 'S')
       union select distinct pg_get_userbyid(nspowner) from pg_namespace
       where nspname in ('session', 'deck', 'setup')`,
    )
    expect(owners.rows).toEqual([{ owner: "migrator" }])
    const session = await open(roleUrl("session", database))
    await expect(
      session.query("insert into session.sent (email, code, token, issued) values ('a@example.com', 'c', 't', now())"),
    ).resolves.toMatchObject({ rowCount: 1 })
    const migrator = await open(roleUrl("migrator", database))
    const grown: Migration = { id: latest + 1, sql: "alter table session.account add column note text" }
    expect(await applySchema(migrator, [...migrations, grown])).toEqual({ applied: 1, at: latest + 1 })
  })

  it("applies each migration once when two runs start at the same moment", async () => {
    const database = await bootstrappedDatabase()
    const list: readonly Migration[] = [
      first,
      { id: 2, sql: "create table deck.counted (id integer); insert into deck.counted values (1)" },
    ]
    const holder = await open(superUrl(database))
    const watcher = await open(superUrl(database))
    const one = await open(roleUrl("migrator", database), "migrate-one")
    const two = await open(roleUrl("migrator", database), "migrate-two")
    await holder.query("begin")
    await holder.query("select pg_advisory_xact_lock($1)", [migrationLock])
    const runs = Promise.all([applySchema(one, list), applySchema(two, list)])
    await waitForAdvisoryLock(watcher, ["migrate-one", "migrate-two"])
    await holder.query("commit")
    const results = await runs
    expect(results.reduce((sum, result) => sum + result.applied, 0)).toBe(2)
    expect(results.map((result) => result.at)).toEqual([2, 2])
    expect(await recordedIds(watcher)).toEqual([1, 2])
    const counted = await watcher.query("select id from deck.counted")
    expect(counted.rows).toEqual([{ id: 1 }])
  })

  it("keeps setup.migration from every app role", async () => {
    const database = await bootstrappedDatabase()
    await capture(runSetup, deployEnvironment(database))
    const admin = await open(superUrl(database))
    for (const role of appRoles) {
      const client = await open(roleUrl(role, database))
      await expect(client.query("select id from setup.migration")).rejects.toThrow(/permission denied/)
      await expect(client.query("insert into setup.migration (id) values (99)")).rejects.toThrow(/permission denied/)
      await expect(client.query("update setup.migration set id = 99")).rejects.toThrow(/permission denied/)
      await expect(client.query("delete from setup.migration")).rejects.toThrow(/permission denied/)
      const rights = await admin.query<{ schema: boolean; table: boolean }>(
        `select has_schema_privilege($1::text, 'setup', 'usage') as schema,
          has_table_privilege($1::text, 'setup.migration', 'select, insert, update, delete') as table`,
        [role],
      )
      expect(rights.rows).toEqual([{ schema: false, table: false }])
    }
  })

  it("lets the migrator add a column and a grant but not touch a role", async () => {
    const database = await bootstrappedDatabase()
    const migrator = await open(roleUrl("migrator", database))
    const flags = await migrator.query(
      "select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname = current_user",
    )
    expect(flags.rows).toEqual([{ rolcanlogin: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false }])
    await expect(migrator.query("create role intruder")).rejects.toMatchObject({ code: "42501" })
    await expect(migrator.query("alter role session nosuperuser")).rejects.toMatchObject({ code: "42501" })
    const grown: Migration = {
      id: 2,
      sql: `
        alter table session.account add column note text;
        grant usage on schema session to listen;
        grant select (note) on session.account to listen;
      `,
    }
    expect(await applySchema(migrator, [first, grown])).toEqual({ applied: 2, at: 2 })
    await migrator.query("insert into session.account (email, note) values ('a@example.com', 'hello')")
    const listen = await open(roleUrl("listen", database))
    const notes = await listen.query("select note from session.account")
    expect(notes.rows).toEqual([{ note: "hello" }])
  })

  it("runs the deploy step from the migrator url and never reads the admin url", async () => {
    const database = await bootstrappedDatabase()
    const read = new Set<string>()
    const env = new Proxy(environmentOf(database), {
      get(target, name, receiver): unknown {
        if (typeof name === "string") read.add(name)
        return Reflect.get(target, name, receiver) as unknown
      },
    })
    const outcome = await capture(runSetup, env)
    expect(outcome.code).toBe(0)
    expect([...read]).toEqual(["MIGRATOR_DATABASE_URL"])
  })

  it("names the migrator url when the deploy step does not have it", async () => {
    const database = await emptyDatabase()
    const { MIGRATOR_DATABASE_URL: _migrator, ...rest } = environmentOf(database)
    expect(await capture(runSetup, rest)).toEqual({ code: 1, stdout: [], stderr: ["MIGRATOR_DATABASE_URL"] })
  })
})
