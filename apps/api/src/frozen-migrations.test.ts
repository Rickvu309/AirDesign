import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import {
  checkFrozenMigrations,
  defaultFrozenMigrationsFile,
  hashMigrationSql,
  readFrozenMigrations,
  recordFrozenMigrations,
} from "./frozen-migrations.js"
import type { Migration } from "./migration.js"
import { migrations } from "./migrations.js"

const tempFolders: string[] = []

function tempRecordCopy(contents = readFileSync(defaultFrozenMigrationsFile, "utf8")): string {
  const folder = mkdtempSync(path.join(tmpdir(), "frozen-migrations-"))
  tempFolders.push(folder)
  const file = path.join(folder, "frozen-migrations.json")
  writeFileSync(file, contents)
  return file
}

afterEach(() => {
  for (const folder of tempFolders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

describe("frozen migrations", () => {
  it("keeps every shipped migration in migrations.ts matching its recorded sha256", () => {
    const recorded = readFrozenMigrations()
    expect(recorded.map((entry) => entry.id)).toEqual(migrations.map((migration) => migration.id))
    expect(() => checkFrozenMigrations(migrations)).not.toThrow()
  })

  it("fails when the sql of migration 3 is edited, including whitespace, and points to migration 8", () => {
    const nextId = migrations.length + 1
    const expectedMessage =
      `Migration 3 sql differs from its recorded sha256 in apps/api/src/frozen-migrations.json. ` +
      `A shipped migration must not be edited, including whitespace or formatting, because the exact sql string is hashed; ` +
      `add a new migration with the next id (${String(nextId)}) instead, then run node scripts/frozen-migrations.mjs to record it.`

    const editedStatement = migrations.map((migration) =>
      migration.id === 3
        ? { id: 3, sql: `${migration.sql}create index saved_deleted on deck.saved (deleted);\n` }
        : migration,
    )
    expect(() => checkFrozenMigrations(editedStatement)).toThrow(expectedMessage)

    const editedWhitespace = migrations.map((migration) =>
      migration.id === 3 ? { id: 3, sql: `${migration.sql} ` } : migration,
    )
    expect(() => checkFrozenMigrations(editedWhitespace)).toThrow(expectedMessage)
  })

  it("fails when migration 8 is appended without recording and names the recording command", () => {
    const eighth: Migration = {
      id: migrations.length + 1,
      sql: "\ncreate index saved_deleted on deck.saved (deleted);\n",
    }
    expect(() => checkFrozenMigrations([...migrations, eighth])).toThrow(
      `Migration ${String(eighth.id)} is not recorded in apps/api/src/frozen-migrations.json yet. ` +
        `Run node scripts/frozen-migrations.mjs to append it.`,
    )
  })

  it("appends migration 8 in the recording step and then passes the check", () => {
    const file = tempRecordCopy()
    const before = readFrozenMigrations(file)
    const eighth: Migration = {
      id: migrations.length + 1,
      sql: "\ncreate index saved_deleted on deck.saved (deleted);\n",
    }
    const withEighth = [...migrations, eighth]

    expect(recordFrozenMigrations(withEighth, file)).toEqual({ appended: 1, total: withEighth.length })

    const after = readFrozenMigrations(file)
    expect(after.slice(0, before.length)).toEqual(before)
    expect(after[before.length]).toEqual({ id: eighth.id, sha256: hashMigrationSql(eighth.sql) })
    expect(() => checkFrozenMigrations(withEighth, after)).not.toThrow()

    const savedText = `${readFileSync(file, "utf8")}\n`
    writeFileSync(file, savedText)
    expect(recordFrozenMigrations(withEighth, file)).toEqual({ appended: 0, total: withEighth.length })
    expect(readFileSync(file, "utf8")).toBe(savedText)
    expect(recordFrozenMigrations(migrations)).toEqual({ appended: 0, total: migrations.length })
  })

  it("refuses to rewrite a recorded hash in the recording step", () => {
    const file = tempRecordCopy()
    const originalText = readFileSync(file, "utf8")
    const eighth: Migration = {
      id: migrations.length + 1,
      sql: "\ncreate index saved_deleted on deck.saved (deleted);\n",
    }
    const editedThirdAndAppended = [
      ...migrations.map((migration) =>
        migration.id === 3 ? { id: 3, sql: `${migration.sql}select 1;\n` } : migration,
      ),
      eighth,
    ]

    expect(() => recordFrozenMigrations(editedThirdAndAppended, file)).toThrow(
      `Migration 3 sql differs from its recorded sha256 in apps/api/src/frozen-migrations.json. ` +
        `A shipped migration must not be edited, including whitespace or formatting, because the exact sql string is hashed; ` +
        `add a new migration with the next id (${String(eighth.id + 1)}) instead, then run node scripts/frozen-migrations.mjs to record it.`,
    )
    expect(readFileSync(file, "utf8")).toBe(originalText)

    const tamperedEntries = readFrozenMigrations(file).map((entry) =>
      entry.id === 3 ? { id: 3, sha256: "0".repeat(64) } : entry,
    )
    const tamperedJson = `${JSON.stringify(tamperedEntries, null, 2)}\n`
    const tamperedFile = tempRecordCopy(tamperedJson)
    expect(() => recordFrozenMigrations(migrations, tamperedFile)).toThrow(
      /Migration 3 sql differs from its recorded sha256/,
    )
    expect(readFileSync(tamperedFile, "utf8")).toBe(tamperedJson)
  })

  it("rejects removed migrations and non-consecutive ids in both the check and the recording step", () => {
    const file = tempRecordCopy()
    const originalText = readFileSync(file, "utf8")

    expect(() => checkFrozenMigrations(migrations.slice(0, -1))).toThrow(
      `Migration ${String(migrations.length)} is recorded in apps/api/src/frozen-migrations.json and missing from apps/api/src/migrations.ts. ` +
        `A shipped migration must not be edited or removed; add a new migration with the next id (${String(migrations.length + 1)}) instead.`,
    )

    const renumberedThird = migrations.map((migration) =>
      migration.id === 3 ? { id: 99, sql: migration.sql } : migration,
    )
    expect(() => checkFrozenMigrations(renumberedThird)).toThrow(
      `Migration 3 is recorded in apps/api/src/frozen-migrations.json and missing from apps/api/src/migrations.ts.`,
    )

    const eighth: Migration = { id: migrations.length + 1, sql: "\nselect 1;\n" }
    const gappedNew: Migration = { id: migrations.length + 3, sql: "\nselect 2;\n" }
    expect(() => recordFrozenMigrations([...migrations, eighth, gappedNew], file)).toThrow(
      `Migration at position ${String(migrations.length + 2)} has id ${String(migrations.length + 3)}; expected id ${String(migrations.length + 2)}.`,
    )
    expect(readFileSync(file, "utf8")).toBe(originalText)

    expect(() =>
      checkFrozenMigrations(migrations, [{ id: 2, sha256: hashMigrationSql(migrations[0]?.sql ?? "") }]),
    ).toThrow("Recorded migration at position 1 has id 2; expected id 1.")
  })
})
