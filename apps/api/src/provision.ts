import { Client } from "pg"

import { applySchema } from "./schema.js"

type BootstrapUrls = {
  readonly admin: string
  readonly session: string
  readonly deck: string
  readonly listen: string
  readonly migrator: string
}

export type Environment = Readonly<Record<string, string | undefined>>

export type Write = (stream: "stdout" | "stderr", line: string) => void

const variables = {
  admin: "ADMIN_DATABASE_URL",
  session: "SESSION_DATABASE_URL",
  deck: "DECK_DATABASE_URL",
  listen: "LISTEN_DATABASE_URL",
  migrator: "MIGRATOR_DATABASE_URL",
} as const

const loginRoles = ["session", "deck", "listen", "migrator"] as const

const migratorSchemas = ["session", "deck", "setup"]

export async function createRole(admin: Client, role: string, password: string): Promise<void> {
  const built = await admin.query<{ statement: string }>(
    `select format(
      case when exists (select 1 from pg_roles where rolname = $1::text)
        then 'alter role %I login password %L nosuperuser nocreatedb nocreaterole'
        else 'create role %I login password %L nosuperuser nocreatedb nocreaterole'
      end, $1::text, $2::text) as statement`,
    [role, password],
  )
  const statement = built.rows[0]?.statement
  if (statement === undefined) throw new Error("role")
  await admin.query(statement)
}

function passwordIn(url: string): string {
  try {
    return decodeURIComponent(new URL(url).password)
  } catch {
    return ""
  }
}

function codeOf(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "error"
}

async function refuseHalfBuilt(admin: Client): Promise<void> {
  const found = await admin.query("select 1 from pg_namespace where nspname in ('session', 'deck')")
  if (found.rowCount === 1) throw Object.assign(new Error("schema"), { code: "42P06" })
}

async function handToMigrator(admin: Client): Promise<void> {
  const built = await admin.query<{ statement: string }>(
    `select format('alter schema %I owner to migrator', nspname) as statement
      from pg_namespace where nspname = any($1::text[])
    union all
    select format('alter table %I.%I owner to migrator', nspname, relname)
      from pg_class join pg_namespace on pg_namespace.oid = relnamespace
      where nspname = any($1::text[]) and relkind = 'r'
    union all
    select format('grant create on database %I to migrator', current_database())`,
    [migratorSchemas],
  )
  for (const { statement } of built.rows) await admin.query(statement)
}

async function bootstrapDatabase(urls: BootstrapUrls): Promise<void> {
  const admin = new Client({ connectionString: urls.admin, application_name: "api-bootstrap" })
  admin.on("error", () => undefined)
  await admin.connect()
  try {
    await admin.query("begin")
    await refuseHalfBuilt(admin)
    for (const role of loginRoles) await createRole(admin, role, passwordIn(urls[role]))
    await handToMigrator(admin)
    await admin.query("commit")
  } catch (error) {
    await admin.query("rollback").catch(() => undefined)
    throw error
  } finally {
    await admin.end().catch(() => undefined)
  }
}

export async function runBootstrap(env: Environment, write: Write): Promise<number> {
  const missing = Object.values(variables).filter((name) => (env[name] ?? "").length === 0)
  if (missing.length > 0) {
    write("stderr", missing.join(" "))
    return 1
  }
  const urls: BootstrapUrls = {
    admin: env[variables.admin] ?? "",
    session: env[variables.session] ?? "",
    deck: env[variables.deck] ?? "",
    listen: env[variables.listen] ?? "",
    migrator: env[variables.migrator] ?? "",
  }
  const unusable = loginRoles.filter((role) => passwordIn(urls[role]).length === 0)
  if (unusable.length > 0) {
    write("stderr", `${unusable.map((role) => variables[role]).join(" ")} has no password`)
    return 1
  }
  try {
    await bootstrapDatabase(urls)
    write("stdout", `bootstrap: roles ${String(loginRoles.length)}`)
    return 0
  } catch (error) {
    write("stderr", `bootstrap: failed ${codeOf(error)}`)
    return 1
  }
}

export async function runSetup(env: Environment, write: Write): Promise<number> {
  const url = env[variables.migrator] ?? ""
  if (url.length === 0) {
    write("stderr", variables.migrator)
    return 1
  }
  const migrator = new Client({ connectionString: url, application_name: "api-setup" })
  migrator.on("error", () => undefined)
  try {
    await migrator.connect()
    const { applied, at } = await applySchema(migrator)
    write("stdout", `setup: roles 3, migrations ${String(applied)} applied, now at ${String(at)}`)
    return 0
  } catch (error) {
    write("stderr", `setup: failed ${codeOf(error)}`)
    return 1
  } finally {
    await migrator.end().catch(() => undefined)
  }
}
