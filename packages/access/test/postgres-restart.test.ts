import { randomBytes } from "node:crypto"
import { afterAll, describe, expect, it } from "vitest"
import pg from "pg"
import { accessPolicy, createAccess, createMemoryInbox, type Access } from "../src/index.ts"
import { applicationSchemaName } from "../src/schema.ts"

const secret = "test-secret-that-is-at-least-32"
const admin = { host: process.env.AIRDESIGN_PG_HOST ?? "/home/quan/.local/pg/sock", user: process.env.AIRDESIGN_PG_USER ?? "quan", database: "postgres" }

describe("postgres access", () => {
  const databaseName = `airdesign_p01_${randomBytes(4).toString("hex")}`
  const url = `postgresql://${admin.user}@/${databaseName}?host=${admin.host}`
  const opened: Access[] = []

  afterAll(async () => {
    for (const access of opened) {
      await access.close()
    }
    const client = new pg.Client(admin)
    await client.connect()
    await client.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`)
    await client.end()
  })

  it("keeps the person, profile, session and tombstone across restart", async () => {
    const creator = new pg.Client(admin)
    await creator.connect()
    await creator.query(`CREATE DATABASE ${databaseName}`)
    await creator.end()
    const inbox = createMemoryInbox()
    const now = 1_700_000_000_000
    const first = await open(url, inbox, now)
    const jar = cookieJar(first)
    const issued = await jar.call("/api/access/intent", { kind: "import" })
    await jar.call("/api/access/email", { email: "keep@example.com", intent: issued.json.token })
    const message = inbox.read("keep@example.com").at(-1)
    const signed = await jar.call("/api/access/code", { email: "keep@example.com", code: message?.code, intent: issued.json.token })
    const personId = String(signed.json.personId)
    const renamed = await jar.call(`/api/people/${personId}/profile`, { displayName: "Kept" })
    expect(renamed.status).toBe(200)
    const before = await jar.call("/api/account", undefined, "GET")
    await first.close()
    const schema = new pg.Client({ ...admin, database: databaseName })
    await schema.connect()
    const namespaces = await schema.query("SELECT nspname FROM pg_namespace WHERE nspname = $1", [applicationSchemaName])
    await schema.end()
    expect(namespaces.rows).toHaveLength(1)
    const second = await open(url, inbox, now)
    const resumed = cookieJar(second)
    resumed.cookie = jar.cookie
    const account = await resumed.call("/api/account", undefined, "GET")
    expect(account.json).toMatchObject({ status: "signed-in", personId, displayName: "Kept", kind: "import" })
    const removed = await resumed.call("/api/account/deletion", { confirm: "delete-account" })
    expect(removed.json.status).toBe("deleted")
    const hidden = await second.handle(new Request("http://127.0.0.1/api/dev/inbox?to=keep@example.com"))
    expect(hidden.status).toBe(404)
    await second.close()
    const freshInbox = createMemoryInbox()
    const later = now + accessPolicy.resendWaitMs + 1_000
    const fourth = await createAccess({
      driver: { kind: "postgres", url },
      secret,
      mail: freshInbox,
      clock: () => later,
      guard: { allow: () => true },
      exposeInbox: false,
      publicOrigin: "http://127.0.0.1:41732",
    })
    opened.push(fourth)
    const returning = cookieJar(fourth)
    const intent = await returning.call("/api/access/intent", { kind: "home" })
    await returning.call("/api/access/email", { email: "keep@example.com", intent: intent.json.token })
    const code = freshInbox.read("keep@example.com").at(-1)?.code
    await returning.call("/api/access/code", { email: "keep@example.com", code, intent: intent.json.token })
    const restored = await returning.call("/api/account", undefined, "GET")
    expect(restored.json.freeUsageWeekStartedAt).toBe(before.json.freeUsageWeekStartedAt)
  })

  async function open(databaseUrl: string, mail: ReturnType<typeof createMemoryInbox>, now: number): Promise<Access> {
    const access = await createAccess({
      driver: { kind: "postgres", url: databaseUrl },
      secret,
      mail,
      clock: () => now,
      guard: { allow: () => true },
      exposeInbox: false,
      publicOrigin: "http://127.0.0.1:41732",
    })
    opened.push(access)
    return access
  }
})

function cookieJar(access: Access) {
  const jar = {
    cookie: "",
    async call(path: string, body?: Record<string, unknown>, method: "GET" | "POST" = "POST") {
      const headers: Record<string, string> = { "content-type": "application/json" }
      if (jar.cookie) {
        headers.cookie = jar.cookie
      }
      const init: RequestInit = { method, headers }
      if (method !== "GET") {
        init.body = JSON.stringify(body ?? {})
      }
      const response = await access.handle(new Request(`http://127.0.0.1${path}`, init))
      const cookies = response.headers.getSetCookie()
      const map = new Map<string, string>()
      for (const part of jar.cookie.split(";")) {
        const trimmed = part.trim()
        const splitAt = trimmed.indexOf("=")
        if (splitAt > 0) {
          map.set(trimmed.slice(0, splitAt), trimmed.slice(splitAt + 1))
        }
      }
      for (const cookie of cookies) {
        const pair = cookie.split(";")[0] ?? ""
        const splitAt = pair.indexOf("=")
        if (splitAt > 0) {
          map.set(pair.slice(0, splitAt).trim(), pair.slice(splitAt + 1))
        }
      }
      jar.cookie = [...map.entries()].map(([name, value]) => `${name}=${value}`).join("; ")
      return { status: response.status, json: await response.json() as Record<string, unknown> }
    },
  }
  return jar
}
