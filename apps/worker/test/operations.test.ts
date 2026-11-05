import { createServer, request as httpRequest } from "node:http"
import { readRequestBody, RequestBodyLimit } from "../../../packages/files/src/request-body.ts"
import { afterEach, expect, it } from "vitest"
import { mkdtemp, rm, readdir, readFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { OperationStore } from "../../../packages/operations/src/index.ts"
import { createAccess, createMemoryInbox } from "@airdesign/access"
import { operationsHandler } from "../../server/src/operations/handle.ts"
import { randomBytes } from "node:crypto"
import { readArchive, writeArchive } from "../../../packages/pptx/src/archive.ts"
import { deliver } from "../src/isolation.ts"
import { requireLocalUpload, rejectActiveSvg, inspectFont, fileLimits } from "../../../packages/files/src/index.ts"

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })
async function storage(clock = Date.now) {
  const root = await mkdtemp(path.join(os.homedir(), "tmp/p03-operations-"))
  const filename = path.join(root, "jobs.sqlite")
  const store = new OperationStore(filename, clock)
  cleanups.push(async () => { store.close(); await rm(root, { recursive: true, force: true }) })
  return { store, root, filename }
}
const input = Buffer.from([80,75,3,4,0])
const owner = { personId: "owner-a" }
const other = { personId: "owner-b" }
it("converges parallel submissions, claims, cancellation and repeated delivery", async () => {
  const { store } = await storage()
  const jobs = await Promise.all(Array.from({ length: 12 }, async () => store.submit(owner, "same", input)))
  expect(new Set(jobs.map(job => job.id)).size).toBe(1)
  const job = jobs[0]
  if (!job) throw new Error("missing-job")
  expect(() => store.submit(owner, "same", Buffer.from("different"))).toThrow("conflict")
  const claims = await Promise.all(Array.from({ length: 12 }, async () => store.claim(job.id)))
  const winners = claims.filter(claim => claim !== null)
  expect(winners).toHaveLength(1)
  const claim = winners[0]
  if (!claim) throw new Error("missing-claim")
  await Promise.all(Array.from({ length: 12 }, async () => store.cancel(owner, job.id)))
  expect(store.complete(job.id, claim.lease, input)).toBe(false)
  expect(store.status(owner, job.id).kind).toBe("cancelled")
})
it("persists restart, retries at most three times, expires after seven days and refuses all foreign paths", async () => {
  let now = Date.now()
  const { store, filename } = await storage(() => now)
  const job = store.submit(owner, "restart", input)
  const second = new OperationStore(filename, () => now)
  for (let attempt = 0; attempt < 3; attempt++) {
    expect(second.claim(job.id)).not.toBeNull()
    now += 35_001
    const recovered = second.recover()
    expect(recovered.map(recovered => recovered.id)).toEqual([job.id])
    for (const item of recovered) second.acknowledgeCleanup(item.id, item.lease)
  }
  expect(store.status(owner, job.id).kind).toBe("failed")
  for (const method of [() => store.status(other, job.id), () => store.cancel(other, job.id), () => store.artifact(other, job.id)]) expect(method).toThrow("not-found")
  const ready = store.submit(owner, "ready", input)
  const claim = store.claim(ready.id)
  if (!claim) throw new Error("missing-claim")
  expect(store.complete(ready.id, claim.lease, input)).toBe(true)
  expect(store.complete(ready.id, claim.lease, Buffer.from("overwrite"))).toBe(false)
  now += 6 * 86_400_000
  expect(store.artifact(owner, ready.id)).toEqual(input)
  now += 86_400_001
  expect(store.status(owner, ready.id)).toMatchObject({ kind: "expired", recovery: "submit-again" })
  expect(() => store.artifact(owner, ready.id)).toThrow("expired")
  second.close()
})
it("recovers a cancelled lease once when its worker cannot finish cleanup", async () => {
  const { store } = await storage()
  const job = store.submit(owner,"cancelled-crash",input)
  const claim = store.claim(job.id)
  if (!claim) throw new Error("missing-claim")
  store.cancel(owner,job.id)
  expect(store.recover()).toEqual([{ id: job.id, lease: claim.lease, ownerDirectory: claim.ownerDirectory }])
  store.acknowledgeCleanup(job.id, claim.lease)
  expect(store.recover()).toEqual([])
  expect(store.status(owner,job.id).kind).toBe("cancelled")
  expect(store.complete(job.id,claim.lease,input)).toBe(false)
})
it("uses real P01 sessions with origin checks and cross-owner denial on submit, poll, cancel, artifact", async () => {
  const { store } = await storage()
  const inbox = createMemoryInbox()
  const access = await createAccess({ driver: { kind: "pglite" }, secret: "p03-test-secret-at-least-thirty-two", clock: Date.now, mail: inbox, guard: { allow: () => true }, exposeInbox: false })
  cleanups.push(() => access.close())
  async function login(email: string) {
    const call = (route: string, body: unknown) => access.handle(new Request(`http://localhost${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))
    const intent = await (await call("/api/access/intent", { kind: "import" })).json()
    await call("/api/access/email", { email, intent: intent.token })
    const response = await call("/api/access/code", { email, intent: intent.token, code: inbox.read(email)[0]?.code })
    expect(response.status).toBe(200)
    return response.headers.getSetCookie().map(cookie => cookie.split(";")[0]).join("; ")
  }
  const a = await login("a@p03.example")
  const b = await login("b@p03.example")
  const handle = operationsHandler(access, store, "http://localhost")
  const call = (route: string, cookie: string, body?: unknown, origin = "http://localhost") => handle(new Request(`http://localhost/api/operations${route}`, { method: body === undefined ? "GET" : "POST", headers: { cookie, origin, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }))
  expect((await call("", "", { base64: input.toString("base64"), requestId: "first" })).status).toBe(401)
  expect((await call("", a, {}, "http://evil.example")).status).toBe(403)
  const parts = await readArchive(await readFile("fixtures/pptx/preservation.pptx"))
  parts.set("ppt/media/large.bin", randomBytes(9 * 1024 * 1024))
  const large = await writeArchive(parts)
  expect(large.length).toBeGreaterThan(8.5 * 1024 * 1024)
  expect((await call("", a, { base64: large.toString("base64"), requestId: "large-valid" })).status).toBe(202)
  const boundary = Buffer.alloc(fileLimits.compressed)
  input.copy(boundary)
  expect((await call("", a, { base64: boundary.toString("base64"), requestId: "boundary" })).status).toBe(202)
  expect((await call("", a, { base64: Buffer.concat([boundary, Buffer.alloc(1)]).toString("base64"), requestId: "over-boundary" })).status).toBe(400)
  const response = await call("", a, { base64: input.toString("base64"), requestId: "first" })
  expect(response.status).toBe(202)
  const job = await response.json()
  expect((await call(`/${job.id}`, a)).status).toBe(200)
  for (const [route, body] of [[`/${job.id}`, undefined], [`/${job.id}/artifact`, undefined], [`/${job.id}/cancel`, {}]]) expect((await call(String(route), b, body)).status).toBe(404)
})
it("rejects URL/path uploads, active SVG and hostile fonts before any external access", () => {
  for (const value of [{ url: "http://169.254.169.254" }, { path: "/etc/passwd" }, { base64: input.toString("base64"), url: "https://public.example/redirect" }]) expect(() => requireLocalUpload(value)).toThrow()
  expect(() => rejectActiveSvg('<svg><script>x</script></svg>')).toThrow("unsafe-svg")
  expect(() => inspectFont(Buffer.alloc(2))).toThrow("hostile-font")
})
it("delivers inside enforced cgroup and network namespace, then reclaims the temporary payload", async () => {
  const { store, root } = await storage()
  const job = store.submit(owner, "isolated", input)
  expect(await deliver(store, job.id, root, path.resolve("apps/worker/test/fixtures/probe.ts"))).toBe(true)
  expect(store.artifact(owner, job.id)).toEqual(input)
  expect(await deliver(store, job.id, root, path.resolve("apps/worker/test/fixtures/probe.ts"))).toBe(false)
})

it("denies loopback, metadata, private and public egress and enforces CPU limits", async () => {
  const { store, root } = await storage()
  const payload = Buffer.concat([input.subarray(0,4), Buffer.from("network")])
  const job = store.submit(owner, "network", payload)
  expect(await deliver(store, job.id, root, path.resolve("apps/worker/test/fixtures/probe.ts"))).toBe(true)
  const status = store.status(owner, job.id)
  if (status.kind !== "ready") throw new Error("probe-not-ready")
  expect(status.report.limits).toMatch(/Max cpu time\s+25\s+25/)
  expect(status.report.network).toHaveLength(4)
  expect(JSON.stringify(status.report.network)).not.toContain('"result":"connected"')
  expect((await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory())).toEqual([])
})
it("contains an actual memory kill, cleans its lease and delivers the next owner job", async () => {
  const { store, root } = await storage()
  const job = store.submit(owner, "oom", Buffer.concat([input.subarray(0,4), Buffer.from("oom")]))
  expect(await deliver(store, job.id, root, path.resolve("apps/worker/test/fixtures/probe.ts"))).toBe(false)
  expect(store.status(owner, job.id).kind).toBe("failed")
  expect((await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory())).toEqual([])
  const next = store.submit(other, "after-oom", input)
  expect(await deliver(store, next.id, root, path.resolve("apps/worker/test/fixtures/probe.ts"))).toBe(true)
}, 15_000)
it("cancels a running isolated process and prevents late completion", async () => {
  const { store, root } = await storage()
  const job = store.submit(owner, "cancel-running", Buffer.concat([input.subarray(0,4), Buffer.from("hang")]))
  const delivery = deliver(store, job.id, root, path.resolve("apps/worker/test/fixtures/probe.ts"))
  expect(store.cancel(owner, job.id).kind).toBe("cancelled")
  expect(await delivery).toBe(false)
  expect(store.status(owner, job.id).kind).toBe("cancelled")
  expect((await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory())).toEqual([])
})
it("never lets cleanup from an obsolete lease remove replacement files", async () => {
  let now = Date.now()
  const { store, root } = await storage(() => now)
  const job = store.submit(owner, "lease-race", input)
  const first = deliver(store, job.id, root, path.resolve("apps/worker/test/fixtures/probe.ts"))
  now += 35_001
  expect(store.recover().map(value => value.id)).toEqual([job.id])
  expect(await deliver(store, job.id, root, path.resolve("apps/worker/test/fixtures/probe.ts"))).toBe(false)
  expect(await first).toBe(false)
  expect(await deliver(store, job.id, root, path.resolve("apps/worker/test/fixtures/probe.ts"))).toBe(true)
  expect(store.artifact(owner, job.id)).toEqual(input)
})

it("keeps the authenticated owner and queued job accessible after API storage restart", async () => {
  const { store, root } = await storage()
  const inbox = createMemoryInbox()
  const options = { driver: { kind: "pglite", dataDir: path.join(root,"nested","access") }, secret: "p03-restart-secret-at-least-thirty-two", clock: Date.now, mail: inbox, guard: { allow: () => true }, exposeInbox: false } satisfies Parameters<typeof createAccess>[0]
  let access = await createAccess(options)
  const post = (route: string, body: unknown) => access.handle(new Request(`http://localhost${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))
  const intent = await (await post("/api/access/intent",{ kind: "import" })).json()
  await post("/api/access/email",{ email: "restart@p03.example", intent: intent.token })
  const verified = await post("/api/access/code",{ email: "restart@p03.example", intent: intent.token, code: inbox.read("restart@p03.example")[0]?.code })
  const cookie = verified.headers.getSetCookie().map(value => value.split(";")[0]).join("; ")
  const request = new Request("http://localhost/api/operations",{ headers: { cookie } })
  const principal = await access.principal(request)
  if (!principal) throw new Error("session-required")
  const job = store.submit(principal,"api-restart",input)
  await access.close()
  access = await createAccess(options)
  try {
    const restored = await access.principal(request)
    expect(restored).toEqual(principal)
    if (!restored) throw new Error("restored-session-required")
    expect(store.status(restored,job.id).kind).toBe("queued")
  } finally { await access.close() }
})

it("bounds streamed HTTP bodies before collecting an oversized upload", async () => {
  const server = createServer((request,response) => {
    readRequestBody(request,10).then(bytes => { response.writeHead(200); response.end(String(bytes.length)) },error => { response.writeHead(error instanceof RequestBodyLimit ? 413 : 400); response.end("rejected") })
  })
  await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("server-address-required")
  try {
    const send = (chunks: string[]) => new Promise<number | undefined>((resolve,reject) => {
      const request = httpRequest({ hostname: "127.0.0.1", port: address.port, method: "POST" },response => { response.resume(); response.once("end",() => resolve(response.statusCode)) })
      request.once("error",reject)
      for (const chunk of chunks) request.write(chunk)
      request.end()
    })
    expect(await send(["12345","67890"])).toBe(200)
    expect(await send(["12345","678901"])).toBe(413)
  } finally { await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve())) }
})

it("reports the structured rejection reason from an isolated import worker", async () => {
  const { store, root } = await storage()
  const job = store.submit(owner,"expansion-report",await readFile("fixtures/pptx/hostile-expansion.pptx"))
  const jobs = path.join(root,"jobs")
  expect(await deliver(store,job.id,jobs,path.resolve("apps/worker/src/import.ts"))).toBe(false)
  expect(store.status(owner,job.id)).toMatchObject({ kind: "failed", reason: "zip-expansion-limit" })
  expect(await readdir(jobs)).toEqual([])
})

it("rejects decoded SVG URL and CSS escapes with a strict SVG allowlist", () => {
  for (const attributes of ['fill="u&#114;l(http://169.254.169.254/latest)"', 'fill="u\\72l(http://169.254.169.254/latest)"', 'style="fill: u\\000072 l(http://169.254.169.254/latest)"', 'unknown="value"']) {
    expect(() => rejectActiveSvg(`<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" ${attributes}/></svg>`)).toThrow("unsafe-svg")
  }
  expect(() => rejectActiveSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10" fill="&#35;fff" style="stroke: red; stroke-width: 2"/></svg>')).not.toThrow()
  for (const xml of ['<!DOCTYPE svg><svg/>', '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:expression(alert(1))"/></svg>']) expect(() => rejectActiveSvg(xml)).toThrow("unsafe-svg")
  for (const xml of [
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" style="fill: u&#114;l(http://169.254.169.254/latest)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>path { fill: url(http://169.254.169.254/latest) }</style><path d="M0 0"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use href="http://169.254.169.254/latest#a"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="http://169.254.169.254/latest#a"/></svg>',
  ]) expect(() => rejectActiveSvg(xml)).toThrow("unsafe-svg")
})
it("retains terminal cleanup obligations across crashes before removal", async () => {
  const { store, root, filename } = await storage()
  for (const terminal of ["ready", "failed", "cancelled"]) {
    const job = store.submit(owner, terminal, input)
    const claim = store.claim(job.id)
    if (!claim) throw new Error("claim-required")
    if (terminal === "ready") store.complete(job.id, claim.lease, input)
    if (terminal === "failed") store.fail(job.id, claim.lease, "test")
    if (terminal === "cancelled") store.cancel(owner, job.id)
    const directory = path.join(root, claim.ownerDirectory, job.id, claim.lease)
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, "input.pptx"), input)
    const restarted = new OperationStore(filename)
    const obligation = { id: job.id, lease: claim.lease, ownerDirectory: claim.ownerDirectory }
    expect(restarted.recover()).toContainEqual(obligation)
    expect(await readFile(path.join(directory, "input.pptx"))).toEqual(input)
    await rm(directory, { recursive: true, force: true })
    expect(restarted.recover()).toContainEqual(obligation)
    restarted.close()
    expect(store.recover()).toContainEqual(obligation)
    expect(store.recover()).toContainEqual(obligation)
    store.acknowledgeCleanup(job.id, claim.lease)
    expect(store.recover()).not.toContainEqual(obligation)
  }
})
it("retains recovery cleanup descriptors and prevents replacement before removal", async () => {
  let now = Date.now()
  const { store, root, filename } = await storage(() => now)
  const job = store.submit(owner, "recovery-crash", input)
  const claim = store.claim(job.id)
  if (!claim) throw new Error("claim-required")
  const directory = path.join(root, claim.ownerDirectory, job.id, claim.lease)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, "input.pptx"), input)
  now += 35_001
  const obligation = { id: job.id, lease: claim.lease, ownerDirectory: claim.ownerDirectory }
  expect(store.recover()).toEqual([obligation])
  expect(store.claim(job.id)).toBeNull()
  const restarted = new OperationStore(filename, () => now)
  expect(restarted.recover()).toEqual([obligation])
  expect(await readFile(path.join(directory, "input.pptx"))).toEqual(input)
  await rm(directory, { recursive: true, force: true })
  await rm(directory, { recursive: true, force: true })
  expect(restarted.recover()).toEqual([obligation])
  restarted.close()
  expect(store.recover()).toEqual([obligation])
  store.acknowledgeCleanup(job.id, claim.lease)
  expect(store.recover()).toEqual([])
  const replacement = store.claim(job.id)
  expect(replacement).not.toBeNull()
  store.acknowledgeCleanup(job.id, claim.lease)
  expect(store.active(job.id, replacement?.lease ?? "")).toBe(true)
})
