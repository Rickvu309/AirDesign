import { createHash, randomBytes } from "node:crypto"
import { request as httpRequest, type IncomingHttpHeaders } from "node:http"
import { Client } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, sendWithResend, type Mail } from "./index.js"

const publicOrigin = "https://app.example"

function address(): string {
  return `person${randomBytes(4).toString("hex")}@example.com`
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function setCookie(headers: IncomingHttpHeaders): string {
  return headers["set-cookie"]?.[0] ?? ""
}

function rawSession(header: string): string {
  const pair = header.split(";")[0] ?? ""
  return decodeURIComponent(pair.slice(pair.indexOf("=") + 1))
}

function mailParts(text: string | undefined): { readonly link: string; readonly code: string; readonly token: string } {
  const parts = text?.split("\n") ?? []
  const link = parts[0]
  const code = parts[1]
  if (link === undefined || code === undefined) throw new Error("mail")
  const token = new URL(link).searchParams.get("token")
  if (token === null || token.length === 0) throw new Error("token")
  return { link, code, token }
}

function postHost(
  base: string,
  host: string,
  body: unknown,
): Promise<{ readonly status: number; readonly json: unknown }> {
  const url = new URL(base)
  const payload = Buffer.from(JSON.stringify(body))
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        method: "POST",
        hostname: "127.0.0.1",
        port: url.port,
        path: "/sign-in/email",
        setHost: false,
        headers: {
          host,
          "content-type": "application/json",
          "content-length": String(payload.length),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk)
        })
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8")
          resolve({ status: res.statusCode ?? 0, json: JSON.parse(text) as unknown })
        })
      },
    )
    req.on("error", reject)
    req.end(payload)
  })
}

async function ageIssued(statement: string, email: string): Promise<void> {
  const info = await postgresInfo()
  const admin = new Client({ connectionString: info.admin })
  await admin.connect()
  try {
    await admin.query(statement, [email])
  } finally {
    await admin.end()
  }
}

describe("sign-in", () => {
  const mails: Mail[] = []
  let calls: string[] = []
  let base = ""
  let close = async () => {}
  let session = openPool("postgres://session@127.0.0.1/api")
  let deck = openPool("postgres://deck@127.0.0.1/api")
  let listen = new DeckListen("postgres://listen@127.0.0.1/api")
  const originalFetch = globalThis.fetch

  beforeAll(async () => {
    const info = await postgresInfo()
    session = openPool(info.session, "sign-in")
    listen = new DeckListen(info.listen)
    deck = openPool(info.deck, "sign-in-deck")
    const served = await serve({
      session,
      deck,
      listen,
      publicOrigin,
      send: async (mail) => {
        mails.push(mail)
      },
    })
    base = served.base
    close = async () => {
      await served.close()
      await listen.close()
      await session.end()
      await deck.end()
    }
  })

  afterAll(async () => {
    globalThis.fetch = originalFetch
    await close()
  })

  beforeEach(() => {
    mails.length = 0
    calls = []
    globalThis.fetch = (async (input: string | URL) => {
      calls.push(String(input))
      throw new Error("fetch")
    }) as typeof fetch
  })

  it("sends one message with the link and a 6-digit code", async () => {
    const email = address()
    const response = await ask(base, "POST", "/sign-in/email", { email })
    expect(response.status).toBe(202)
    expect(response.json).toEqual({ ok: true })
    expect(mails).toHaveLength(1)
    const text = mails[0]?.text.split("\n") ?? []
    expect(text[0]).toContain("/sign-in/link?token=")
    expect(text[1]).toMatch(/^\d{6}$/)
    expect(mails[0]?.to).toBe(email)
    expect(calls).toEqual([])
    const counted = await session.query<{ count: string }>(
      "select count(*)::text as count from session.account where email = $1",
      [email],
    )
    expect(counted.rows[0]?.count).toBe("1")
  })

  it("sends again for the same address and does not say whether it was new", async () => {
    const email = address()
    const first = await ask(base, "POST", "/sign-in/email", { email })
    const second = await ask(base, "POST", "/sign-in/email", { email })
    expect(first.json).toEqual({ ok: true })
    expect(second.json).toEqual({ ok: true })
    expect(mails).toHaveLength(2)
    expect(JSON.stringify(second.json).includes("new")).toBe(false)
    const counted = await session.query<{ count: string }>(
      "select count(*)::text as count from session.account where email = $1",
      [email],
    )
    expect(counted.rows[0]?.count).toBe("1")
    expect(calls).toEqual([])
  })

  it("sets the session cookie for a matching code", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const code = mails[0]?.text.split("\n")[1]
    const response = await ask(base, "POST", "/sign-in/code", { email, code })
    expect(response.status).toBe(200)
    expect(response.json).toEqual({ ok: true })
    const setCookie = response.headers["set-cookie"]?.[0] ?? ""
    expect(setCookie).toContain("airdesign.session=")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("Secure")
    expect(setCookie).toContain("SameSite=Lax")
    expect(setCookie).toContain("Path=/")
    expect(setCookie).toContain("Max-Age=2592000")
    const again = await ask(base, "POST", "/sign-in/code", { email, code })
    expect(again.status).toBe(401)
    expect(again.json).toEqual({ ok: false, refusal: "code" })
  })

  it("refuses a code that does not match", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const response = await ask(base, "POST", "/sign-in/code", { email, code: "000000" })
    expect(response.status).toBe(401)
    expect(response.json).toEqual({ ok: false, refusal: "code" })
  })

  it("refuses a sign-in body that is not the email or code shape", async () => {
    const email = address()
    const bodies = [null, [], { email: 1 }, { email, extra: true }, { code: "123456" }, { email, code: "12345" }]
    for (const body of bodies) {
      const path =
        typeof body === "object" && body !== null && !Array.isArray(body) && "code" in body
          ? "/sign-in/code"
          : "/sign-in/email"
      const response = await ask(base, "POST", path, body)
      expect(response.status).toBe(400)
      expect(response.json).toEqual({ ok: false, refusal: "field" })
    }
  })

  it("sets the cookie from the link and sends a bad token back to sign-in", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const link = mails[0]?.text.split("\n")[0]
    if (link === undefined) throw new Error("link")
    const url = new URL(link)
    const response = await ask(base, "GET", `${url.pathname}${url.search}`)
    expect(response.status).toBe(302)
    expect(response.headers.location).toBe("/")
    expect(cookieFrom(response.headers)).toContain("airdesign.session=")
    const missing = await ask(base, "GET", "/sign-in/link?token=missing")
    expect(missing.status).toBe(302)
    expect(missing.headers.location).toBe("/sign-in")
    expect(missing.headers["set-cookie"]).toBeUndefined()
  })

  it("posts the link and the code to resend from the environment", async () => {
    const seen: { url: string; body: string }[] = []
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      seen.push({ url: String(input), body: String(init?.body ?? "") })
      return new Response("{}", { status: 200 })
    }) as typeof fetch
    process.env.RESEND_API_KEY = "test-key"
    process.env.RESEND_FROM = "sign-in@localhost"
    const text = "https://localhost/sign-in/link?token=abc\n123456"
    try {
      await sendWithResend({ to: "a@example.com", text })
    } finally {
      delete process.env.RESEND_API_KEY
      delete process.env.RESEND_FROM
    }
    const body = seen[0]?.body
    if (body === undefined) throw new Error("body")
    const posted = JSON.parse(body) as { readonly text: string; readonly subject: string }
    expect(seen[0]?.url).toBe("https://api.resend.com/emails")
    expect(posted.text).toBe(text)
    expect(posted.subject).toBe("Sign in")
  })

  it("refuses the right code after 10 wrong ones", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const mailed = mailParts(mails[0]?.text)
    const wrong = mailed.code === "000000" ? "111111" : "000000"
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const refused = await ask(base, "POST", "/sign-in/code", { email, code: wrong })
      expect(refused.status).toBe(401)
      expect(refused.json).toEqual({ ok: false, refusal: "code" })
    }
    const right = await ask(base, "POST", "/sign-in/code", { email, code: mailed.code })
    expect(right.status).toBe(401)
    expect(right.json).toEqual({ ok: false, refusal: "code" })
    expect(right.headers["set-cookie"]).toBeUndefined()
    const url = new URL(mailed.link)
    const linked = await ask(base, "GET", `${url.pathname}${url.search}`)
    expect(linked.status).toBe(302)
    expect(linked.headers.location).toBe("/")
    expect(cookieFrom(linked.headers)).toContain("airdesign.session=")
  })

  it("refuses a code older than 15 minutes", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const mailed = mailParts(mails[0]?.text)
    await ageIssued("update session.code set issued = now() - interval '16 minutes' where email = $1", email)
    const response = await ask(base, "POST", "/sign-in/code", { email, code: mailed.code })
    expect(response.status).toBe(401)
    expect(response.json).toEqual({ ok: false, refusal: "code" })
    expect(response.headers["set-cookie"]).toBeUndefined()
    expect(mails).toHaveLength(1)
  })

  it("refuses a link older than 15 minutes", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const mailed = mailParts(mails[0]?.text)
    await ageIssued("update session.code set issued = now() - interval '16 minutes' where email = $1", email)
    const url = new URL(mailed.link)
    const response = await ask(base, "GET", `${url.pathname}${url.search}`)
    expect(response.status).toBe(302)
    expect(response.headers.location).toBe("/sign-in")
    expect(response.headers["set-cookie"]).toBeUndefined()
    expect(mails).toHaveLength(1)
  })

  it("refuses a session older than 30 days", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const mailed = mailParts(mails[0]?.text)
    const signed = await ask(base, "POST", "/sign-in/code", { email, code: mailed.code })
    const cookie = cookieFrom(signed.headers)
    if (cookie === undefined) throw new Error("cookie")
    await ageIssued("update session.access set issued = now() - interval '31 days' where email = $1", email)
    const response = await ask(base, "POST", "/decks/open", { deck: "abc" }, cookie)
    expect(response.status).toBe(401)
    expect(response.json).toEqual({ ok: false, refusal: "session" })
    expect(response.headers["set-cookie"]).toBeUndefined()
  })

  it("stores no code, link token or session token as sent", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const mailed = mailParts(mails[0]?.text)
    const pending = await session.query("select * from session.code where email = $1", [email])
    const pendingText = JSON.stringify(pending.rows)
    expect(pending.rows).toHaveLength(1)
    expect(pendingText.includes(mailed.code)).toBe(false)
    expect(pendingText.includes(mailed.token)).toBe(false)
    expect(pending.rows[0]).toMatchObject({ code: digest(mailed.code), token: digest(mailed.token) })
    const signed = await ask(base, "POST", "/sign-in/code", { email, code: mailed.code })
    expect(signed.status).toBe(200)
    const header = setCookie(signed.headers)
    const raw = rawSession(header)
    expect(header.includes(raw)).toBe(true)
    const access = await session.query("select * from session.access where email = $1", [email])
    const accessText = JSON.stringify(access.rows)
    expect(access.rows.length).toBeGreaterThan(0)
    expect(accessText.includes(raw)).toBe(false)
    expect(accessText.includes(mailed.code)).toBe(false)
    expect(accessText.includes(mailed.token)).toBe(false)
    expect(access.rows.some((row: { token?: string }) => row.token === digest(raw))).toBe(true)
  })

  it("sends at most 5 messages to one address in a row", async () => {
    const email = address()
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await ask(base, "POST", "/sign-in/email", { email })
      expect(response.status).toBe(202)
      expect(response.json).toEqual({ ok: true })
    }
    expect(mails).toHaveLength(5)
    const mailed = mailParts(mails[4]?.text)
    const signed = await ask(base, "POST", "/sign-in/code", { email, code: mailed.code })
    expect(signed.status).toBe(200)
    expect(signed.json).toEqual({ ok: true })
    expect(cookieFrom(signed.headers)).toContain("airdesign.session=")
    expect(mails).toHaveLength(5)
  })

  it("sends again to that address after 15 minutes", async () => {
    const email = address()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await ask(base, "POST", "/sign-in/email", { email })
      expect(response.status).toBe(202)
    }
    const blocked = await ask(base, "POST", "/sign-in/email", { email })
    expect(blocked.status).toBe(202)
    expect(mails).toHaveLength(5)
    const fifth = mailParts(mails[4]?.text)
    await ageIssued(
      "update session.sent set issued = now() - interval '16 minutes' where email = $1 and issued = (select min(issued) from session.sent where email = $1)",
      email,
    )
    const again = await ask(base, "POST", "/sign-in/email", { email })
    expect(again.status).toBe(202)
    expect(again.json).toEqual({ ok: true })
    expect(mails).toHaveLength(6)
    const signed = await ask(base, "POST", "/sign-in/code", { email, code: fifth.code })
    expect(signed.status).toBe(401)
    expect(signed.json).toEqual({ ok: false, refusal: "code" })
  })

  it("builds the link from the configured host, not the request", async () => {
    const email = address()
    const response = await postHost(base, "evil.example", { email })
    expect(response.status).toBe(202)
    expect(response.json).toEqual({ ok: true })
    expect(mails).toHaveLength(1)
    const text = mails[0]?.text ?? ""
    expect(text.startsWith("https://app.example/sign-in/link?token=")).toBe(true)
    expect(text.includes("evil.example")).toBe(false)
    expect(JSON.stringify(mails[0]).includes("evil.example")).toBe(false)
  })

  it("keeps the link and the code out of the subject", async () => {
    const seen: { body: string }[] = []
    globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
      seen.push({ body: String(init?.body ?? "") })
      return new Response("{}", { status: 200 })
    }) as typeof fetch
    process.env.RESEND_API_KEY = "test-key"
    process.env.RESEND_FROM = "sign-in@localhost"
    const link = "https://app.example/sign-in/link?token=abc"
    const code = "123456"
    const text = `${link}\n${code}`
    try {
      await sendWithResend({ to: "a@example.com", text })
    } finally {
      delete process.env.RESEND_API_KEY
      delete process.env.RESEND_FROM
    }
    const body = seen[0]?.body
    if (body === undefined) throw new Error("body")
    const posted = JSON.parse(body) as { readonly text: string; readonly subject: string }
    expect(posted.text).toBe(text)
    expect(posted.subject).toBe("Sign in")
    expect(posted.subject.includes(link)).toBe(false)
    expect(posted.subject.includes(code)).toBe(false)
  })

  it("sets the configured domain on the session cookie", async () => {
    const served = await serve({
      session,
      deck,
      listen,
      publicOrigin,
      cookieDomain: "app.example",
      send: async (mail) => {
        mails.push(mail)
      },
    })
    try {
      const email = address()
      await ask(served.base, "POST", "/sign-in/email", { email })
      const codedMail = mailParts(mails[0]?.text)
      const coded = await ask(served.base, "POST", "/sign-in/code", { email, code: codedMail.code })
      const codedHeader = setCookie(coded.headers)
      const codedToken = rawSession(codedHeader)
      expect(codedHeader).toBe(
        `airdesign.session=${encodeURIComponent(codedToken)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000; Domain=app.example`,
      )
      const next = address()
      await ask(served.base, "POST", "/sign-in/email", { email: next })
      const linkedMail = mailParts(mails[1]?.text)
      const url = new URL(linkedMail.link)
      const linked = await ask(served.base, "GET", `${url.pathname}${url.search}`)
      const linkedHeader = setCookie(linked.headers)
      const linkedToken = rawSession(linkedHeader)
      expect(linkedHeader).toBe(
        `airdesign.session=${encodeURIComponent(linkedToken)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000; Domain=app.example`,
      )
    } finally {
      await served.close()
    }
  })

  it("sets no domain on the session cookie when none is configured", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const codedMail = mailParts(mails[0]?.text)
    const coded = await ask(base, "POST", "/sign-in/code", { email, code: codedMail.code })
    const codedHeader = setCookie(coded.headers)
    expect(codedHeader.toLowerCase().includes("domain")).toBe(false)
    expect(codedHeader).toContain("HttpOnly")
    expect(codedHeader).toContain("Secure")
    expect(codedHeader).toContain("SameSite=Lax")
    const next = address()
    await ask(base, "POST", "/sign-in/email", { email: next })
    const linkedMail = mailParts(mails[1]?.text)
    const url = new URL(linkedMail.link)
    const linked = await ask(base, "GET", `${url.pathname}${url.search}`)
    const linkedHeader = setCookie(linked.headers)
    expect(linkedHeader.toLowerCase().includes("domain")).toBe(false)
    expect(linkedHeader).toContain("HttpOnly")
    expect(linkedHeader).toContain("Secure")
    expect(linkedHeader).toContain("SameSite=Lax")
    expect(linked.headers["set-cookie"]?.length).toBe(1)
  })
})
