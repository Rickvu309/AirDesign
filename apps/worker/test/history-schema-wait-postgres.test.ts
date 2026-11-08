import { spawn } from "node:child_process"
import { once } from "node:events"
import { randomBytes } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import pg from "pg"
import { expect, it } from "vitest"
import { createHistoryStore,historySchemaVersion } from "../../server/src/db/history-store.ts"

it("waits for web to migrate an unversioned production schema, then finishes its cycle without crashing", async () => {
  const database = `airdesign_schema_wait_${randomBytes(6).toString("hex")}`
  const host = process.env.AIRDESIGN_PG_HOST ?? "/home/quan/.local/pg/sock", user = process.env.AIRDESIGN_PG_USER ?? "quan"
  const url = `postgresql://${user}@/${database}?host=${host}`
  const admin = new pg.Client({ host, user, database: "postgres" })
  const folder = await mkdtemp(path.join(os.homedir(), "tmp/schema-wait-worker-"))
  await admin.connect()
  await admin.query(`CREATE DATABASE ${database}`)
  const sql = new pg.Client({ connectionString: url })
  await sql.connect()
  try {
    await (await createHistoryStore({ kind: "postgres", url, schema: "migrate" })).close()
    await sql.query("DROP TABLE schema_version")
    const worker = spawn(process.execPath, ["apps/worker/src/main.ts"], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, AIRDESIGN_DATABASE_URL: url, AIRDESIGN_OPERATIONS_PATH: path.join(folder, "operations.sqlite"), AIRDESIGN_WORKER_TEMP: path.join(folder, "jobs") } })
    const exited = once(worker, "exit")
    let stderr = ""
    const waiting = new Promise<void>(resolve => worker.stderr.on("data", chunk => { stderr += String(chunk); if (stderr.includes("history-schema-waiting")) resolve() }))
    await Promise.race([waiting, exited.then(() => { throw new Error(`worker exited before waiting: ${stderr}`) })])
    await (await createHistoryStore({ kind: "postgres", url, schema: "migrate" })).close()
    const [code] = await exited
    const waits = stderr.split("\n").filter(line => line.includes("history-schema-waiting")).map(line => JSON.parse(line))
    expect(code, stderr).toBe(0)
    expect(waits[0]).toMatchObject({ event: "history-schema-waiting", expected: historySchemaVersion, found: 0, attempt: 1 })
    expect(waits.every(wait => wait.retryInMs >= 125 && wait.retryInMs <= 15_000)).toBe(true)
    expect(stderr).not.toContain("history-schema-outdated")
    expect((await sql.query("SELECT version FROM schema_version WHERE name='history'")).rows).toEqual([{ version: historySchemaVersion }])
  } finally {
    await sql.end()
    await admin.query(`DROP DATABASE ${database} WITH (FORCE)`)
    await admin.end()
    await rm(folder, { recursive: true, force: true })
  }
}, 60_000)
