import type { Client } from "pg"

import type { Migration } from "./migration.js"
import { migrations } from "./migrations.js"

export type { Migration }
export { migrations }

export const migrationLock = 720481136

export type Applied = { readonly applied: number; readonly at: number }

async function underLock<T>(db: Client, work: () => Promise<T>): Promise<T> {
  await db.query("begin")
  try {
    await db.query("select pg_advisory_xact_lock($1)", [migrationLock])
    const result = await work()
    await db.query("commit")
    return result
  } catch (error) {
    await db.query("rollback").catch(() => undefined)
    throw error
  }
}

async function prepareRecord(db: Client): Promise<void> {
  const found = await db.query<{ recorded: boolean; built: boolean }>(
    `select to_regclass('setup.migration') is not null as recorded,
      exists (select 1 from pg_namespace where nspname = 'session') as built`,
  )
  if (found.rows[0]?.recorded === true) return
  await db.query(`
    create schema if not exists setup;
    create table setup.migration (
      id integer primary key,
      applied timestamptz not null default now()
    );
  `)
  if (found.rows[0]?.built === true) await db.query("insert into setup.migration (id) values (1)")
}

async function applyMigration(db: Client, migration: Migration): Promise<boolean> {
  const found = await db.query("select 1 from setup.migration where id = $1", [migration.id])
  if (found.rowCount !== 0) return false
  await db.query(migration.sql)
  await db.query("insert into setup.migration (id) values ($1)", [migration.id])
  return true
}

export async function applySchema(db: Client, list: readonly Migration[] = migrations): Promise<Applied> {
  await underLock(db, () => prepareRecord(db))
  let applied = 0
  for (const migration of list) {
    if (await underLock(db, () => applyMigration(db, migration))) applied += 1
  }
  const counted = await db.query<{ at: number }>("select count(*)::integer as at from setup.migration")
  return { applied, at: counted.rows[0]?.at ?? 0 }
}
