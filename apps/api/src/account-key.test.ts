import { randomBytes } from "node:crypto"
import type { IncomingHttpHeaders } from "node:http"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { accountCookieName, accountRoutes, deckRoutes, signInRoutes, signOutRoutes } from "@airdesign/catalog"
import { ask, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { readSignInMail } from "./sign-in-mail.js"

function address(mark: string): string {
  return `${mark}${randomBytes(4).toString("hex")}@example.com`
}

function accountHeader(headers: IncomingHttpHeaders): string | undefined {
  return headers["set-cookie"]?.find((header) => header.startsWith(`${accountCookieName}=`))
}

function keyOf(header: string | undefined): string {
  return header?.split(";")[0]?.slice(accountCookieName.length + 1) ?? ""
}

describe("account key", () => {
  const mails: Mail[] = []
  let base = ""
  let session: Sql = openPool("postgres://session@127.0.0.1/api")
  let close = async () => {}

  async function sign(email: string): Promise<{ readonly cookie: string; readonly account: string }> {
    const index = mails.length
    await ask(base, "POST", signInRoutes.email.path, { email })
    const { code } = readSignInMail(mails[index]?.text ?? "")
    const signed = await ask(base, "POST", signInRoutes.code.path, { email, code })
    const cookie = signed.headers["set-cookie"]?.[0]?.split(";")[0]
    const account = accountHeader(signed.headers)
    if (cookie === undefined || account === undefined) throw new Error("cookie")
    return { cookie, account }
  }

  beforeAll(async () => {
    const info = await postgresInfo()
    session = openPool(info.session, "account-key-session")
    const deck = openPool(info.deck, "account-key-deck")
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

  it("gives a signed-in browser an opaque key it can read, the same for every session of one account", async () => {
    const email = address("key")
    const first = await sign(email)
    const second = await sign(email)
    const other = await sign(address("other"))
    expect(first.account).toMatch(
      new RegExp(
        `^${accountCookieName.replace(".", "\\.")}=[0-9a-f]{32}; Secure; SameSite=Lax; Path=/; Max-Age=2592000$`,
      ),
    )
    expect(first.account).not.toContain("HttpOnly")
    expect(first.account).not.toContain(email.split("@")[0] ?? email)
    expect(keyOf(second.account)).toBe(keyOf(first.account))
    expect(keyOf(other.account)).not.toBe(keyOf(first.account))
  })

  it("sets the key on a signed-in answer that lacks it, and leaves it alone when it is already there", async () => {
    const { cookie, account } = await sign(address("lacks"))
    const bare = await ask(base, "POST", deckRoutes.list.path, {}, cookie)
    expect(bare.status).toBe(200)
    expect(accountHeader(bare.headers)).toBe(account)
    const stale = await ask(base, "POST", deckRoutes.list.path, {}, `${cookie}; ${accountCookieName}=${"0".repeat(32)}`)
    expect(accountHeader(stale.headers)).toBe(account)
    const kept = await ask(base, "POST", deckRoutes.list.path, {}, `${cookie}; ${account.split(";")[0] ?? ""}`)
    expect(kept.headers["set-cookie"]).toBeUndefined()
  })

  it("clears the key on a session refusal and on sign-out", async () => {
    const { cookie, account } = await sign(address("clear"))
    const out = await ask(base, "POST", signOutRoutes.session.path, undefined, cookie)
    const cleared = `${accountCookieName}=; Secure; SameSite=Lax; Path=/; Max-Age=0`
    expect(accountHeader(out.headers)).toBe(cleared)
    const refused = await ask(base, "POST", deckRoutes.list.path, {}, `${cookie}; ${account.split(";")[0] ?? ""}`)
    expect(refused.status).toBe(401)
    expect(accountHeader(refused.headers)).toBe(cleared)
  })

  it("gives an account made again after a deletion a new key", async () => {
    const email = address("again")
    const first = await sign(email)
    const deleted = await ask(base, "POST", accountRoutes.delete.path, { email }, first.cookie)
    expect(deleted.status).toBe(200)
    expect(accountHeader(deleted.headers)).toContain("Max-Age=0")
    const again = await sign(email)
    expect(keyOf(again.account)).not.toBe(keyOf(first.account))
  })

  it("sets the key when the sign-in link is followed", async () => {
    const email = address("link")
    const index = mails.length
    await ask(base, "POST", signInRoutes.email.path, { email })
    const { link } = readSignInMail(mails[index]?.text ?? "")
    const token = new URL(link).searchParams.get("token") ?? ""
    const followed = await ask(base, "GET", `${signInRoutes.link.path}?token=${encodeURIComponent(token)}`)
    expect(followed.status).toBe(302)
    expect(keyOf(accountHeader(followed.headers))).toMatch(/^[0-9a-f]{32}$/)
  })
})
