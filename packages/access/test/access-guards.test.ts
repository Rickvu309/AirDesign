import { afterAll, describe, expect, it } from "vitest"
import { accessPolicy, createAccess, createMemoryInbox, type Access, type MemoryInbox } from "../src/index.ts"

const secret = "test-secret-that-is-at-least-32"
const origin = "http://127.0.0.1:41732"

describe("concurrent access", () => {
  const inbox = createMemoryInbox()
  let now = 1_700_000_000_000
  let access: Access

  afterAll(async () => {
    await access?.close()
  })

  it("lets one concurrent link or code claim the challenge", async () => {
    access = await createAccess({
      driver: { kind: "pglite" },
      secret,
      mail: inbox,
      clock: () => now,
      guard: { allow: () => true },
      exposeInbox: false,
      publicOrigin: origin,
    })
    const issued = await call(access, "/api/access/intent", { kind: "import" })
    const intent = String(issued.json.token)
    await call(access, "/api/access/email", { email: "race-link@example.com", intent })
    const linkToken = inbox.read("race-link@example.com").at(-1)?.linkToken ?? ""
    const linkRace = await Promise.all(Array.from({ length: 8 }, () => call(access, "/api/access/consume-link", { token: linkToken })))
    expect(linkRace.filter((item) => item.json.status === "signed-in")).toHaveLength(1)
    expect(linkRace.filter((item) => item.json.status === "link-used")).toHaveLength(7)
    expect(linkRace.filter((item) => item.cookies.some((cookie) => cookie.includes("session_token")))).toHaveLength(1)

    now += accessPolicy.resendWaitMs
    await call(access, "/api/access/email", { email: "race-both@example.com", intent })
    const both = inbox.read("race-both@example.com").at(-1)
    const overlap = await Promise.all([
      call(access, "/api/access/consume-link", { token: both?.linkToken }),
      call(access, "/api/access/code", { email: "race-both@example.com", code: both?.code, intent }),
    ])
    expect(overlap.filter((item) => item.json.status === "signed-in")).toHaveLength(1)
    expect(overlap.filter((item) => item.cookies.some((cookie) => cookie.includes("session_token")))).toHaveLength(1)
  })

  it("counts concurrent wrong codes and caps concurrent sends", async () => {
    const localInbox = createMemoryInbox()
    const local = await createAccess({
      driver: { kind: "pglite" },
      secret,
      mail: localInbox,
      clock: () => now,
      guard: { allow: () => true },
      exposeInbox: false,
      publicOrigin: origin,
    })
    const issued = await call(local, "/api/access/intent", { kind: "home" })
    const intent = String(issued.json.token)
    const firstSends = await Promise.all(Array.from({ length: 8 }, () => call(local, "/api/access/email", { email: "burst@example.com", intent })))
    expect(firstSends.every((item) => item.json.status === "check-email")).toBe(true)
    expect(localInbox.read("burst@example.com")).toHaveLength(1)
    const message = localInbox.read("burst@example.com")[0]
    const wrong = message?.code === "000000" ? "000001" : "000000"
    const guesses = await Promise.all(Array.from({ length: 12 }, () => call(local, "/api/access/code", { email: "burst@example.com", code: wrong, intent })))
    expect(guesses.every((item) => item.json.status === "invalid-code")).toBe(true)
    const right = await call(local, "/api/access/code", { email: "burst@example.com", code: message?.code, intent })
    expect(right.json.status).toBe("invalid-code")
    expect((await call(local, "/api/session", undefined, "GET")).json.status).toBe("signed-out")
    now += accessPolicy.resendWaitMs
    const resend = await Promise.all(Array.from({ length: 12 }, () => call(local, "/api/access/email", { email: "burst@example.com", intent })))
    expect(resend.every((item) => item.json.status === "check-email")).toBe(true)
    expect(localInbox.read("burst@example.com")).toHaveLength(2)
    for (let sent = 2; sent < accessPolicy.sendCapPerHour; sent += 1) {
      now += accessPolicy.resendWaitMs
      await call(local, "/api/access/email", { email: "burst@example.com", intent })
    }
    expect(localInbox.read("burst@example.com")).toHaveLength(accessPolicy.sendCapPerHour)
    now += accessPolicy.resendWaitMs
    await call(local, "/api/access/email", { email: "burst@example.com", intent })
    expect(localInbox.read("burst@example.com")).toHaveLength(accessPolicy.sendCapPerHour)
    await local.close()
  })
})

describe("mutation origin", () => {
  const inbox = createMemoryInbox()
  let now = 1_700_000_000_000
  let access: Access

  afterAll(async () => {
    await access?.close()
  })

  it("rejects a hostile origin and a simple content type on every mutation", async () => {
    access = await createAccess({
      driver: { kind: "pglite" },
      secret,
      mail: inbox,
      clock: () => now,
      guard: { allow: () => true },
      exposeInbox: false,
      publicOrigin: origin,
    })
    const jar = jarFor(access)
    const personId = await signIn(jar, inbox, "csrf@example.com", () => { now += accessPolicy.resendWaitMs })
    const hostile = { origin: "http://127.0.0.1:6666", "content-type": "text/plain" }
    const deleted = await jar.call("/api/account/deletion", { confirm: "delete-account" }, "POST", hostile)
    expect(deleted.status).toBe(415)
    expect((await jar.call("/api/account", undefined, "GET")).json.status).toBe("signed-in")
    const jsonHostile = { origin: "http://127.0.0.1:6666", "content-type": "application/json" }
    const routes = [
      ["/api/account/deletion", { confirm: "delete-account" }],
      [`/api/people/${personId}/profile`, { displayName: "Stolen" }],
      ["/api/session/revoke", {}],
      ["/api/access/intent", { kind: "home" }],
      ["/api/access/email", { email: "csrf@example.com", intent: "x" }],
      ["/api/access/code", { email: "csrf@example.com", code: "000000", intent: "x" }],
      ["/api/access/consume-link", { token: "nope" }],
    ] as const
    for (const [path, body] of routes) {
      const response = await jar.call(path, body, "POST", jsonHostile)
      expect(response.status).toBe(403)
      expect(response.json.status).toBe("origin-rejected")
    }
    const plain = await jar.call("/api/account/deletion", { confirm: "delete-account" }, "POST", { "content-type": "text/plain" })
    expect(plain.status).toBe(415)
    const sameOrigin = await jar.call("/api/people/" + personId + "/profile", { displayName: "Kept" }, "POST", { origin, "content-type": "application/json" })
    expect(sameOrigin.status).toBe(200)
    expect((await jar.call("/api/account", undefined, "GET")).json.displayName).toBe("Kept")
    const originless = await jar.call("/api/session/revoke", {}, "POST", { "content-type": "application/json" })
    expect(originless.status).toBe(200)
    expect((await jar.call("/api/account", undefined, "GET")).json.status).toBe("signed-out")
  })
})

describe("session cookie", () => {
  it("marks the session cookie Secure only for an https origin", async () => {
    const inbox = createMemoryInbox()
    const secureAccess = await createAccess({
      driver: { kind: "pglite" },
      secret,
      mail: inbox,
      clock: () => 1_700_000_000_000,
      guard: { allow: () => true },
      exposeInbox: false,
      publicOrigin: "https://studio.example",
    })
    const signed = await signIn(jarFor(secureAccess), inbox, "secure@example.com", () => undefined)
    expect(signed).toBeTruthy()
    const httpsCookies = [...secureAccessLastCookies]
    expect(httpsCookies.some((cookie) => cookie.startsWith("__Secure-better-auth.session_token=") && cookieAttribute(cookie, "Secure"))).toBe(true)
    await secureAccess.close()
    const localInbox = createMemoryInbox()
    const local = await createAccess({
      driver: { kind: "pglite" },
      secret,
      mail: localInbox,
      clock: () => 1_700_000_000_000,
      guard: { allow: () => true },
      exposeInbox: false,
      publicOrigin: origin,
    })
    await signIn(jarFor(local), localInbox, "local@example.com", () => undefined)
    expect(secureAccessLastCookies.some((cookie) => cookieAttribute(cookie, "Secure"))).toBe(false)
    await local.close()
  }, 20_000)

  it("renews the browser cookie after updateAge and keeps revocation authoritative", async () => {
    const inbox = createMemoryInbox()
    let now = Date.now()
    const access = await createAccess({
      driver: { kind: "pglite" },
      secret,
      mail: inbox,
      clock: () => now,
      guard: { allow: () => true },
      exposeInbox: false,
      publicOrigin: origin,
    })
    const jar = jarFor(access)
    await signIn(jar, inbox, "renew@example.com", () => undefined)
    const RealDate = Date
    let shift = 0
    globalThis.Date = class extends RealDate {
      constructor(value?: number | string | Date) {
        super(value === undefined ? RealDate.now() + shift : value)
      }

      static now(): number {
        return RealDate.now() + shift
      }
    } as DateConstructor
    try {
      shift = (accessPolicy.sessionUpdateAgeSeconds + 1) * 1000
      now += shift
      const renewed = await jar.call("/api/session", undefined, "GET")
      expect(renewed.json.status).toBe("signed-in")
      expect(renewed.cookies.some((cookie) => cookie.includes("session_token") && cookie.includes("Max-Age="))).toBe(true)
      shift = (accessPolicy.sessionTtlSeconds + 5) * 1000
      now += accessPolicy.sessionTtlSeconds * 1000
      const later = await jar.call("/api/session", undefined, "GET")
      expect(later.json.status).toBe("signed-in")
      await jar.call("/api/session/revoke", {})
      const revoked = await jar.call("/api/account", undefined, "GET")
      expect(revoked.json.status).toBe("signed-out")
    } finally {
      globalThis.Date = RealDate
      await access.close()
    }
  })

  it("returns the validated import intent from the session cookie", async () => {
    const inbox = createMemoryInbox()
    const access = await createAccess({
      driver: { kind: "pglite" },
      secret,
      mail: inbox,
      clock: () => 1_700_000_000_000,
      guard: { allow: () => true },
      exposeInbox: false,
      publicOrigin: origin,
    })
    const first = jarFor(access)
    const issued = await first.call("/api/access/intent", { kind: "import" })
    await first.call("/api/access/email", { email: "intent@example.com", intent: issued.json.token })
    const message = inbox.read("intent@example.com").at(-1)
    await first.call("/api/access/code", { email: "intent@example.com", code: message?.code, intent: issued.json.token })
    const fresh = jarFor(access)
    fresh.cookie = first.cookie
    const session = await fresh.call("/api/session", undefined, "GET")
    expect(session.json).toMatchObject({ status: "signed-in", kind: "import", intentToken: issued.json.token })
    await access.close()
  })
})

let secureAccessLastCookies: string[] = []

type CallResult = { status: number; json: Record<string, unknown>; cookies: string[] }

async function call(access: Access, path: string, body?: Record<string, unknown>, method: "GET" | "POST" = "POST", headers: Record<string, string> = {}): Promise<CallResult> {
  const init: RequestInit = { method, headers: { "content-type": "application/json", ...headers } }
  if (method !== "GET") {
    init.body = JSON.stringify(body ?? {})
  }
  const response = await access.handle(new Request(`http://127.0.0.1${path}`, init))
  const cookies = response.headers.getSetCookie()
  return { status: response.status, json: await response.json() as Record<string, unknown>, cookies }
}

function jarFor(access: Access) {
  const jar = {
    cookie: "",
    async call(path: string, body?: Record<string, unknown>, method: "GET" | "POST" = "POST", headers: Record<string, string> = {}) {
      const initHeaders = { "content-type": "application/json", cookie: jar.cookie, ...headers }
      const init: RequestInit = { method, headers: initHeaders }
      if (method !== "GET") {
        init.body = JSON.stringify(body ?? {})
      }
      const response = await access.handle(new Request(`http://127.0.0.1${path}`, init))
      const cookies = response.headers.getSetCookie()
      secureAccessLastCookies = cookies
      jar.cookie = mergeCookies(jar.cookie, cookies)
      return { status: response.status, json: await response.json() as Record<string, unknown>, cookies }
    },
  }
  return jar
}

function cookieAttribute(cookie: string, name: string): boolean {
  return cookie.split(";").some((part) => part.trim().toLowerCase() === name.toLowerCase())
}

function mergeCookies(current: string, setCookies: string[]): string {
  const jar = new Map<string, string>()
  for (const part of current.split(";")) {
    const trimmed = part.trim()
    const splitAt = trimmed.indexOf("=")
    if (splitAt > 0) {
      jar.set(trimmed.slice(0, splitAt), trimmed.slice(splitAt + 1))
    }
  }
  for (const cookie of setCookies) {
    const pair = cookie.split(";")[0] ?? ""
    const splitAt = pair.indexOf("=")
    if (splitAt > 0) {
      jar.set(pair.slice(0, splitAt).trim(), pair.slice(splitAt + 1))
    }
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ")
}

async function signIn(jar: ReturnType<typeof jarFor>, inbox: MemoryInbox, email: string, advance: () => void): Promise<string> {
  advance()
  const issued = await jar.call("/api/access/intent", { kind: "home" })
  await jar.call("/api/access/email", { email, intent: issued.json.token })
  const message = inbox.read(email).at(-1)
  const signed = await jar.call("/api/access/code", { email, code: message?.code, intent: issued.json.token })
  return String(signed.json.personId)
}
