import { randomBytes } from "node:crypto"
import type { IncomingHttpHeaders } from "node:http"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { deckRoutes, oauthRoutes, signInRoutes, signOutRoutes } from "@airdesign/catalog"
import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { readSignInMail } from "./sign-in-mail.js"

function address(mark: string): string {
  return `${mark}${randomBytes(4).toString("hex")}@example.com`
}

function setCookie(headers: IncomingHttpHeaders): string {
  return headers["set-cookie"]?.[0] ?? ""
}

function cleared(header: string): string {
  const [pair, ...rest] = header.split("; ")
  const name = pair?.slice(0, pair.indexOf("="))
  return [`${name}=`, ...rest.map((part) => (part.startsWith("Max-Age=") ? "Max-Age=0" : part))].join("; ")
}

describe("sign-out", () => {
  const mails: Mail[] = []
  let base = ""
  let session: Sql = openPool("postgres://session@127.0.0.1/api")
  let close = async () => {}

  async function sign(account: string): Promise<{ readonly cookie: string; readonly header: string }> {
    const index = mails.length
    await ask(base, "POST", signInRoutes.email.path, { email: account })
    const { code } = readSignInMail(mails[index]?.text ?? "")
    const signed = await ask(base, "POST", signInRoutes.code.path, { email: account, code })
    const cookie = cookieFrom(signed.headers)
    const header = setCookie(signed.headers)
    if (cookie === undefined || header === "") throw new Error("cookie")
    return { cookie, header }
  }

  beforeAll(async () => {
    const info = await postgresInfo()
    session = openPool(info.session, "sign-out-session")
    const deck = openPool(info.deck, "sign-out-deck")
    const listen = new DeckListen(info.listen)
    const served = await serve({
      session,
      deck,
      listen,
      publicOrigin: "https://app.example",
      siteOrigin: "https://site.example",
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
    await close()
  })

  it("deletes the caller's session and refuses that cookie", async () => {
    const email = address("gone")
    const { cookie, header } = await sign(email)
    expect((await ask(base, "POST", deckRoutes.list.path, {}, cookie)).status).toBe(200)
    const out = await ask(base, "POST", signOutRoutes.session.path, undefined, cookie)
    expect(out.status).toBe(200)
    expect(out.json).toEqual({ ok: true })
    expect(setCookie(out.headers)).toBe(cleared(header))
    expect(setCookie(out.headers)).not.toContain("Domain=")
    const counted = await session.query<{ count: string }>(
      "select count(*)::text as count from session.access where email = $1",
      [email],
    )
    expect(counted.rows[0]?.count).toBe("0")
    const kept = await session.query<{ count: string }>(
      "select count(*)::text as count from session.account where email = $1",
      [email],
    )
    expect(kept.rows[0]?.count).toBe("1")
    for (const path of [deckRoutes.list.path, oauthRoutes.client.path, "/mcp"]) {
      const refused = await ask(base, "POST", path, {}, cookie)
      expect(refused.status).toBe(401)
      expect(refused.json).toEqual({ ok: false, refusal: "session" })
    }
  })

  it("answers again for the same cookie and for no cookie", async () => {
    const { cookie, header } = await sign(address("twice"))
    const first = await ask(base, "POST", signOutRoutes.session.path, undefined, cookie)
    const second = await ask(base, "POST", signOutRoutes.session.path, undefined, cookie)
    const bare = await ask(base, "POST", signOutRoutes.session.path)
    expect([first.status, second.status, bare.status]).toEqual([200, 200, 200])
    expect(first.json).toEqual({ ok: true })
    expect(second.json).toEqual({ ok: true })
    expect(bare.json).toEqual({ ok: true })
    expect(setCookie(second.headers)).toBe(cleared(header))
    expect(setCookie(bare.headers)).toBe(cleared(header))
    expect((await ask(base, "POST", deckRoutes.list.path, {}, cookie)).status).toBe(401)
  })

  it("leaves the account's other session signed in", async () => {
    const email = address("both")
    const first = await sign(email)
    const second = await sign(email)
    expect((await ask(base, "POST", signOutRoutes.session.path, undefined, first.cookie)).status).toBe(200)
    expect((await ask(base, "POST", deckRoutes.list.path, {}, first.cookie)).status).toBe(401)
    const kept = await ask(base, "POST", deckRoutes.list.path, {}, second.cookie)
    expect(kept.status).toBe(200)
    expect(kept.json).toMatchObject({ ok: true, account: { email } })
  })

  it("does not answer GET", async () => {
    const response = await ask(base, "GET", signOutRoutes.session.path)
    expect(response.status).toBe(404)
    expect(response.headers["set-cookie"]).toBeUndefined()
  })

  it("clears the cookie on the domain it was set with", async () => {
    const info = await postgresInfo()
    const domainSession = openPool(info.session, "sign-out-domain")
    const deck = openPool(info.deck, "sign-out-domain-deck")
    const listen = new DeckListen(info.listen)
    const sent: Mail[] = []
    const served = await serve({
      session: domainSession,
      deck,
      listen,
      publicOrigin: "https://app.example",
      siteOrigin: "https://site.example",
      cookieDomain: "app.example",
      send: async (mail) => {
        sent.push(mail)
      },
    })
    try {
      const email = address("domain")
      await ask(served.base, "POST", signInRoutes.email.path, { email })
      const { code } = readSignInMail(sent[0]?.text ?? "")
      const signed = await ask(served.base, "POST", signInRoutes.code.path, { email, code })
      const cookie = cookieFrom(signed.headers)
      const header = setCookie(signed.headers)
      if (cookie === undefined) throw new Error("cookie")
      expect(header).toContain("Domain=app.example")
      const out = await ask(served.base, "POST", signOutRoutes.session.path, undefined, cookie)
      expect(out.status).toBe(200)
      expect(setCookie(out.headers)).toBe(cleared(header))
      expect(setCookie(out.headers)).toContain("Domain=app.example")
      expect((await ask(served.base, "POST", deckRoutes.list.path, {}, cookie)).status).toBe(401)
    } finally {
      await served.close()
      await listen.close()
      await domainSession.end()
      await deck.end()
    }
  })
})
