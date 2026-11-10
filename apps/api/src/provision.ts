import { Client } from "pg"

import { applySchema } from "./schema.js"

type DatabaseUrls = {
  readonly admin: string
  readonly session: string
  readonly deck: string
  readonly listen: string
}

type Provisioned = "created" | "kept"

export type Environment = Readonly<Record<string, string | undefined>>

export type Write = (stream: "stdout" | "stderr", line: string) => void

const variables = {
  admin: "ADMIN_DATABASE_URL",
  session: "SESSION_DATABASE_URL",
  deck: "DECK_DATABASE_URL",
  listen: "LISTEN_DATABASE_URL",
} as const

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

async function provisionDatabase(urls: DatabaseUrls): Promise<Provisioned> {
  const passwords = [
    ["session", passwordIn(urls.session)],
    ["deck", passwordIn(urls.deck)],
    ["listen", passwordIn(urls.listen)],
  ] as const
  const admin = new Client({ connectionString: urls.admin, application_name: "api-setup" })
  admin.on("error", () => undefined)
  await admin.connect()
  try {
    await admin.query("begin")
    for (const [role, password] of passwords) await createRole(admin, role, password)
    const found = await admin.query<{ present: boolean }>(
      "select exists (select 1 from pg_namespace where nspname = 'session') as present",
    )
    const created = found.rows[0]?.present !== true
    if (created) await applySchema(admin)
    await admin.query("commit")
    return created ? "created" : "kept"
  } catch (error) {
    await admin.query("rollback").catch(() => undefined)
    throw error
  } finally {
    await admin.end().catch(() => undefined)
  }
}

export async function runSetup(env: Environment, write: Write): Promise<number> {
  const missing = Object.values(variables).filter((name) => (env[name] ?? "").length === 0)
  if (missing.length > 0) {
    write("stderr", missing.join(" "))
    return 1
  }
  const urls: DatabaseUrls = {
    admin: env[variables.admin] ?? "",
    session: env[variables.session] ?? "",
    deck: env[variables.deck] ?? "",
    listen: env[variables.listen] ?? "",
  }
  const unusable = (["session", "deck", "listen"] as const).filter((role) => passwordIn(urls[role]).length === 0)
  if (unusable.length > 0) {
    write("stderr", `${unusable.map((role) => variables[role]).join(" ")} has no password`)
    return 1
  }
  try {
    const result = await provisionDatabase(urls)
    write("stdout", `setup: roles 3, schema ${result}`)
    return 0
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "error"
    write("stderr", `setup: failed ${code}`)
    return 1
  }
}
