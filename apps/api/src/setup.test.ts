import { randomBytes } from "node:crypto"
import { Client } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { migrations } from "./platform/migrations.js"
import { startEmptyCluster, type EmptyCluster } from "./testing/postgres-setup.js"
import { runBootstrap, runSetup, type Environment, type Write } from "./platform/provision.js"

type Role = "session" | "deck" | "listen" | "migrator"

type Urls = {
  readonly admin: string
  readonly session: string
  readonly deck: string
  readonly listen: string
  readonly migrator: string
}

type Outcome = { readonly code: number; readonly stdout: string[]; readonly stderr: string[] }

const roles: readonly Role[] = ["session", "deck", "listen", "migrator"]

const latest = migrations.length

const builtLine = `setup: roles 3, migrations ${String(latest)} applied, now at ${String(latest)}`

const keptLine = `setup: roles 3, migrations 0 applied, now at ${String(latest)}`

const variableOf = {
  admin: "ADMIN_DATABASE_URL",
  session: "SESSION_DATABASE_URL",
  deck: "DECK_DATABASE_URL",
  listen: "LISTEN_DATABASE_URL",
  migrator: "MIGRATOR_DATABASE_URL",
} as const

function password(): string {
  return randomBytes(18).toString("base64url")
}

function distinctive(name: string): string {
  return `${name}Secret${randomBytes(24).toString("hex")}`
}

type Secrets = Record<"admin" | Role, string>

function expectNoSecrets(outcome: Outcome, secrets: Secrets): void {
  const everything = `${outcome.stdout.join("\n")}\n${outcome.stderr.join("\n")}`
  for (const secret of Object.values(secrets)) expect(everything).not.toContain(secret)
}

function openClient(url: string): Promise<Client> {
  const client = new Client({ connectionString: url })
  return client.connect().then(() => client)
}

function environmentOf(urls: Urls): Record<string, string> {
  return {
    [variableOf.admin]: urls.admin,
    [variableOf.session]: urls.session,
    [variableOf.deck]: urls.deck,
    [variableOf.listen]: urls.listen,
    [variableOf.migrator]: urls.migrator,
  }
}

async function capture(step: (env: Environment, write: Write) => Promise<number>, env: Environment): Promise<Outcome> {
  const stdout: string[] = []
  const stderr: string[] = []
  const code = await step(env, (stream, line) => {
    ;(stream === "stdout" ? stdout : stderr).push(line)
  })
  return { code, stdout, stderr }
}

async function run(env: Record<string, string | undefined>): Promise<Outcome> {
  const bootstrapped = await capture(runBootstrap, env)
  if (bootstrapped.code !== 0) return bootstrapped
  return capture(runSetup, env)
}

describe("database setup", () => {
  let cluster: EmptyCluster
  let counter = 0

  const superUrl = (database: string): string => `postgres://postgres@127.0.0.1:${String(cluster.port)}/${database}`

  const roleUrl = (role: string, secret: string, database: string): string =>
    `postgres://${role}:${encodeURIComponent(secret)}@127.0.0.1:${String(cluster.port)}/${database}`

  async function asSuperuser<T>(database: string, work: (client: Client) => Promise<T>): Promise<T> {
    const client = await openClient(superUrl(database))
    try {
      return await work(client)
    } finally {
      await client.end()
    }
  }

  async function freshDatabase(): Promise<{ urls: Urls; database: string; secrets: Secrets }> {
    counter += 1
    const database = `setup_${String(counter)}`
    await asSuperuser("postgres", (client) => client.query(`create database ${database}`))
    const secrets: Secrets = {
      admin: distinctive("admin"),
      session: distinctive("session"),
      deck: distinctive("deck"),
      listen: distinctive("listen"),
      migrator: distinctive("migrator"),
    }
    return {
      database,
      secrets,
      urls: {
        admin: `postgres://postgres:${secrets.admin}@127.0.0.1:${String(cluster.port)}/${database}`,
        session: roleUrl("session", secrets.session, database),
        deck: roleUrl("deck", secrets.deck, database),
        listen: roleUrl("listen", secrets.listen, database),
        migrator: roleUrl("migrator", secrets.migrator, database),
      },
    }
  }

  async function flagsOfRoles(): Promise<unknown[]> {
    const found = await asSuperuser("postgres", (client) =>
      client.query(
        `select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole
         from pg_roles where rolname in ('session', 'deck', 'listen', 'migrator') order by rolname`,
      ),
    )
    return found.rows
  }

  async function schemasIn(database: string): Promise<string[]> {
    const found = await asSuperuser(database, (client) =>
      client.query<{ nspname: string }>("select nspname from pg_namespace where nspname in ('session', 'deck')"),
    )
    return found.rows.map((row) => row.nspname)
  }

  beforeAll(async () => {
    cluster = await startEmptyCluster()
  })

  beforeEach(async () => {
    await asSuperuser("postgres", async (client) => {
      const found = await client.query<{ datname: string }>(
        "select datname from pg_database where datname like 'setup\\_%'",
      )
      for (const row of found.rows) await client.query(`drop database ${row.datname} with (force)`)
      await client.query("drop role if exists session, deck, listen, migrator, boss")
    })
  })

  afterAll(async () => {
    await cluster.stop()
  })

  it("creates the three roles and the schema on an empty database", async () => {
    const { urls } = await freshDatabase()
    const outcome = await run(environmentOf(urls))
    expect(outcome).toEqual({ code: 0, stdout: [builtLine], stderr: [] })
    const session = await openClient(urls.session)
    const deck = await openClient(urls.deck)
    const listen = await openClient(urls.listen)
    try {
      await session.query("insert into session.account (email) values ('a@example.com')")
      await expect(deck.query("select email from session.account")).rejects.toThrow(/permission denied/)
      await expect(listen.query("select id from deck.doom")).rejects.toThrow(/permission denied/)
    } finally {
      await Promise.all([session.end(), deck.end(), listen.end()])
    }
  })

  it("changes nothing on a second run", async () => {
    const { urls } = await freshDatabase()
    await run(environmentOf(urls))
    const session = await openClient(urls.session)
    try {
      await session.query("insert into session.account (email) values ('kept@example.com')")
      const outcome = await run(environmentOf(urls))
      expect(outcome).toEqual({ code: 0, stdout: [keptLine], stderr: [] })
      const rows = await session.query<{ email: string }>("select email from session.account")
      expect(rows.rows).toEqual([{ email: "kept@example.com" }])
    } finally {
      await session.end()
    }
  })

  it("prints schema created and then schema kept", async () => {
    const { urls } = await freshDatabase()
    const first = await run(environmentOf(urls))
    const second = await run(environmentOf(urls))
    expect(first).toEqual({ code: 0, stdout: [builtLine], stderr: [] })
    expect(second).toEqual({ code: 0, stdout: [keptLine], stderr: [] })
  })

  it("sets the password from the url when the role already exists", async () => {
    const { urls, database } = await freshDatabase()
    await run(environmentOf(urls))
    const changed = roleUrl("deck", password(), database)
    const outcome = await run(environmentOf({ ...urls, deck: changed }))
    expect(outcome.code).toBe(0)
    const reconnected = await openClient(changed)
    await reconnected.end()
    await expect(openClient(urls.deck)).rejects.toThrow(/password authentication failed/)
  })

  it("sets a password that needs percent-encoding", async () => {
    const { urls, database } = await freshDatabase()
    const awkward = "p@ss/w:r%d'; create role evil superuser; -- x"
    const encoded = `postgres://deck:${encodeURIComponent(awkward)}@127.0.0.1:${String(cluster.port)}/${database}`
    const outcome = await run(environmentOf({ ...urls, deck: encoded }))
    expect(outcome.code).toBe(0)
    const byUrl = await openClient(encoded)
    await byUrl.end()
    const byParts = new Client({
      host: "127.0.0.1",
      port: cluster.port,
      database,
      user: "deck",
      password: awkward,
    })
    await byParts.connect()
    await byParts.end()
    const evil = await asSuperuser("postgres", (client) =>
      client.query("select 1 from pg_roles where rolname = 'evil'"),
    )
    expect(evil.rowCount).toBe(0)
  })

  it("exits when a database url is missing", async () => {
    const { urls } = await freshDatabase()
    const { [variableOf.admin]: _admin, ...rest } = environmentOf(urls)
    const outcome = await run(rest)
    expect(outcome.code).toBe(1)
    expect(outcome.stdout).toEqual([])
    expect(outcome.stderr.join("\n")).toContain("ADMIN_DATABASE_URL")
    expect(outcome.stderr.join("\n")).not.toContain("postgres://")
  })

  it("names each missing variable", async () => {
    const { urls } = await freshDatabase()
    for (const name of Object.values(variableOf)) {
      const env: Record<string, string | undefined> = { ...environmentOf(urls) }
      delete env[name]
      expect(await run(env)).toEqual({ code: 1, stdout: [], stderr: [name] })
      expect(await run({ ...env, [name]: "" })).toEqual({ code: 1, stdout: [], stderr: [name] })
    }
    expect(await run({})).toEqual({ code: 1, stdout: [], stderr: [Object.values(variableOf).join(" ")] })
  })

  it("exits 1 with one line and no url when the admin password is wrong", async () => {
    const { urls, database, secrets } = await freshDatabase()
    const bossSecret = password()
    await asSuperuser("postgres", (client) => client.query(`create role boss login superuser password '${bossSecret}'`))
    const wrongSecret = password()
    const outcome = await run(
      environmentOf({
        ...urls,
        admin: `postgres://boss:${wrongSecret}@127.0.0.1:${String(cluster.port)}/${database}`,
      }),
    )
    expect(outcome.code).toBe(1)
    expect(outcome.stdout).toEqual([])
    expect(outcome.stderr).toHaveLength(1)
    const everything = `${outcome.stdout.join("\n")}\n${outcome.stderr.join("\n")}`
    for (const secret of [
      "postgres://",
      "boss",
      "127.0.0.1",
      String(cluster.port),
      wrongSecret,
      bossSecret,
      urls.session,
      urls.deck,
      urls.listen,
    ]) {
      expect(everything).not.toContain(secret)
    }
    expectNoSecrets(outcome, secrets)
    const roleRows = await asSuperuser("postgres", (client) =>
      client.query("select 1 from pg_roles where rolname in ('session', 'deck', 'listen')"),
    )
    expect(roleRows.rowCount).toBe(0)
  })

  it("exits when a role url has no password", async () => {
    const { urls, database, secrets } = await freshDatabase()
    await run(environmentOf(urls))
    const base = `127.0.0.1:${String(cluster.port)}/${database}`
    for (const role of roles) {
      for (const bare of [
        `postgres://${role}@${base}`,
        `postgres://${role}:@${base}`,
        `postgres://${role}@${base}?password=x`,
      ]) {
        const outcome = await run(environmentOf({ ...urls, [role]: bare }))
        expect(outcome.code).toBe(1)
        expect(outcome.stdout).toEqual([])
        expect(outcome.stderr).toHaveLength(1)
        expect(outcome.stderr[0]).toContain(variableOf[role])
        expect(outcome.stderr[0]).not.toContain("postgres://")
        expectNoSecrets(outcome, secrets)
        const stillConnects = await openClient(urls[role])
        await stillConnects.end()
      }
    }
  })

  it("leaves no role and no schema when the third role fails", async () => {
    const colliding = await freshDatabase()
    await asSuperuser(colliding.database, (client) => client.query("create schema deck"))
    const collided = await run(environmentOf(colliding.urls))
    expect(collided.code).toBe(1)
    expect(collided.stdout).toEqual([])
    expect(collided.stderr).toHaveLength(1)
    expectNoSecrets(collided, colliding.secrets)
    expect(await flagsOfRoles()).toEqual([])
    expect(await schemasIn(colliding.database)).toEqual(["deck"])

    const empty = await freshDatabase()
    const failed = await run(
      environmentOf({
        ...empty.urls,
        listen: `postgres://listen:abc%00def@127.0.0.1:${String(cluster.port)}/${empty.database}`,
      }),
    )
    expect(failed.code).toBe(1)
    expect(failed.stderr).toHaveLength(1)
    expectNoSecrets(failed, empty.secrets)
    expect(failed.stderr.join("\n")).not.toContain("abc")
    expect(await flagsOfRoles()).toEqual([])
    expect(await schemasIn(empty.database)).toEqual([])

    const settled = await freshDatabase()
    expect((await run(environmentOf(settled.urls))).code).toBe(0)
    const before = await asSuperuser("postgres", (client) =>
      client.query(
        "select rolname, rolpassword from pg_authid where rolname in ('session', 'deck', 'listen') order by rolname",
      ),
    )
    const later = await freshDatabase()
    const failedAgain = await run(
      environmentOf({
        ...later.urls,
        listen: `postgres://listen:abc%00def@127.0.0.1:${String(cluster.port)}/${later.database}`,
      }),
    )
    expect(failedAgain.code).toBe(1)
    expectNoSecrets(failedAgain, later.secrets)
    expect(failedAgain.stderr.join("\n")).not.toContain("abc")
    const after = await asSuperuser("postgres", (client) =>
      client.query(
        "select rolname, rolpassword from pg_authid where rolname in ('session', 'deck', 'listen') order by rolname",
      ),
    )
    expect(after.rows).toEqual(before.rows)
    expect(await schemasIn(later.database)).toEqual([])
    for (const role of roles) {
      const stillConnects = await openClient(settled.urls[role])
      await stillConnects.end()
    }
  })

  it("makes every role login with no superuser, createdb or createrole", async () => {
    const expected = roles
      .toSorted()
      .map((rolname) => ({ rolname, rolcanlogin: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false }))
    const created = await freshDatabase()
    expect((await run(environmentOf(created.urls))).code).toBe(0)
    expect(await flagsOfRoles()).toEqual(expected)

    const altered = await freshDatabase()
    await asSuperuser("postgres", async (client) => {
      for (const role of roles) await client.query(`alter role ${role} superuser nologin createdb createrole`)
    })
    expect(await flagsOfRoles()).toEqual(
      expected.map((flags) => ({
        ...flags,
        rolcanlogin: false,
        rolsuper: true,
        rolcreatedb: true,
        rolcreaterole: true,
      })),
    )
    expect((await run(environmentOf(altered.urls))).code).toBe(0)
    expect(await flagsOfRoles()).toEqual(expected)
  })

  it("prints one line when the connection is lost", async () => {
    const { urls, database, secrets } = await freshDatabase()
    const uncaught: unknown[] = []
    const record = (error: unknown): void => {
      uncaught.push(error)
    }
    process.on("uncaughtException", record)
    const holder = await openClient(superUrl(database))
    const watcher = await openClient(superUrl("postgres"))
    try {
      await holder.query("begin")
      await holder.query("create schema session")
      const running = run(environmentOf(urls))
      const started = Date.now()
      let waiting = false
      while (!waiting) {
        const found = await watcher.query(
          "select pid from pg_stat_activity where application_name = 'api-setup' and wait_event_type = 'Lock'",
        )
        waiting = found.rows.length > 0
        if (!waiting && Date.now() - started > 5000) throw new Error("the setup did not wait")
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20))
      }
      await watcher.query("select pg_terminate_backend(pid) from pg_stat_activity where application_name = 'api-setup'")
      const outcome = await running
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(uncaught).toEqual([])
      expect(outcome.code).toBe(1)
      expect(outcome.stdout).toEqual([])
      expect(outcome.stderr).toHaveLength(1)
      expect(outcome.stderr[0]).toMatch(/^setup: failed \w+$/)
      expectNoSecrets(outcome, secrets)
    } finally {
      process.off("uncaughtException", record)
      await holder.end()
      await watcher.end()
    }
  })
})
