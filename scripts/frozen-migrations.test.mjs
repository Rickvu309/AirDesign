import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defaultFrozenMigrationsFile, readFrozenMigrations } from "../apps/api/src/frozen-migrations.ts"
import { migrations, runFrozenMigrations } from "./frozen-migrations.mjs"

const scriptPath = fileURLToPath(new URL("./frozen-migrations.mjs", import.meta.url))

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const throws = (name, fn, pattern) => {
  let caught
  try {
    fn()
  } catch (error) {
    caught = error
  }
  if (!caught || !pattern.test(caught.message)) {
    throw new Error(`${name}: expected ${pattern}, got ${caught ? caught.message : "no error"}`)
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-frozen-migrations-"))
try {
  const copy = path.join(root, "frozen-migrations.json")
  fs.copyFileSync(fileURLToPath(defaultFrozenMigrationsFile), copy)

  throws(
    "rejects flags such as --update",
    () => runFrozenMigrations(["--update"], migrations, copy),
    /^usage: node scripts\/frozen-migrations\.mjs/,
  )

  same(
    "reports zero appended when nothing is new",
    runFrozenMigrations([], migrations, copy),
    `frozen-migrations: 0 appended, ${migrations.length} recorded`,
  )

  const eighth = { id: migrations.length + 1, sql: "\ncreate index saved_deleted on deck.saved (deleted);\n" }
  same(
    "appends migration 8 and reports the new total",
    runFrozenMigrations([], [...migrations, eighth], copy),
    `frozen-migrations: 1 appended, ${migrations.length + 1} recorded`,
  )
  same("recorded list now includes migration 8", readFrozenMigrations(copy).length, migrations.length + 1)

  const saved = fs.readFileSync(copy, "utf8")
  const edited = migrations.map((migration) => (migration.id === 3 ? { id: 3, sql: `${migration.sql} ` } : migration))
  throws(
    "refuses to rewrite an edited migration",
    () => runFrozenMigrations([], [...edited, eighth], copy),
    /A shipped migration must not be edited/,
  )
  same("keeps the file untouched when refusing", fs.readFileSync(copy, "utf8"), saved)

  const cliOk = spawnSync(process.execPath, [scriptPath], { encoding: "utf8" })
  same("cli exits zero when migrations match", cliOk.status, 0)
  same("cli prints recorded count", cliOk.stdout.trim(), `frozen-migrations: 0 appended, ${migrations.length} recorded`)

  const cliFlag = spawnSync(process.execPath, [scriptPath, "--update"], { encoding: "utf8" })
  same("cli exits non-zero when given flags", cliFlag.status, 1)
  same("cli prints usage on stderr", cliFlag.stderr.includes("usage: node scripts/frozen-migrations.mjs"), true)
  console.log("frozen-migrations tests passed")
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
