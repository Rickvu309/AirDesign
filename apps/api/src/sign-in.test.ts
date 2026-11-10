import { randomBytes } from "node:crypto"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, sendWithResend, type Mail } from "./index.js"

function address(): string {
  return `person${randomBytes(4).toString("hex")}@example.com`
}

describe("sign-in", () => {
  const mails: Mail[] = []
  let calls: string[] = []
  let base = ""
  let close = async () => {}
  let session = openPool("postgres://session@127.0.0.1/api")
  const originalFetch = globalThis.fetch

  beforeAll(async () => {
    const info = await postgresInfo()
    session = openPool(info.session, "sign-in")
    const listen = new DeckListen(info.listen)
    const deck = openPool(info.deck, "sign-in-deck")
    const served = await serve({
      session,
      deck,
      listen,
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
    expect(posted.subject).toBe(text)
  })
})
