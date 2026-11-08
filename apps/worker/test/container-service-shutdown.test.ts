import { spawn, type ChildProcess } from "node:child_process"
import { once } from "node:events"
import { createServer } from "node:http"
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { randomBytes, randomUUID } from "node:crypto"
import os from "node:os"
import path from "node:path"
import pg from "pg"
import { expect, it } from "vitest"
import { createHistoryStore } from "../../server/src/db/history-store.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { processIdentity } from "../src/container-job-processes.ts"
import { waitForStartedPids } from "./fixtures/started-pids.ts"

it.each([["schema", "container", "SIGTERM"], ["schema", "systemd", "SIGINT"], ["exports", "container", "SIGTERM"]] as const)("stops during %s in %s on %s without new work or surviving processes", async (scenario, isolation, signal) => {
  const database = `airdesign_shutdown_${randomBytes(6).toString("hex")}`
  const host = process.env.AIRDESIGN_PG_HOST ?? "/home/quan/.local/pg/sock", user = process.env.AIRDESIGN_PG_USER ?? "quan"
  const url = `postgresql://${user}@/${database}?host=${host}`
  const admin = new pg.Client({ host, user, database: "postgres" })
  const folder = await mkdtemp(path.join(os.homedir(), "tmp/service-shutdown-"))
  const api = createServer((request, response) => { request.resume(); request.on("end", () => { response.setHeader("content-type", "application/json"); response.end("null") }) })
  let worker: ChildProcess | undefined
  let pids: number[] = []
  await admin.connect()
  await admin.query(`CREATE DATABASE ${database}`)
  const sql = new pg.Client({ connectionString: url })
  await sql.connect()
  try {
    await (await createHistoryStore({ kind: "postgres", url, schema: "migrate" })).close()
    api.listen(0, "127.0.0.1")
    await once(api, "listening")
    const address = api.address()
    if (!address || typeof address === "string") throw new Error("missing-api-address")
    const shadow = path.join(folder, "shadow")
    await mkdir(path.join(shadow, "apps/worker"), { recursive: true })
    await cp("apps/worker/src", path.join(shadow, "apps/worker/src"), { recursive: true })
    for (const [target, source] of [["apps/worker/dist", "apps/worker/dist"], ["apps/server", "apps/server"], ["packages", "packages"], ["node_modules", "node_modules"]] satisfies [string, string][]) await symlink(path.resolve(source), path.join(shadow, target))
    await writeFile(path.join(shadow, "package.json"), JSON.stringify({ type: "module" }))
    const marker = path.join(folder, "started")
    if (scenario === "schema") {
      await sql.query("DROP TABLE schema_version")
      await sql.query("CREATE TABLE ddl_audit(command text)")
      await sql.query("CREATE FUNCTION record_ddl() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO ddl_audit VALUES (TG_TAG); END $$")
      await sql.query("CREATE EVENT TRIGGER shutdown_ddl ON ddl_command_start EXECUTE FUNCTION record_ddl()")
    } else {
      const history = await createHistoryStore({ kind: "postgres", url, schema: "connect" })
      try {
        const principal = { personId: "shutdown-test" }
        const deck = await history.catalog.create(principal, randomUUID(), "Shutdown", "", fixtureDeck(1, 2))
        for (let count = 0; count < 2; count++) await history.exports.submit(principal, randomUUID(), deck.id, { format: "pdf", timing: "now", slides: [], expectedSeq: 0, allowIssues: true })
      } finally { await history.close() }
      await writeFile(path.join(shadow, "apps/worker/src/export/entry.ts"), `import {spawn} from "node:child_process";import {appendFileSync} from "node:fs";const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{detached:true,stdio:"ignore"});child.unref();appendFileSync(${JSON.stringify(marker)},JSON.stringify([process.pid,child.pid])+"\\n");setInterval(()=>{},1000)`)
    }
    let diagnostic = ""
    let ready: () => void = () => undefined
    const started = new Promise<void>(resolve => { ready = resolve })
    worker = spawn(process.execPath, ["apps/worker/src/service.ts"], { cwd: shadow, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, DATABASE_URL: url, AIRDESIGN_DATABASE_URL: url, AIRDESIGN_ISOLATION: isolation, AIRDESIGN_SECRET: "shutdown-secret-at-least-32-characters", AIRDESIGN_WORKER_API_ORIGIN: `http://127.0.0.1:${address.port}`, AIRDESIGN_OPERATIONS_PATH: path.join(folder, "operations.sqlite"), AIRDESIGN_WORKER_TEMP: path.join(folder, "jobs") } })
    const exited = once(worker, "exit")
    let output = ""
    worker.stdout?.on("data", chunk => { output += String(chunk) })
    worker.stderr?.on("data", chunk => { diagnostic += String(chunk); if (scenario === "schema" && diagnostic.includes("history-schema-waiting")) ready() })
    const timeout = AbortSignal.timeout(12_000)
    const reading = new AbortController()
    try {
      pids = await Promise.race([scenario === "exports" ? waitForStartedPids(marker, AbortSignal.any([timeout, reading.signal])) : started.then(() => []), exited.then(() => { throw new Error(`worker-exited-before-ready:${diagnostic}`) }), once(timeout, "abort").then(() => { throw new Error(`worker-ready-timeout:${diagnostic}`) })])
    } finally { reading.abort() }
    const stopped = performance.now()
    worker.kill(signal)
    const result = await Promise.race([exited, once(AbortSignal.timeout(2500), "abort").then(() => null)])
    expect(result, diagnostic).toEqual([0, null])
    const events = output.split("\n").filter(line => line.includes("worker-shutdown-")).map(line => JSON.parse(line))
    expect(events, output).toContainEqual(expect.objectContaining({ event: "worker-shutdown-started", signal }))
    expect(events, output).toContainEqual(expect.objectContaining({ event: "worker-shutdown-complete" }))
    expect(performance.now() - stopped).toBeLessThan(2500)
    expect(diagnostic).not.toContain("HistorySchemaOutdated")
    expect(diagnostic).not.toContain("history-schema-outdated")
    if (scenario === "schema") expect((await sql.query("SELECT * FROM ddl_audit")).rows).toEqual([])
    else {
      expect(pids.every(pid => processIdentity(pid) === null)).toBe(true)
      const rows = (await sql.query("SELECT state,attempts,lease FROM deck_export ORDER BY attempts DESC")).rows
      expect(rows[1]).toMatchObject({ state: "queued", attempts: 0, lease: null })
      expect(rows[0]).toMatchObject({ state: "failed", attempts: 1, lease: null })
      const history = await createHistoryStore({ kind: "postgres", url, schema: "connect" })
      try {
        const first = (await sql.query("SELECT id FROM deck_export WHERE attempts=1")).rows[0]
        expect(await history.exports.retry({ personId: "shutdown-test" }, first.id)).toMatchObject({ kind: "queued" })
      } finally { await history.close() }
      expect((await readFile(marker, "utf8")).trim().split("\n")).toHaveLength(1)
    }
  } finally {
    if (worker && worker.exitCode === null && worker.signalCode === null) {
      worker.kill("SIGKILL")
      await once(worker, "exit")
    }
    for (const pid of pids) if (processIdentity(pid)) try { process.kill(pid, "SIGKILL") } catch {}
    api.closeAllConnections()
    await new Promise<void>(resolve => api.close(() => resolve()))
    await sql.end()
    await admin.query(`DROP DATABASE ${database} WITH (FORCE)`)
    await admin.end()
    await rm(folder, { recursive: true, force: true })
  }
}, 25_000)
