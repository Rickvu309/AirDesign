import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { accessPolicy, createAccess, createMemoryInbox, type Access, type MemoryInbox } from "../src/index.ts"

let now = 1_700_000_000_000
let access: Access
let inbox: MemoryInbox
const secret = "test-secret-that-is-at-least-32"

beforeAll(async () => {
  inbox = createMemoryInbox()
  access = await createAccess({
    driver: { kind: "pglite" },
    secret,
    mail: inbox,
    clock: () => now,
    guard: { allow: () => true },
    exposeInbox: false,
  })
})

afterAll(async () => {
  await access.close()
})

describe("access", () => {
  it("refuses a postgres driver without a url", async () => {
    await expect(createAccess({
      driver: { kind: "postgres", url: " " },
      secret,
      mail: inbox,
      clock: () => now,
      guard: { allow: () => true },
      exposeInbox: false,
    })).rejects.toThrow("postgres-url-missing")
  })

  it("keeps email responses non-enumerating and creates the account on verify", async () => {
    const first = client()
    const issued = await first.call("/api/access/intent", { kind: "new-deck" })
    const known = await first.call("/api/access/email", { email: "Ada@Example.com", intent: issued.json.token })
    await first.call("/api/access/code", { email: "ada@example.com", code: inbox.read("ada@example.com")[0]?.code, intent: issued.json.token })
    const second = client()
    const issuedAgain = await second.call("/api/access/intent", { kind: "home" })
    const unknown = await second.call("/api/access/email", { email: "new-person@example.com", intent: issuedAgain.json.token })
    expect(known.json.status).toBe("check-email")
    expect(unknown.json.status).toBe("check-email")
    expect(known.json).not.toHaveProperty("exists")
    expect(unknown.json).not.toHaveProperty("exists")
    expect(inbox.read("ada@example.com")).toHaveLength(1)
    expect(inbox.read("new-person@example.com")).toHaveLength(1)
  })

  it("rejects an open return target", async () => {
    const jar = client()
    const rejected = await jar.call("/api/access/intent", { kind: "home", returnTo: "https://evil.example" })
    expect(rejected.status).toBe(400)
    expect(rejected.json.status).toBe("intent-rejected")
  })

  it("stays on the check screen for a wrong code and signs in with the same intent", async () => {
    const jar = client()
    const issued = await jar.call("/api/access/intent", { kind: "import" })
    await jar.call("/api/access/email", { email: "code@example.com", intent: issued.json.token })
    const message = inbox.read("code@example.com")[0]
    const wrong = await jar.call("/api/access/code", { email: "code@example.com", code: "000000", intent: issued.json.token })
    const session = await jar.call("/api/session", undefined, "GET")
    expect(wrong.json).toMatchObject({ status: "invalid-code", screen: "S22.01" })
    expect(session.json.status).toBe("signed-out")
    const right = await jar.call("/api/access/code", { email: "code@example.com", code: message?.code, intent: issued.json.token })
    expect(right.json).toMatchObject({ status: "signed-in", intentToken: issued.json.token, kind: "import" })
    const signedIn = await jar.call("/api/session", undefined, "GET")
    expect(signedIn.json.status).toBe("signed-in")
    expect(signedIn.json.email).toBe("code@example.com")
    expect(signedIn.json.displayName).toBe("code")
  })

  it("uses a link once and refuses a replay", async () => {
    const jar = client()
    const issued = await jar.call("/api/access/intent", { kind: "connect-agent" })
    await jar.call("/api/access/email", { email: "link@example.com", intent: issued.json.token })
    const message = inbox.read("link@example.com")[0]
    const first = await jar.call("/api/access/consume-link", { token: message?.linkToken })
    const replay = client()
    const second = await replay.call("/api/access/consume-link", { token: message?.linkToken })
    expect(first.json).toMatchObject({ status: "signed-in", intentToken: issued.json.token, kind: "connect-agent" })
    expect(second.json.status).toBe("link-used")
    expect(await replay.call("/api/session", undefined, "GET")).toMatchObject({ json: { status: "signed-out" } })
  })

  it("refuses an expired link and keeps the signed intent", async () => {
    const jar = client()
    const issued = await jar.call("/api/access/intent", { kind: "new-deck" })
    await jar.call("/api/access/email", { email: "expired@example.com", intent: issued.json.token })
    const message = inbox.read("expired@example.com")[0]
    now += accessPolicy.linkTtlMs + 1
    const expired = await jar.call("/api/access/consume-link", { token: message?.linkToken })
    expect(expired.json).toMatchObject({
      status: "link-expired",
      screen: "S29.01",
      intentToken: issued.json.token,
      kind: "new-deck",
    })
    expect(await jar.call("/api/session", undefined, "GET")).toMatchObject({ json: { status: "signed-out" } })
  })

  it("replaces the previous code only after the resend wait", async () => {
    const jar = client()
    const issued = await jar.call("/api/access/intent", { kind: "home" })
    await jar.call("/api/access/email", { email: "resend@example.com", intent: issued.json.token })
    const firstCode = inbox.read("resend@example.com")[0]?.code
    await jar.call("/api/access/email", { email: "resend@example.com", intent: issued.json.token })
    expect(inbox.read("resend@example.com")).toHaveLength(1)
    now += accessPolicy.resendWaitMs
    await jar.call("/api/access/email", { email: "resend@example.com", intent: issued.json.token })
    const messages = inbox.read("resend@example.com")
    expect(messages).toHaveLength(2)
    const stale = await jar.call("/api/access/code", { email: "resend@example.com", code: firstCode, intent: issued.json.token })
    const fresh = await jar.call("/api/access/code", { email: "resend@example.com", code: messages[1]?.code, intent: issued.json.token })
    expect(stale.json.status).toBe("invalid-code")
    expect(fresh.json.status).toBe("signed-in")
  })

  it("locks a challenge after five wrong codes and allows a later resend", async () => {
    const jar = client()
    const issued = await jar.call("/api/access/intent", { kind: "home" })
    await jar.call("/api/access/email", { email: "lock@example.com", intent: issued.json.token })
    const message = inbox.read("lock@example.com")[0]
    for (let attempt = 0; attempt < accessPolicy.attemptLimit; attempt += 1) {
      const failed = await jar.call("/api/access/code", { email: "lock@example.com", code: "111111", intent: issued.json.token })
      expect(failed.json.status).toBe("invalid-code")
    }
    const locked = await jar.call("/api/access/code", { email: "lock@example.com", code: message?.code, intent: issued.json.token })
    expect(locked.json.status).toBe("invalid-code")
    expect(await jar.call("/api/session", undefined, "GET")).toMatchObject({ json: { status: "signed-out" } })
    now += accessPolicy.resendWaitMs
    await jar.call("/api/access/email", { email: "lock@example.com", intent: issued.json.token })
    const next = inbox.read("lock@example.com").at(-1)
    const signedIn = await jar.call("/api/access/code", { email: "lock@example.com", code: next?.code, intent: issued.json.token })
    expect(signedIn.json.status).toBe("signed-in")
  })

  it("fails protected calls after revocation", async () => {
    const jar = client()
    await signIn(jar, "revoke@example.com")
    expect((await jar.call("/api/account", undefined, "GET")).json.status).toBe("signed-in")
    await jar.call("/api/session/revoke", {})
    expect((await jar.call("/api/account", undefined, "GET")).json.status).toBe("signed-out")
    expect((await jar.call("/api/session", undefined, "GET")).json.status).toBe("signed-out")
  })

  it("hides another person's record and skips the write", async () => {
    const owner = client()
    const other = client()
    const ownerId = await signIn(owner, "owner@example.com")
    const otherId = await signIn(other, "other@example.com")
    const hidden = await other.call(`/api/people/${ownerId}`, undefined, "GET")
    const write = await other.call(`/api/people/${ownerId}/profile`, { displayName: "Stolen" })
    const unchanged = await owner.call("/api/account", undefined, "GET")
    expect(hidden.status).toBe(404)
    expect(write.status).toBe(404)
    expect(unchanged.json.displayName).toBe("owner")
    expect(ownerId).not.toBe(otherId)
  })

  it("returns a clear entry for a different email without the previous account", async () => {
    const jar = client()
    const first = await jar.call("/api/access/intent", { kind: "home" })
    const started = await jar.call("/api/access/email", { email: "first@example.com", intent: first.json.token })
    const second = await jar.call("/api/access/intent", { kind: "home" })
    const changed = await jar.call("/api/access/email", { email: "second@example.com", intent: second.json.token })
    expect(started.json.status).toBe("check-email")
    expect(changed.json.status).toBe("check-email")
    expect(JSON.stringify(changed.json)).not.toContain("first@example.com")
  })

  it("keeps the free week on the email tombstone", async () => {
    const jar = client()
    await signIn(jar, "week@example.com")
    const account = await jar.call("/api/account", undefined, "GET")
    const refused = await jar.call("/api/account/deletion", { confirm: "nope" })
    expect(refused.json.status).toBe("confirmation-required")
    expect((await jar.call("/api/account", undefined, "GET")).json.status).toBe("signed-in")
    await jar.call("/api/account/deletion", { confirm: "delete-account" })
    const blocked = await jar.call("/api/account/provider-deletion", {})
    expect(blocked.json).toMatchObject({ status: "blocked", gate: "X06" })
    now += accessPolicy.resendWaitMs
    const again = client()
    await signIn(again, "week@example.com")
    const second = await again.call("/api/account", undefined, "GET")
    expect(second.json.freeUsageWeekStartedAt).toBe(account.json.freeUsageWeekStartedAt)
  })

  it("does not send mail when the guard refuses", async () => {
    const guardedInbox = createMemoryInbox()
    const guarded = await createAccess({
      driver: { kind: "pglite" },
      secret,
      mail: guardedInbox,
      clock: () => now,
      guard: { allow: () => false },
      exposeInbox: false,
    })
    const issued = await guarded.handle(new Request("http://127.0.0.1/api/access/intent", {
      method: "POST",
      body: JSON.stringify({ kind: "home" }),
    }))
    const token = (await issued.json() as { token: string }).token
    const email = await guarded.handle(new Request("http://127.0.0.1/api/access/email", {
      method: "POST",
      body: JSON.stringify({ email: "guard@example.com", intent: token }),
    }))
    expect((await email.json() as { status: string }).status).toBe("guard-rejected")
    expect(guardedInbox.read("guard@example.com")).toHaveLength(0)
    await guarded.close()
  })
})

function client() {
  let cookie = ""
  return {
    async call(path: string, body?: Record<string, unknown>, method: "GET" | "POST" = "POST") {
      const init: RequestInit = { method, headers: { "content-type": "application/json", cookie } }
      if (method !== "GET") {
        init.body = JSON.stringify(body ?? {})
      }
      const response = await access.handle(new Request(`http://127.0.0.1${path}`, init))
      const set = response.headers.getSetCookie()
      const last = set.at(-1)
      if (last) {
        cookie = last.split(";")[0] ?? cookie
      }
      return { status: response.status, json: await response.json() as Record<string, unknown> }
    },
  }
}

async function signIn(jar: ReturnType<typeof client>, email: string): Promise<string> {
  const issued = await jar.call("/api/access/intent", { kind: "home" })
  await jar.call("/api/access/email", { email, intent: issued.json.token })
  const message = inbox.read(email).at(-1)
  const signed = await jar.call("/api/access/code", { email, code: message?.code, intent: issued.json.token })
  return String(signed.json.personId)
}
