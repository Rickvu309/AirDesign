import { Client } from "pg"

import { applySchema } from "./schema.js"

export type DatabaseUrls = {
  readonly admin: string
  readonly session: string
  readonly deck: string
  readonly listen: string
}

export type Provisioned = "created" | "kept"

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
  return decodeURIComponent(new URL(url).password)
}

export async function provisionDatabase(urls: DatabaseUrls): Promise<Provisioned> {
  const passwords = [
    ["session", passwordIn(urls.session)],
    ["deck", passwordIn(urls.deck)],
    ["listen", passwordIn(urls.listen)],
  ] as const
  const admin = new Client({ connectionString: urls.admin, application_name: "api-setup" })
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
