import { createHash, randomBytes } from "node:crypto"
import { request as httpRequest, type IncomingHttpHeaders } from "node:http"
import { Client, Pool } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, createApi, openPool, sendWithResend, type Mail } from "./index.js"

const publicOrigin = "https://app.example"
const siteOrigin = "https://site.example"
const expired = `${siteOrigin}/sign-in/expired`

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
  let failSends = 0
  const parks: { to: string; mark: () => void; gate: Promise<Error | undefined>; mail?: Mail }[] = []

  function holdSend(to: string): {
    readonly entered: Promise<void>
    readonly finish: (error?: Error) => void
    readonly text: () => string
  } {
    let mark!: () => void
    const entered = new Promise<void>((resolve) => {
      mark = resolve
    })
    let settle!: (error: Error | undefined) => void
    const gate = new Promise<Error | undefined>((resolve) => {
      settle = resolve
    })
    const held: { to: string; mark: () => void; gate: Promise<Error | undefined>; mail?: Mail } = { to, mark, gate }
    parks.push(held)
    return {
      entered,
      finish: (error) => settle(error),
      text: () => {
        if (held.mail?.text === undefined) throw new Error("mail")
        return held.mail.text
      },
    }
  }

  async function parkTwo(email: string): Promise<{
    readonly early: ReturnType<typeof holdSend>
    readonly later: ReturnType<typeof holdSend>
    readonly first: ReturnType<typeof ask>
    readonly second: ReturnType<typeof ask>
  }> {
    const early = holdSend(email)
    const later = holdSend(email)
    const first = ask(base, "POST", "/sign-in/email", { email })
    await early.entered
    const second = ask(base, "POST", "/sign-in/email", { email })
    await later.entered
    return { early, later, first, second }
  }

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
      siteOrigin,
      send: async (mail) => {
        const parked = parks.findIndex((waiting) => waiting.to === mail.to)
        const held = parked < 0 ? undefined : parks.splice(parked, 1)[0]
        if (held !== undefined) {
          held.mail = mail
          held.mark()
          const error = await held.gate
          if (error !== undefined) throw error
        }
        if (failSends > 0) {
          failSends -= 1
          throw new Error("provider")
        }
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
    failSends = 0
    parks.length = 0
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
    const again = await ask(base, "GET", `${url.pathname}${url.search}`)
    expect(again.status).toBe(302)
    expect(again.headers.location).toBe(expired)
    expect(again.headers["set-cookie"]).toBeUndefined()
    const missing = await ask(base, "GET", "/sign-in/link?token=missing")
    expect(missing.status).toBe(302)
    expect(missing.headers.location).toBe(expired)
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

  it("resets wrong guesses on a new send", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const first = mailParts(mails[0]?.text)
    const wrong = first.code === "000000" ? "111111" : "000000"
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const refused = await ask(base, "POST", "/sign-in/code", { email, code: wrong })
      expect(refused.status).toBe(401)
      expect(refused.json).toEqual({ ok: false, refusal: "code" })
    }
    const sent = await ask(base, "POST", "/sign-in/email", { email })
    expect(sent.status).toBe(202)
    expect(mails).toHaveLength(2)
    const next = mailParts(mails[1]?.text)
    const signed = await ask(base, "POST", "/sign-in/code", { email, code: next.code })
    expect(signed.status).toBe(200)
    expect(signed.json).toEqual({ ok: true })
    expect(cookieFrom(signed.headers)).toContain("airdesign.session=")
  })

  it("accepts the right code after nine wrong ones", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const mailed = mailParts(mails[0]?.text)
    const wrong = mailed.code === "000000" ? "111111" : "000000"
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const refused = await ask(base, "POST", "/sign-in/code", { email, code: wrong })
      expect(refused.status).toBe(401)
      expect(refused.json).toEqual({ ok: false, refusal: "code" })
    }
    const signed = await ask(base, "POST", "/sign-in/code", { email, code: mailed.code })
    expect(signed.status).toBe(200)
    expect(signed.json).toEqual({ ok: true })
    expect(cookieFrom(signed.headers)).toContain("airdesign.session=")
  })

  it("refuses a code mailed to another address", async () => {
    const owner = address()
    const other = address()
    await ask(base, "POST", "/sign-in/email", { email: owner })
    const mailed = mailParts(mails[0]?.text)
    const refused = await ask(base, "POST", "/sign-in/code", { email: other, code: mailed.code })
    expect(refused.status).toBe(401)
    expect(refused.json).toEqual({ ok: false, refusal: "code" })
    expect(refused.headers["set-cookie"]).toBeUndefined()
    const signed = await ask(base, "POST", "/sign-in/code", { email: owner, code: mailed.code })
    expect(signed.status).toBe(200)
    expect(signed.json).toEqual({ ok: true })
    expect(cookieFrom(signed.headers)).toContain("airdesign.session=")
  })

  it("refuses a code older than 15 minutes", async () => {
    const inside = address()
    await ask(base, "POST", "/sign-in/email", { email: inside })
    const insideMail = mailParts(mails[0]?.text)
    await ageIssued(
      "update session.code set issued = now() - interval '14 minutes 30 seconds' where email = $1",
      inside,
    )
    const accepted = await ask(base, "POST", "/sign-in/code", { email: inside, code: insideMail.code })
    expect(accepted.status).toBe(200)
    mails.length = 0
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const mailed = mailParts(mails[0]?.text)
    await ageIssued("update session.code set issued = now() - interval '15 minutes 30 seconds' where email = $1", email)
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
    expect(response.headers.location).toBe(expired)
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
    const linkEmail = address()
    await ask(base, "POST", "/sign-in/email", { email: linkEmail })
    const linkMail = mailParts(mails[1]?.text)
    const linkUrl = new URL(linkMail.link)
    const linked = await ask(base, "GET", `${linkUrl.pathname}${linkUrl.search}`)
    expect(linked.status).toBe(302)
    expect(linked.headers.location).toBe("/")
    const linkRaw = rawSession(setCookie(linked.headers))
    const linkAccess = await session.query("select * from session.access where email = $1", [linkEmail])
    const linkText = JSON.stringify(linkAccess.rows)
    expect(linkAccess.rows.length).toBeGreaterThan(0)
    expect(linkText.includes(linkRaw)).toBe(false)
    expect(linkAccess.rows.some((row: { token?: string }) => row.token === digest(linkRaw))).toBe(true)
    for (const [owner, mail] of [
      [email, mailed],
      [linkEmail, linkMail],
    ] as const) {
      const sent = await session.query("select * from session.sent where email = $1", [owner])
      const sentText = JSON.stringify(sent.rows)
      expect(sent.rows).toHaveLength(1)
      expect(sentText.includes(mail.code)).toBe(false)
      expect(sentText.includes(mail.token)).toBe(false)
      expect(sent.rows[0]).toMatchObject({ code: digest(mail.code), token: digest(mail.token) })
    }
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

  it("sends at most 5 messages to one address at the same moment", async () => {
    const email = address()
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const seeded = await ask(base, "POST", "/sign-in/email", { email })
      expect(seeded.status).toBe(202)
    }
    expect(mails).toHaveLength(4)
    const info = await postgresInfo()
    const holder = new Client({ connectionString: info.session, application_name: "sign-in-holder" })
    const admin = new Client({ connectionString: info.admin, application_name: "sign-in-admin" })
    await holder.connect()
    await admin.connect()
    let released = false
    await holder.query("begin")
    await holder.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [email])
    const left = ask(base, "POST", "/sign-in/email", { email })
    const right = ask(base, "POST", "/sign-in/email", { email })
    try {
      const started = Date.now()
      let waiting = 0
      let busy = 0
      while (waiting < 1 || busy < 2) {
        const found = await admin.query<{ waiting: number; busy: number }>(
          `select count(*) filter (where wait_event_type = 'Lock')::int as waiting, count(*)::int as busy
           from pg_stat_activity
           where application_name = $1 and query like '%pg_advisory_xact_lock%' and state <> 'idle'`,
          ["sign-in"],
        )
        waiting = found.rows[0]?.waiting ?? 0
        busy = found.rows[0]?.busy ?? 0
        if ((waiting < 1 || busy < 2) && Date.now() - started > 3000) throw new Error("the sends did not wait")
        if (waiting < 1 || busy < 2) await new Promise((resolve) => setTimeout(resolve, 20))
      }
      await holder.query("commit")
      released = true
    } finally {
      if (!released) await holder.query("rollback").catch(() => undefined)
      await holder.end().catch(() => undefined)
      await admin.end().catch(() => undefined)
      await Promise.all([left, right]).catch(() => undefined)
    }
    if (!released) throw new Error("the sends did not wait")
    const done = await Promise.all([left, right])
    for (const response of done) {
      expect(response.status).toBe(202)
      expect(response.json).toEqual({ ok: true })
    }
    expect(mails).toHaveLength(5)
    const counted = await session.query<{ total: number }>(
      "select count(*)::int as total from session.sent where email = $1 and issued > now() - interval '15 minutes'",
      [email],
    )
    expect(counted.rows[0]?.total).toBe(5)
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
      "update session.sent set issued = issued - interval '14 minutes 30 seconds' where email = $1",
      email,
    )
    const inside = await ask(base, "POST", "/sign-in/email", { email })
    expect(inside.status).toBe(202)
    expect(mails).toHaveLength(5)
    await ageIssued(
      "update session.sent set issued = now() - interval '15 minutes 30 seconds' where email = $1 and issued = (select min(issued) from session.sent where email = $1)",
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
      siteOrigin,
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
      expect(codedHeader).toContain("Max-Age=2592000")
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
      expect(linkedHeader).toContain("Max-Age=2592000")
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
    expect(codedHeader).toContain("Max-Age=2592000")
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
    expect(linkedHeader).toContain("Max-Age=2592000")
    expect(linkedHeader).toContain("HttpOnly")
    expect(linkedHeader).toContain("Secure")
    expect(linkedHeader).toContain("SameSite=Lax")
    expect(linked.headers["set-cookie"]?.length).toBe(1)
  })

  it("rejects a public origin with a path", () => {
    const send = async () => {}
    const shared = { session, deck, listen, send, siteOrigin }
    expect(() => createApi({ ...shared, publicOrigin: "https://app.example/path" })).toThrow(/publicOrigin/)
    expect(() => createApi({ ...shared, publicOrigin: "https://app.example/" })).toThrow(/publicOrigin/)
    expect(() => createApi({ ...shared, publicOrigin: "http://app.example" })).toThrow(/publicOrigin/)
  })

  it("rejects a site origin with a path", () => {
    const send = async () => {}
    const shared = { session, deck, listen, send, publicOrigin }
    expect(() => createApi({ ...shared, siteOrigin: "https://site.example/path" })).toThrow(/siteOrigin/)
    expect(() => createApi({ ...shared, siteOrigin: "https://site.example/" })).toThrow(/siteOrigin/)
    expect(() => createApi({ ...shared, siteOrigin: "http://site.example" })).toThrow(/siteOrigin/)
  })

  it("sends a failed link to the site's expired page", async () => {
    const bare = await ask(base, "GET", "/sign-in/link")
    expect(bare.status).toBe(302)
    expect(bare.headers.location).toBe(expired)
    expect(bare.headers["set-cookie"]).toBeUndefined()

    const unknown = "missing-token"
    const missed = await ask(base, "GET", `/sign-in/link?token=${unknown}`)
    expect(missed.status).toBe(302)
    expect(missed.headers.location).toBe(expired)
    expect(missed.headers["set-cookie"]).toBeUndefined()
    expect(missed.headers.location?.includes(unknown)).toBe(false)

    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    const mailed = mailParts(mails[0]?.text)
    const url = new URL(mailed.link)
    const opened = await ask(base, "GET", `${url.pathname}${url.search}`)
    expect(opened.status).toBe(302)
    expect(opened.headers.location).toBe("/")
    const used = await ask(base, "GET", `${url.pathname}${url.search}`)
    expect(used.status).toBe(302)
    expect(used.headers.location).toBe(expired)
    expect(used.headers["set-cookie"]).toBeUndefined()
    expect(used.headers.location?.includes(mailed.token)).toBe(false)

    const older = address()
    await ask(base, "POST", "/sign-in/email", { email: older })
    const oldMail = mailParts(mails[1]?.text)
    await ageIssued("update session.code set issued = now() - interval '16 minutes' where email = $1", older)
    const oldUrl = new URL(oldMail.link)
    const aged = await ask(base, "GET", `${oldUrl.pathname}${oldUrl.search}`)
    expect(aged.status).toBe(302)
    expect(aged.headers.location).toBe(expired)
    expect(aged.headers["set-cookie"]).toBeUndefined()
    expect(aged.headers.location?.includes(oldMail.token)).toBe(false)
  })

  it("keeps a delivered sign-in usable after its replacement mail fails", async () => {
    const linked = address()
    const opened = await ask(base, "POST", "/sign-in/email", { email: linked })
    expect(opened.status).toBe(202)
    const mailed = mailParts(mails[0]?.text)
    await ageIssued("update session.code set misses = 4 where email = $1", linked)
    failSends = 1
    const failed = await ask(base, "POST", "/sign-in/email", { email: linked })
    expect(failed.status).toBe(500)
    expect(failed.json).toBeUndefined()
    const kept = await session.query<{ misses: number }>("select misses from session.code where email = $1", [linked])
    expect(kept.rows[0]?.misses).toBe(4)
    const counted = await session.query<{ total: number }>(
      "select count(*)::int as total from session.sent where email = $1 and issued > now() - interval '15 minutes'",
      [linked],
    )
    expect(counted.rows[0]?.total).toBe(1)
    const url = new URL(mailed.link)
    const signed = await ask(base, "GET", `${url.pathname}${url.search}`)
    expect(signed.status).toBe(302)
    expect(signed.headers.location).toBe("/")

    mails.length = 0
    const coded = address()
    const again = await ask(base, "POST", "/sign-in/email", { email: coded })
    expect(again.status).toBe(202)
    const codeMail = mailParts(mails[0]?.text)
    failSends = 1
    const rejected = await ask(base, "POST", "/sign-in/email", { email: coded })
    expect(rejected.status).toBe(500)
    const withCode = await ask(base, "POST", "/sign-in/code", { email: coded, code: codeMail.code })
    expect(withCode.status).toBe(200)
    expect(withCode.json).toEqual({ ok: true })
  })

  it("allows recovery after provider failures instead of counting unsent mail", async () => {
    const email = address()
    failSends = 5
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await ask(base, "POST", "/sign-in/email", { email })
      expect(failed.status).toBe(500)
      expect(failed.json).toBeUndefined()
    }
    expect(mails).toHaveLength(0)
    const pending = await session.query<{ total: number }>(
      "select count(*)::int as total from session.code where email = $1",
      [email],
    )
    expect(pending.rows[0]?.total).toBe(0)
    const counted = await session.query<{ total: number }>(
      "select count(*)::int as total from session.sent where email = $1 and issued > now() - interval '15 minutes'",
      [email],
    )
    expect(counted.rows[0]?.total).toBe(0)
    const recovered = await ask(base, "POST", "/sign-in/email", { email })
    expect(recovered.status).toBe(202)
    expect(mails).toHaveLength(1)
    const mailed = mailParts(mails[0]?.text)
    const signed = await ask(base, "POST", "/sign-in/code", { email, code: mailed.code })
    expect(signed.status).toBe(200)
    expect(signed.json).toEqual({ ok: true })
  })

  it("leaves a newer mail alone when an older send fails late", async () => {
    const email = address()
    const held = holdSend(email)
    const first = ask(base, "POST", "/sign-in/email", { email })
    await held.entered
    const second = await ask(base, "POST", "/sign-in/email", { email })
    expect(second.status).toBe(202)
    expect(mails).toHaveLength(1)
    const newer = mailParts(mails[0]?.text)
    held.finish(new Error("provider"))
    const failed = await first
    expect(failed.status).toBe(500)
    const signed = await ask(base, "POST", "/sign-in/code", { email, code: newer.code })
    expect(signed.status).toBe(200)
    expect(signed.json).toEqual({ ok: true })
    const counted = await session.query<{ total: number }>(
      "select count(*)::int as total from session.sent where email = $1 and issued > now() - interval '15 minutes'",
      [email],
    )
    expect(counted.rows[0]?.total).toBe(1)
  })

  it("keeps a delivered sign-in usable when two sends at once both fail", async () => {
    async function failBoth(email: string, laterFirst: boolean): Promise<void> {
      const { early, later, first, second } = await parkTwo(email)
      const order = laterFirst
        ? [
            { held: later, response: second },
            { held: early, response: first },
          ]
        : [
            { held: early, response: first },
            { held: later, response: second },
          ]
      for (const step of order) {
        step.held.finish(new Error("provider"))
        const failed = await step.response
        expect(failed.status).toBe(500)
        expect(failed.json).toBeUndefined()
      }
    }

    const linked = address()
    const opened = await ask(base, "POST", "/sign-in/email", { email: linked })
    expect(opened.status).toBe(202)
    const mailed = mailParts(mails[0]?.text)
    mails.length = 0
    await failBoth(linked, false)
    const signed = await ask(base, "POST", "/sign-in/code", { email: linked, code: mailed.code })
    expect(signed.status).toBe(200)
    expect(signed.json).toEqual({ ok: true })

    const reversed = address()
    const again = await ask(base, "POST", "/sign-in/email", { email: reversed })
    expect(again.status).toBe(202)
    const kept = mailParts(mails[0]?.text)
    mails.length = 0
    await failBoth(reversed, true)
    const still = await ask(base, "POST", "/sign-in/code", { email: reversed, code: kept.code })
    expect(still.status).toBe(200)
    expect(still.json).toEqual({ ok: true })

    const fresh = address()
    const { early, later, first, second } = await parkTwo(fresh)
    const earlyCode = mailParts(early.text()).code
    const laterCode = mailParts(later.text()).code
    early.finish(new Error("provider"))
    later.finish(new Error("provider"))
    expect((await first).status).toBe(500)
    expect((await second).status).toBe(500)
    const pending = await session.query<{ total: number }>(
      "select count(*)::int as total from session.code where email = $1",
      [fresh],
    )
    expect(pending.rows[0]?.total).toBe(0)
    const earlySign = await ask(base, "POST", "/sign-in/code", { email: fresh, code: earlyCode })
    const laterSign = await ask(base, "POST", "/sign-in/code", { email: fresh, code: laterCode })
    expect(earlySign.status).toBe(401)
    expect(laterSign.status).toBe(401)
  })

  it("does not give an older mail more time when a later send fails", async () => {
    const email = address()
    const opened = await ask(base, "POST", "/sign-in/email", { email })
    expect(opened.status).toBe(202)
    const mailed = mailParts(mails[0]?.text)
    await ageIssued("update session.code set issued = now() - interval '14 minutes' where email = $1", email)
    failSends = 1
    const failed = await ask(base, "POST", "/sign-in/email", { email })
    expect(failed.status).toBe(500)
    await ageIssued("update session.code set issued = issued - interval '2 minutes' where email = $1", email)
    const refused = await ask(base, "POST", "/sign-in/code", { email, code: mailed.code })
    expect(refused.status).toBe(401)
    expect(refused.json).toEqual({ ok: false, refusal: "code" })
  })

  it("keeps the wrong-guess count when a later send fails", async () => {
    const email = address()
    const opened = await ask(base, "POST", "/sign-in/email", { email })
    expect(opened.status).toBe(202)
    const mailed = mailParts(mails[0]?.text)
    const wrongCode = mailed.code === "000000" ? "111111" : "000000"
    for (let guess = 0; guess < 3; guess += 1) {
      const wrong = await ask(base, "POST", "/sign-in/code", { email, code: wrongCode })
      expect(wrong.status).toBe(401)
    }
    failSends = 1
    const failed = await ask(base, "POST", "/sign-in/email", { email })
    expect(failed.status).toBe(500)
    for (let guess = 0; guess < 7; guess += 1) {
      const wrong = await ask(base, "POST", "/sign-in/code", { email, code: wrongCode })
      expect(wrong.status).toBe(401)
    }
    const refused = await ask(base, "POST", "/sign-in/code", { email, code: mailed.code })
    expect(refused.status).toBe(401)
    expect(refused.json).toEqual({ ok: false, refusal: "code" })
  })

  it("lets a newer mail win when an older one is delivered late", async () => {
    const email = address()
    const older = holdSend(email)
    const first = ask(base, "POST", "/sign-in/email", { email })
    await older.entered
    const second = await ask(base, "POST", "/sign-in/email", { email })
    expect(second.status).toBe(202)
    const newer = mailParts(mails[0]?.text)
    older.finish()
    const late = await first
    expect(late.status).toBe(202)
    const signed = await ask(base, "POST", "/sign-in/code", { email, code: newer.code })
    expect(signed.status).toBe(200)
    expect(signed.json).toEqual({ ok: true })
    const rejected = await ask(base, "POST", "/sign-in/code", { email, code: mailParts(older.text()).code })
    expect(rejected.status).toBe(401)
    expect(rejected.json).toEqual({ ok: false, refusal: "code" })
  })

  it("answers other sign-ins while two sends are slow", async () => {
    const known = address()
    const opened = await ask(base, "POST", "/sign-in/email", { email: known })
    expect(opened.status).toBe(202)
    const mailed = mailParts(mails[0]?.text)
    const leftEmail = address()
    const rightEmail = address()
    const left = holdSend(leftEmail)
    const right = holdSend(rightEmail)
    const slowLeft = ask(base, "POST", "/sign-in/email", { email: leftEmail })
    const slowRight = ask(base, "POST", "/sign-in/email", { email: rightEmail })
    await left.entered
    await right.entered
    try {
      const [third, coded] = await Promise.all([
        ask(base, "POST", "/sign-in/email", { email: address() }),
        ask(base, "POST", "/sign-in/code", { email: known, code: mailed.code }),
      ])
      expect(third.status).toBe(202)
      expect(third.json).toEqual({ ok: true })
      expect(coded.status).toBe(200)
      expect(coded.json).toEqual({ ok: true })
    } finally {
      left.finish()
      right.finish()
      await Promise.all([slowLeft, slowRight])
    }
  })

  it("sends at most 5 messages to each address under six sends at once", async () => {
    const info = await postgresInfo()
    const wide = new Pool({ connectionString: info.session, max: 6, application_name: "sign-in-wide" })
    const sent: Mail[] = []
    const served = await serve({
      session: wide,
      deck,
      listen,
      publicOrigin,
      siteOrigin,
      send: async (mail) => {
        sent.push(mail)
      },
    })
    try {
      for (let nth = 0; nth < 5; nth += 1) {
        const email = address()
        for (let seeded = 0; seeded < 4; seeded += 1) {
          const response = await ask(served.base, "POST", "/sign-in/email", { email })
          expect(response.status).toBe(202)
        }
        const burst = await Promise.all(
          Array.from({ length: 6 }, () => ask(served.base, "POST", "/sign-in/email", { email })),
        )
        for (const response of burst) {
          expect(response.status).toBe(202)
          expect(response.json).toEqual({ ok: true })
        }
        expect(sent.filter((mail) => mail.to === email)).toHaveLength(5)
        const counted = await wide.query<{ total: number }>(
          "select count(*)::int as total from session.sent where email = $1 and issued > now() - interval '15 minutes'",
          [email],
        )
        expect(counted.rows[0]?.total).toBe(5)
      }
    } finally {
      await served.close()
      await wide.end()
    }
  })

  it("survives a connection cut while an address is locked", async () => {
    const email = address()
    const info = await postgresInfo()
    const holder = new Client({ connectionString: info.session, application_name: "sign-in-holder" })
    const admin = new Client({ connectionString: info.admin, application_name: "sign-in-admin" })
    const unhandled: unknown[] = []
    const noteUnhandled = (error: unknown): void => {
      unhandled.push(error)
    }
    process.on("uncaughtException", noteUnhandled)
    process.on("unhandledRejection", noteUnhandled)
    await holder.connect()
    await admin.connect()
    try {
      await holder.query("begin")
      await holder.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [email])
      const cut = ask(base, "POST", "/sign-in/email", { email })
      let backend: number | undefined
      while (backend === undefined) {
        const found = await admin.query<{ pid: number }>(
          `select pid from pg_stat_activity
           where application_name = $1 and wait_event_type = 'Lock' and query like '%pg_advisory_xact_lock%'`,
          ["sign-in"],
        )
        backend = found.rows[0]?.pid
        if (backend === undefined) await new Promise((resolve) => setTimeout(resolve, 20))
      }
      await admin.query("select pg_terminate_backend($1)", [backend])
      const refused = await cut
      expect(refused.status).toBe(500)
      expect(refused.json).toBeUndefined()
      await holder.query("commit")
      const next = await ask(base, "POST", "/sign-in/email", { email })
      expect(next.status).toBe(202)
      expect(next.json).toEqual({ ok: true })
      expect(mails).toHaveLength(1)
      expect(unhandled).toEqual([])
    } finally {
      process.off("uncaughtException", noteUnhandled)
      process.off("unhandledRejection", noteUnhandled)
      await holder.end().catch(() => undefined)
      await admin.end().catch(() => undefined)
    }
  })

  it("counts a mail's 15 minutes from when it was issued", async () => {
    const email = address()
    const held = holdSend(email)
    const sending = ask(base, "POST", "/sign-in/email", { email })
    await held.entered
    await ageIssued("update session.sent set issued = now() - interval '14 minutes' where email = $1", email)
    held.finish()
    expect((await sending).status).toBe(202)
    const stamps = await session.query<{ same: boolean }>(
      `select code.issued = sent.issued as same
       from session.code code join session.sent sent on sent.email = code.email
       where code.email = $1`,
      [email],
    )
    expect(stamps.rows[0]?.same).toBe(true)
    await ageIssued("update session.code set issued = issued - interval '2 minutes' where email = $1", email)
    const refused = await ask(base, "POST", "/sign-in/code", { email, code: mailParts(held.text()).code })
    expect(refused.status).toBe(401)
    expect(refused.json).toEqual({ ok: false, refusal: "code" })
  })

  it("uses only its own address's send row when a mail is delivered", async () => {
    const delivered = address()
    const waiting = address()
    const heldDelivered = holdSend(delivered)
    const heldWaiting = holdSend(waiting)
    const sendDelivered = ask(base, "POST", "/sign-in/email", { email: delivered })
    await heldDelivered.entered
    const sendWaiting = ask(base, "POST", "/sign-in/email", { email: waiting })
    await heldWaiting.entered
    try {
      heldDelivered.finish()
      expect((await sendDelivered).status).toBe(202)
      const signed = await ask(base, "POST", "/sign-in/code", {
        email: delivered,
        code: mailParts(heldDelivered.text()).code,
      })
      expect(signed.status).toBe(200)
      const codes = await session.query<{ total: number }>(
        "select count(*)::int as total from session.code where email = $1",
        [waiting],
      )
      expect(codes.rows[0]?.total).toBe(0)
    } finally {
      heldDelivered.finish()
      heldWaiting.finish()
      await Promise.all([sendDelivered, sendWaiting])
    }

    const older = address()
    const newer = address()
    const heldOlder = holdSend(older)
    const heldNewer = holdSend(newer)
    const sendOlder = ask(base, "POST", "/sign-in/email", { email: older })
    await heldOlder.entered
    const sendNewer = ask(base, "POST", "/sign-in/email", { email: newer })
    await heldNewer.entered
    heldNewer.finish()
    expect((await sendNewer).status).toBe(202)
    heldOlder.finish()
    expect((await sendOlder).status).toBe(202)
    const olderSigned = await ask(base, "POST", "/sign-in/code", {
      email: older,
      code: mailParts(heldOlder.text()).code,
    })
    expect(olderSigned.status).toBe(200)
    const newerSigned = await ask(base, "POST", "/sign-in/code", {
      email: newer,
      code: mailParts(heldNewer.text()).code,
    })
    expect(newerSigned.status).toBe(200)
  })

  it("replaces the link when a newer mail is delivered", async () => {
    const email = address()
    await ask(base, "POST", "/sign-in/email", { email })
    await ask(base, "POST", "/sign-in/email", { email })
    expect(mails).toHaveLength(2)
    const olderUrl = new URL(mailParts(mails[0]?.text).link)
    const newerUrl = new URL(mailParts(mails[1]?.text).link)
    const older = await ask(base, "GET", `${olderUrl.pathname}${olderUrl.search}`)
    expect(older.status).toBe(302)
    expect(older.headers.location).toBe(expired)
    expect(older.headers["set-cookie"]).toBeUndefined()
    const newer = await ask(base, "GET", `${newerUrl.pathname}${newerUrl.search}`)
    expect(newer.status).toBe(302)
    expect(newer.headers.location).toBe("/")
    expect(cookieFrom(newer.headers)).toContain("airdesign.session=")
  })

  it("rejects cookie domains containing cookie attributes", () => {
    expect(() =>
      createApi({
        session,
        deck,
        listen,
        publicOrigin,
        siteOrigin,
        send: async () => {},
        cookieDomain: "app.example; SameSite=None; Max-Age=0",
      }),
    ).toThrow(/cookieDomain/)
  })
})
