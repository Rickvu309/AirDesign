import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { watch } from "node:fs"
import { mkdir, readFile, writeFile, appendFile, readdir, rm } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { startServer } from "../../server/src/main.ts"
import { OperationStore, operationId } from "../../../packages/operations/src/index.ts"
import { hash } from "../../../packages/pptx/src/index.ts"
import { probePptx } from "../../../packages/pptx/test/probe.ts"
import { deliver } from "../src/isolation.ts"

const root = path.resolve(process.argv[2] ?? path.join(os.homedir(),"tmp/airdesign-autopilot/P03"))
const state = path.join(root,"private-state")
const database = path.join(state,"operations.sqlite")
const temporary = path.join(state,"jobs")
const origin = "http://127.0.0.1:41873"
await rm(state,{ recursive: true, force: true })
await mkdir(temporary,{ recursive: true, mode: 0o700 })
process.env.AIRDESIGN_EXPOSE_INBOX = "1"
const environment = { ...process.env, AIRDESIGN_OPERATIONS_PATH: database, AIRDESIGN_WORKER_TEMP: temporary }
async function run(args: string[], directory: string, name: string, expected = 0): Promise<string> {
  const started = performance.now()
  const child = spawn(args[0] ?? "node",args.slice(1),{ env: environment, stdio: ["ignore","pipe","pipe"] })
  let stdout = ""
  let stderr = ""
  child.stdout.on("data",(bytes: Buffer) => { stdout += bytes.toString() })
  child.stderr.on("data",(bytes: Buffer) => { stderr += bytes.toString() })
  const exit = await new Promise<number | null>((resolve,reject) => { child.once("error",reject); child.once("exit",resolve) })
  await writeFile(path.join(directory,`${name}.stdout`),stdout)
  await writeFile(path.join(directory,`${name}.stderr`),stderr)
  await appendFile(path.join(directory,"terminal.txt"),`$ ${args.join(" ")}\n${stdout}${stderr}exit=${exit} elapsedMs=${performance.now()-started}\n`)
  assert.equal(exit,expected,`${name}: ${stderr.slice(-2000)}`)
  return stdout
}
function object(value: unknown): Record<string,unknown> { assert.ok(value && typeof value === "object" && !Array.isArray(value)); return Object.fromEntries(Object.entries(value)) }
function json(value: string): Record<string,unknown> { return object(JSON.parse(value)) }
const head = (await run(["git","rev-parse","HEAD"],root,"head")).trim()
const fixture = path.resolve("fixtures/pptx/preservation.pptx")
const fixtureBytes = await readFile(fixture)
const fixtureSha = hash(fixtureBytes)
const options = { publicOrigin: origin, operationsPath: database, accessPath: path.join(state,"access") }
let server = await startServer(41873,options)
const ownerCookie = path.join(state,"owner.cookie")
const otherCookie = path.join(state,"other.cookie")
async function api(route: string, cookie: string, body?: unknown) {
  const response = await fetch(origin+route,{ method: body === undefined ? "GET" : "POST", headers: { cookie, origin, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "error" })
  return { status: response.status, body: await response.json(), cookies: response.headers.getSetCookie() }
}
async function login(email: string, file: string) {
  const intent = object((await api("/api/access/intent","",{ kind: "import" })).body)
  await api("/api/access/email","",{ email, intent: intent.token })
  const messages = object((await api(`/api/dev/inbox?to=${encodeURIComponent(email)}`,"")).body).messages
  assert.ok(Array.isArray(messages) && messages[0])
  const verified = await api("/api/access/code","",{ email, intent: intent.token, code: object(messages[0]).code })
  assert.equal(verified.status,200)
  const cookie = verified.cookies.map(value => value.split(";")[0]).join("; ")
  assert.ok(cookie.includes("="))
  await writeFile(file,cookie,{ mode: 0o600 })
  return cookie
}
try {
  const cookie = await login("owner@p03.example",ownerCookie)
  await login("other@p03.example",otherCookie)
  const receipts: Record<string,unknown>[] = []
  for (let lane = 1; lane <= 10; lane++) {
    const directory = path.join(root,`lane-${lane}`)
    await mkdir(directory,{ recursive: true })
    await writeFile(path.join(directory,"terminal.txt"),`head=${head}\n`)
    const cli = async (command: string, argument: string, extra?: string, ownerFile = ownerCookie, expected = 0) => json(await run(["node","apps/server/src/operations/cli.ts",command,origin,ownerFile,argument,...(extra ? [extra] : [])],directory,command+(ownerFile === otherCookie ? "-other" : ""),expected))
    const submit = async (file = fixture, key = `lane-${lane}`) => {
      const started = performance.now()
      const response = await cli("submit",file,key)
      assert.equal(response.status,202)
      const job = object(response.body)
      assert.equal(job.kind,"queued")
      assert.equal(typeof job.id,"string")
      return { id: String(job.id), submitProcessMs: performance.now()-started, intendedSha256: hash(await readFile(file)) }
    }
    const worker = () => run(["node","apps/worker/src/main.ts"],directory,"worker")
    const status = async (id: string) => object((await cli("status",id)).body)
    let operation: Record<string,unknown>
    if ([1,2,3,4,5,6].includes(lane)) {
      const job = await submit()
      if (lane === 1) {
        await server.close()
        server = await startServer(41873,options)
        assert.equal((await status(job.id)).kind,"queued")
      }
      if (lane === 3) {
        const started = new Promise<void>((resolve,reject) => {
          const watcher = watch(temporary,{ recursive: true },(_event,name) => {
            if (name?.toString().endsWith("input.pptx")) { watcher.close(); crashed.kill("SIGKILL"); resolve() }
          })
          watcher.once("error",reject)
          const crashed = spawn("node",["apps/worker/src/main.ts"],{ env: environment, stdio: "ignore" })
          crashed.once("error",reject)
          crashed.once("exit",code => { watcher.close(); if (code !== null) reject(new Error("worker-finished-before-crash")) })
        })
        await started
      }
      if (lane === 4) {
        assert.equal(object((await cli("cancel",job.id)).body).kind,"cancelled")
        await worker()
        assert.equal((await status(job.id)).kind,"cancelled")
        assert.equal((await cli("artifact",job.id,path.join(directory,"refused.pptx"),ownerCookie,1)).status,410)
        operation = { ...job, cancelTerminal: true, futureArtifactAbsent: true }
      } else if (lane === 5) {
        const aged = new OperationStore(database,() => Date.now()-8*86_400_000)
        try { assert.equal(await deliver(aged,operationId(job.id),temporary,path.resolve("apps/worker/src/import.ts")),true) } finally { aged.close() }
        const expired = await status(job.id)
        assert.equal(expired.kind,"expired")
        assert.equal(expired.recovery,"submit-again")
        assert.equal((await cli("artifact",job.id,path.join(directory,"refused.pptx"),ownerCookie,1)).status,410)
        operation = { ...job, status: expired, expiryClock: "worker completion clock injected eight days earlier; real authenticated API clock" }
      } else {
        await worker()
        const ready = await status(job.id)
        assert.equal(ready.kind,"ready")
        assert.equal(object(ready.report).sourceSha256,fixtureSha)
        if (lane === 2) {
          const duplicate = object((await cli("submit",fixture,`lane-${lane}`)).body)
          assert.deepEqual(duplicate,ready)
          await worker()
          assert.deepEqual(await status(job.id),ready)
        }
        if (lane === 3) assert.equal(ready.attempts,2)
        if (lane === 6) for (const command of ["status","artifact","cancel"]) assert.equal((await cli(command,job.id,command === "artifact" ? path.join(directory,"forbidden.pptx") : undefined,otherCookie,1)).status,404)
        const resultPath = path.join(directory,"artifact.pptx")
        assert.equal((await cli("artifact",job.id,resultPath)).status,200)
        assert.equal(hash(await readFile(resultPath)),ready.sha256)
        operation = { ...job, status: ready, immutableReceipt: true, artifactSha256: ready.sha256 }
      }
    } else if ([7,8].includes(lane)) {
      const job = await submit(path.resolve("fixtures/pptx",lane === 7 ? "hostile-expansion.pptx" : "hostile-dtd.pptx"))
      await worker()
      const failed = await status(job.id)
      assert.equal(failed.kind,"failed")
      assert.match(String(failed.reason),lane === 7 ? /expansion-limit/ : /xml-dtd-forbidden/)
      operation = { ...job, status: failed }
    } else if (lane === 9) {
      const redirectResponses = []
      for (const url of ["http://127.0.0.1/redirect","http://169.254.169.254/latest","http://10.0.0.1/redirect","https://public.example/redirect-private"]) {
        const response = await api("/api/operations",cookie,{ requestId: "redirect", url })
        assert.equal(response.status,400)
        redirectResponses.push({ url, status: response.status, body: response.body })
      }
      await writeFile(path.join(directory,"redirect-responses.json"),JSON.stringify(redirectResponses,null,2))
      operation = { redirects: "no URLs admitted; no request or redirect followed", responses: redirectResponses }
    } else {
      const probes = []
      for (const mode of ["network","oom"]) {
        const file = path.join(state,`${mode}.pptx`)
        const payload = Buffer.concat([Buffer.from([80,75,3,4]),Buffer.from(mode)])
        await writeFile(file,payload)
        const job = await submit(file,mode)
        const diagnostic = new OperationStore(database)
        try { await deliver(diagnostic,operationId(job.id),temporary,path.resolve("apps/worker/test/fixtures/probe.ts")) } finally { diagnostic.close() }
        const result = await status(job.id)
        assert.equal(result.kind,mode === "oom" ? "failed" : "ready")
        if (mode === "network") {
          const report = object(result.report)
          assert.equal(report.probe,"network")
          assert.ok(Array.isArray(report.network) && report.network.length === 4)
          for (const destination of report.network) assert.notEqual(object(destination).result,"connected")
          assert.match(String(report.limits),/Max cpu time\s+25/)
        }
        probes.push({ ...job, diagnosticProgram: "apps/worker/test/fixtures/probe.ts; internal test adapter, not a public selectable worker", status: result })
      }
      const font = await submit(path.resolve("fixtures/pptx/hostile-font.pptx"),"font")
      await worker()
      const fontStatus = await status(font.id)
      assert.equal(fontStatus.kind,"failed")
      assert.match(String(fontStatus.reason),/hostile-font/)
      const next = await submit(fixture,"after-oom")
      await worker()
      assert.equal((await status(next.id)).kind,"ready")
      operation = { probes, hostileFont: fontStatus, nextJobReady: next.id }
    }
    assert.deepEqual(await readdir(temporary),[])
    const pptx = await probePptx(lane,directory,async (args,name) => {
      const output = await run(["node","packages/pptx/src/cli.ts",...args],directory,name)
      const report = json(output)
      await writeFile(path.join(directory,`${name}.json`),JSON.stringify(report,null,2))
      return report
    })
    const receipt = { head, lane, verdict: [3,5].includes(lane) && (!Array.isArray(pptx.libreOffice) || pptx.libreOffice.some(result => object(result).status !== "passed")) ? "unavailable-fast-render" : "passed-local", operation, tempCleanup: true, pptx }
    await writeFile(path.join(directory,lane === 1 ? "comparison.json" : "receipt.json"),JSON.stringify(receipt,null,2))
    receipts.push(receipt)
    process.stdout.write(JSON.stringify({ lane, verdict: receipt.verdict, fixture: pptx.inputSha256 })+"\n")
  }
  const perf = path.join(root,"perf")
  await mkdir(perf,{ recursive: true })
  const samples = []
  for (let index = 0; index < 23; index++) {
    let bootMs: number | null = null
    if (index < 3) {
      await server.close()
      const boot = performance.now()
      server = await startServer(41873,options)
      bootMs = performance.now()-boot
    }
    const started = performance.now()
    const response = await api("/api/operations",cookie,{ requestId: `perf-${index}`, base64: fixtureBytes.toString("base64") })
    const ackMs = performance.now()-started
    assert.equal(response.status,202)
    const job = object(response.body)
    assert.equal(job.kind,"queued")
    assert.ok(ackMs <= 1000)
    samples.push({ trial: index < 3 ? "cold-api-restart" : "warm", inputSha256: fixtureSha, bytes: fixtureBytes.length, id: String(job.id), ackMs, bootMs })
  }
  const workerStarted = performance.now()
  await run(["node","apps/worker/src/main.ts"],perf,"worker")
  const batchWallMs = performance.now()-workerStarted
  for (const sample of samples) {
    const response = await api(`/api/operations/${sample.id}`,cookie)
    const ready = object(response.body)
    assert.equal(ready.kind,"ready")
    const report = object(ready.report)
    assert.equal(report.sourceSha256,fixtureSha)
    const metrics = object(report.workerMetrics)
    assert.ok(Number(metrics.wallMs) < 30000 && Number(metrics.peakRssBytes) <= 536870912 && Number(metrics.expandedBytes) <= 524288000 && Number(metrics.parts) <= 10000)
    Object.assign(sample,{ endState: "ready", sha256: ready.sha256, metrics })
  }
  const trunk = await run(["git","show","fada744f773f6d6ea8444904e1618916c903087a:package.json"],perf,"trunk-package")
  assert.ok(!trunk.includes('"verify:operations"') && !trunk.includes('"verify:pptx"'))
  await writeFile(path.join(perf,"baseline.json"),JSON.stringify({ trunk: "fada744f773f6d6ea8444904e1618916c903087a", comparableFeature: "absent", evidence: "trunk-package.stdout; operation and PPTX CLI scripts absent", relativeComparison: "not-applicable" },null,2))
  await writeFile(path.join(perf,"samples.json"),JSON.stringify({ head, fixtureSha, samples, batchWallMs },null,2))
  await writeFile(path.join(perf,"verdict.json"),JSON.stringify({ head, verdict: "passed-absolute", samples: samples.length, warm: 20, cold: 3, maxAckMs: Math.max(...samples.map(sample => sample.ackMs)), operationAckBudgetMs: 1000, workerBudgetMs: 30000, memoryBudgetBytes: 536870912, comparison: "trunk feature absent; no relative p95 claim", workload: "two-slide fixture; every operation source digest and ready state asserted; worker metrics per sample" },null,2))
  await writeFile(path.join(root,"lanes.json"),JSON.stringify({ head, receipts: receipts.map(receipt => ({ lane: receipt.lane, verdict: receipt.verdict })) },null,2))
} finally {
  await server.close()
  await rm(state,{ recursive: true, force: true })
}
