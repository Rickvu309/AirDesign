import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { performanceBudgets } from "../packages/contract-rules/src/budgets.ts"
import { createAccess, createMemoryInbox } from "../packages/access/src/index.ts"

const inbox = createMemoryInbox()
let now = 1_700_000_000_000
const access = await createAccess({
  driver: { kind: "pglite" },
  secret: "measure-secret-that-is-at-least-32",
  mail: inbox,
  clock: () => now,
  guard: { allow: () => true },
  exposeInbox: false,
})

const coldStarted = performance.now()
const issued = await call("/api/access/intent", { kind: "home" })
const coldMs = performance.now() - coldStarted
await call("/api/access/email", { email: "measure@example.com", intent: issued.token ?? "" })
const message = inbox.read("measure@example.com")[0]
const signed = await call("/api/access/code", { email: "measure@example.com", code: message?.code ?? "", intent: issued.token ?? "" })
if (signed.status !== "signed-in") {
  throw new Error("measure sign-in failed")
}
const cookie = signed.cookie
for (let warm = 0; warm < 3; warm += 1) {
  requireSignedIn(await call("/api/session", undefined, "GET", cookie))
}
const samples: number[] = []
for (let sample = 0; sample < 20; sample += 1) {
  const started = performance.now()
  const session = await call("/api/session", undefined, "GET", cookie)
  samples.push(performance.now() - started)
  requireSignedIn(session)
}
samples.sort((left, right) => left - right)
const p95 = samples[Math.ceil(samples.length * 0.95) - 1] ?? samples[samples.length - 1]
const evidence = {
  authColdMs: coldMs,
  authColdBudgetMs: performanceBudgets.authColdMs,
  authWarmP95Ms: p95,
  authWarmBudgetMs: performanceBudgets.authWarmP95Ms,
  samples,
  inboxDeliveryMs: inbox.lastDeliveryMs(),
  trunk: "absent",
}
if (coldMs > performanceBudgets.authColdMs || (p95 ?? 0) > performanceBudgets.authWarmP95Ms) {
  process.stderr.write(`${JSON.stringify(evidence)}\n`)
  await access.close()
  process.exit(1)
}
const directory = path.join(process.env.HOME ?? "", "tmp/airdesign-autopilot/P01/perf")
await mkdir(directory, { recursive: true })
await writeFile(path.join(directory, "w08-auth.json"), `${JSON.stringify(evidence, null, 2)}\n`)
await access.close()

function requireSignedIn(session: { httpStatus: number; status?: string }) {
  if (session.httpStatus !== 200 || session.status !== "signed-in") {
    throw new Error(`measured session read is not signed in: ${session.httpStatus} ${session.status ?? "none"}`)
  }
}

async function call(pathname: string, body?: Record<string, unknown>, method: "GET" | "POST" = "POST", cookie = "") {
  const init: RequestInit = { method, headers: { "content-type": "application/json", cookie } }
  if (method !== "GET") {
    init.body = JSON.stringify(body ?? {})
  }
  const response = await access.handle(new Request(`http://127.0.0.1${pathname}`, init))
  const json = await response.json() as { status?: string; token?: string }
  return { httpStatus: response.status, status: json.status, token: json.token, cookie: mergeCookies(cookie, response.headers.getSetCookie()) }
}

function mergeCookies(current: string, setCookies: readonly string[]) {
  const jar = new Map(current.split("; ").filter(Boolean).map((pair) => [pair.split("=")[0] ?? "", pair] as const))
  for (const header of setCookies) {
    const pair = header.split(";")[0] ?? ""
    jar.set(pair.split("=")[0] ?? "", pair)
  }
  return [...jar.values()].join("; ")
}
