import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"

import type { Migration } from "./migration.js"

export type FrozenMigration = { readonly id: number; readonly sha256: string }

export const defaultFrozenMigrationsFile = new URL("./frozen-migrations.json", import.meta.url)

export function hashMigrationSql(sql: string): string {
  return createHash("sha256").update(sql).digest("hex")
}

export function readFrozenMigrations(file: string | URL = defaultFrozenMigrationsFile): FrozenMigration[] {
  return JSON.parse(readFileSync(file, "utf8")) as FrozenMigration[]
}

export function appendFrozenMigrations(
  current: readonly Migration[],
  recorded: readonly FrozenMigration[],
): FrozenMigration[] {
  const nextId = Math.max(recorded.length, current.length) + 1
  for (const [index, entry] of recorded.entries()) {
    const expectedId = index + 1
    if (entry.id !== expectedId) {
      throw new Error(
        `Recorded migration at position ${String(expectedId)} has id ${String(entry.id)}; expected id ${String(expectedId)}.`,
      )
    }
    const migration = current[index]
    if (migration === undefined || migration.id !== entry.id) {
      throw new Error(
        `Migration ${String(entry.id)} is recorded in apps/api/src/platform/frozen-migrations.json and missing from apps/api/src/platform/migrations.ts. ` +
          `A shipped migration must not be edited or removed; add a new migration with the next id (${String(nextId)}) instead.`,
      )
    }
    if (hashMigrationSql(migration.sql) !== entry.sha256) {
      throw new Error(
        `Migration ${String(entry.id)} sql differs from its recorded sha256 in apps/api/src/platform/frozen-migrations.json. ` +
          `A shipped migration must not be edited, including whitespace or formatting, because the exact sql string is hashed; ` +
          `add a new migration with the next id (${String(nextId)}) instead, then run node scripts/frozen-migrations.mjs to record it.`,
      )
    }
  }
  const added: FrozenMigration[] = []
  for (const [offset, migration] of current.slice(recorded.length).entries()) {
    const expectedId = recorded.length + offset + 1
    if (migration.id !== expectedId) {
      throw new Error(
        `Migration at position ${String(expectedId)} has id ${String(migration.id)}; expected id ${String(expectedId)}.`,
      )
    }
    added.push({ id: migration.id, sha256: hashMigrationSql(migration.sql) })
  }
  return [...recorded, ...added]
}

export function checkFrozenMigrations(
  current: readonly Migration[],
  recorded: readonly FrozenMigration[] = readFrozenMigrations(),
): void {
  appendFrozenMigrations(current, recorded)
  if (current.length > recorded.length) {
    throw new Error(
      `Migration ${String(recorded.length + 1)} is not recorded in apps/api/src/platform/frozen-migrations.json yet. ` +
        `Run node scripts/frozen-migrations.mjs to append it.`,
    )
  }
}

export function recordFrozenMigrations(
  current: readonly Migration[],
  file: string | URL = defaultFrozenMigrationsFile,
): { readonly appended: number; readonly total: number } {
  const recorded = readFrozenMigrations(file)
  const next = appendFrozenMigrations(current, recorded)
  const appended = next.length - recorded.length
  if (appended > 0) writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`)
  return { appended, total: next.length }
}
