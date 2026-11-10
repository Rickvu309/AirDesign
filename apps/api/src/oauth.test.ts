import { createHash, randomBytes } from "node:crypto"
import type { Pool } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { ask, askForm, cookieFrom, postgresInfo, serve } from "./harness.js"
import { bearerPrincipal, createApi, DeckListen, openPool, type Mail, type Sql } from "./index.js"

const own = "https://mcp.example.test/mcp"
const callback = "http://127.0.0.1:8123/cb"
const start = 1_000_000

type Pair = { readonly access: string; readonly refresh: string }
type Reply = Awaited<ReturnType<typeof ask>>

function address(): string {
  return `oauth${randomBytes(4).toString("hex")}@example.com`
}

function verifierPair(): { readonly verifier: string; readonly challenge: string } {
  const verifier = randomBytes(32).toString("base64url")
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") }
}

function tokensOf(reply: Reply): Pair {
  const body = reply.json as { access_token?: string; refresh_token?: string }
  if (body.access_token === undefined || body.refresh_token === undefined) throw new Error(reply.text)
  return { access: body.access_token, refresh: body.refresh_token }
}

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }

describe("oauth host", () => {
  const mails: Mail[] = []
  let clock = start
  let base = ""
  let session: Sql = openPool("postgres://session@127.0.0.1/api")
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    session = openPool(info.session, "oauth-session")
    const deck = openPool(info.deck, "oauth-deck")
    const listen = new DeckListen(info.listen)
    const served = await serve({
      ...origins,
      session,
      deck,
      listen,
      resource: own,
      now: () => clock,
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

  beforeEach(() => {
    clock = start
  })

  async function sign(email: string): Promise<string> {
    const index = mails.length
    await ask(base, "POST", "/sign-in/email", { email })
    const code = mails[index]?.text.split("\n")[1]
    const signed = await ask(base, "POST", "/sign-in/code", { email, code })
    const cookie = cookieFrom(signed.headers)
    if (cookie === undefined) throw new Error("cookie")
    return cookie
  }

  async function register(uris: readonly string[] = [callback], name?: string): Promise<string> {
    const reply = await ask(base, "POST", "/oauth/register", {
      redirect_uris: uris,
      ...(name === undefined ? {} : { client_name: name }),
    })
    const id = (reply.json as { client_id?: string }).client_id
    if (reply.status !== 201 || id === undefined) throw new Error(reply.text)
    return id
  }

  async function approveFor(
    cookie: string,
    clientId: string,
    challenge: string,
    extra: Record<string, unknown> = {},
  ): Promise<Reply> {
    return ask(
      base,
      "POST",
      "/oauth/approve",
      {
        client_id: clientId,
        redirect_uri: callback,
        code_challenge: challenge,
        code_challenge_method: "S256",
        ...extra,
      },
      cookie,
    )
  }

  async function codeFor(
    cookie: string,
    clientId: string,
    challenge: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    const reply = await approveFor(cookie, clientId, challenge, extra)
    const redirect = (reply.json as { redirect?: string }).redirect
    if (redirect === undefined) throw new Error(reply.text)
    const code = new URL(redirect).searchParams.get("code")
    if (code === null) throw new Error(redirect)
    return code
  }

  function exchange(
    clientId: string,
    code: string,
    verifier: string,
    extra: Record<string, string> = {},
  ): Promise<Reply> {
    return askForm(base, "/oauth/token", {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: clientId,
      redirect_uri: callback,
      ...extra,
    })
  }

  function rotate(clientId: string, refresh: string, extra: Record<string, string> = {}): Promise<Reply> {
    return askForm(base, "/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: clientId,
      ...extra,
    })
  }

  async function flow(): Promise<{
    readonly email: string
    readonly cookie: string
    readonly clientId: string
    readonly pair: Pair
  }> {
    const email = address()
    const cookie = await sign(email)
    const clientId = await register()
    const { verifier, challenge } = verifierPair()
    const code = await codeFor(cookie, clientId, challenge)
    return { email, cookie, clientId, pair: tokensOf(await exchange(clientId, code, verifier)) }
  }

  async function count(table: string, column: string, value: string): Promise<number> {
    const result = await session.query<{ count: number }>(
      `select count(*)::int as count from session.${table} where ${column} = $1`,
      [value],
    )
    return result.rows[0]?.count ?? -1
  }

  async function grantOf(clientId: string): Promise<Record<string, unknown>> {
    const result = await session.query<Record<string, unknown>>(
      "select principal, code, generation, revoked from session.oauth_grant where client_id = $1",
      [clientId],
    )
    expect(result.rows).toHaveLength(1)
    return result.rows[0] ?? {}
  }

  async function works(secret: string): Promise<boolean> {
    return (await bearerPrincipal(session, secret, clock)).ok
  }

  async function rawForm(route: string, text: string): Promise<Reply> {
    const url = new URL(route, base)
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: text,
    })
    const body = await response.text()
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      json: body.length === 0 ? undefined : (JSON.parse(body) as unknown),
      text: body,
    }
  }

  function intercepting(pool: Pool, replace: (text: string) => Promise<unknown> | undefined): Pool {
    return new Proxy(pool, {
      get(target, name) {
        if (name === "query") {
          return (text: unknown, ...rest: unknown[]) =>
            replace(String(text)) ?? Reflect.apply(target.query, target, [text, ...rest])
        }
        const value: unknown = Reflect.get(target, name, target)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
  }

  function holdingTwoWrites(pool: Pool): Pool {
    let arrived = 0
    let openGate = () => {}
    const bothRead = new Promise<void>((resolve) => {
      openGate = resolve
    })
    return new Proxy(pool, {
      get(target, name) {
        if (name === "query") {
          return async (text: unknown, ...rest: unknown[]) => {
            if (String(text).includes("update session.oauth_grant")) {
              arrived += 1
              if (arrived === 2) openGate()
              await bothRead
            }
            return Reflect.apply(target.query, target, [text, ...rest]) as unknown
          }
        }
        const value: unknown = Reflect.get(target, name, target)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
  }

  async function sideServer(options: {
    readonly wrap?: (pool: Pool) => Pool
  }): Promise<{ readonly base: string; readonly close: () => Promise<void> }> {
    const info = await postgresInfo()
    const raw = openPool(info.session, "oauth-side-session")
    const deck = openPool(info.deck, "oauth-side-deck")
    const listen = new DeckListen(info.listen)
    const served = await serve({
      ...origins,
      session: options.wrap === undefined ? raw : options.wrap(raw),
      deck,
      listen,
      resource: own,
      now: () => clock,
      send: async () => undefined,
    })
    return {
      base: served.base,
      close: async () => {
        await served.close()
        await listen.close()
        await raw.end()
        await deck.end()
      },
    }
  }

  describe("register", () => {
    it("accepts a loopback and an https address and stores them", async () => {
      const reply = await ask(base, "POST", "/oauth/register", {
        redirect_uris: [callback, "https://app.example.test/cb?x=1"],
        client_name: "Claude Code",
      })
      expect(reply.status).toBe(201)
      const body = reply.json as Record<string, unknown>
      expect(body).toEqual({
        client_id: body.client_id,
        client_name: "Claude Code",
        redirect_uris: [callback, "https://app.example.test/cb?x=1"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      })
      const stored = await session.query<{ name: string | null; redirect_uris: string[] }>(
        "select name, redirect_uris from session.oauth_client where id = $1",
        [String(body.client_id)],
      )
      expect(stored.rows[0]).toEqual({
        name: "Claude Code",
        redirect_uris: [callback, "https://app.example.test/cb?x=1"],
      })
    })

    it("leaves the name out when none was sent", async () => {
      const reply = await ask(base, "POST", "/oauth/register", { redirect_uris: ["http://[::1]:9/cb"] })
      expect(reply.status).toBe(201)
      expect(Object.keys(reply.json as object)).not.toContain("client_name")
      const stored = await session.query<{ name: string | null }>(
        "select name from session.oauth_client where id = $1",
        [String((reply.json as { client_id: string }).client_id)],
      )
      expect(stored.rows[0]?.name).toBeNull()
    })

    it("refuses what is not a public client's metadata and stores nothing", async () => {
      const bad: unknown[] = [
        { redirect_uris: ["http://example.com/cb"] },
        { redirect_uris: ["https://example.com/cb#frag"] },
        { redirect_uris: ["https://example.com/cb#"] },
        { redirect_uris: [] },
        { redirect_uris: Array.from({ length: 6 }, (_, index) => `https://example.com/${String(index)}`) },
        { redirect_uris: [callback], client_name: "x".repeat(201) },
        { redirect_uris: [callback], client_name: 7 },
        { redirect_uris: "https://example.com/cb" },
        { redirect_uris: ["not a url"] },
        { redirect_uris: ["ftp://localhost/cb"] },
        { redirect_uris: [7] },
        {},
        [],
      ]
      const sent = bad.flatMap((body) => {
        const uris = (body as { redirect_uris?: unknown }).redirect_uris
        return Array.isArray(uris) ? uris.filter((uri): uri is string => typeof uri === "string") : []
      })
      const stored = () =>
        session.query<{ count: number }>(
          "select count(*)::int as count from session.oauth_client where redirect_uris <@ $1::text[]",
          [[...sent, callback]],
        )
      const before = await stored()
      for (const body of bad) {
        const reply = await ask(base, "POST", "/oauth/register", body)
        expect(reply.status).toBe(400)
        expect(reply.json).toEqual({ error: "invalid_client_metadata" })
      }
      const noBody = await ask(base, "POST", "/oauth/register")
      expect(noBody.status).toBe(400)
      const after = await stored()
      expect(after.rows[0]?.count).toBe(before.rows[0]?.count)
    })

    it("accepts five addresses and a 200 character name", async () => {
      const uris = Array.from({ length: 5 }, (_, index) => `https://example.com/${String(index)}`)
      const reply = await ask(base, "POST", "/oauth/register", { redirect_uris: uris, client_name: "x".repeat(200) })
      expect(reply.status).toBe(201)
      const stored = await session.query<{ name: string; redirect_uris: string[] }>(
        "select name, redirect_uris from session.oauth_client where id = $1",
        [String((reply.json as { client_id: string }).client_id)],
      )
      expect(stored.rows[0]).toEqual({ name: "x".repeat(200), redirect_uris: uris })
    })

    it("caps an address at 2000 characters", async () => {
      const at = `https://example.com/${"a".repeat(1980)}`
      expect(at).toHaveLength(2000)
      const accepted = await ask(base, "POST", "/oauth/register", { redirect_uris: [at] })
      expect(accepted.status).toBe(201)
      const before = await session.query<{ count: number }>("select count(*)::int as count from session.oauth_client")
      const refused = await ask(base, "POST", "/oauth/register", { redirect_uris: [`${at}a`] })
      expect(refused.status).toBe(400)
      expect(refused.json).toEqual({ error: "invalid_client_metadata" })
      const after = await session.query<{ count: number }>("select count(*)::int as count from session.oauth_client")
      expect(after.rows[0]?.count).toBe(before.rows[0]?.count)
    })

    it("refuses an address whose host only starts like a loopback host", async () => {
      const before = await session.query<{ count: number }>("select count(*)::int as count from session.oauth_client")
      for (const uri of ["http://localhost.evil.example/cb", "http://127.0.0.1.evil.example/cb"]) {
        const reply = await ask(base, "POST", "/oauth/register", { redirect_uris: [uri] })
        expect(reply.status).toBe(400)
        expect(reply.json).toEqual({ error: "invalid_client_metadata" })
      }
      const after = await session.query<{ count: number }>("select count(*)::int as count from session.oauth_client")
      expect(after.rows[0]?.count).toBe(before.rows[0]?.count)
    })

    it("refuses text that Postgres cannot store and stores nothing", async () => {
      const before = await session.query<{ count: number }>("select count(*)::int as count from session.oauth_client")
      const bad: unknown[] = [
        { redirect_uris: [callback], client_name: "a\u0000b" },
        { redirect_uris: [callback], client_name: "\ud800" },
        { redirect_uris: [callback], client_name: "a\udc00" },
        { redirect_uris: ["https://a.example/\u0000"] },
        { redirect_uris: ["https://a.example/\ud800"] },
      ]
      for (const body of bad) {
        const reply = await ask(base, "POST", "/oauth/register", body)
        expect(reply.status).toBe(400)
        expect(reply.json).toEqual({ error: "invalid_client_metadata" })
      }
      const after = await session.query<{ count: number }>("select count(*)::int as count from session.oauth_client")
      expect(after.rows[0]?.count).toBe(before.rows[0]?.count)
      const paired = await ask(base, "POST", "/oauth/register", {
        redirect_uris: [callback],
        client_name: "ok \ud83d\ude00",
      })
      expect(paired.status).toBe(201)
    })
  })

  describe("client", () => {
    it("refuses a call without a session", async () => {
      const reply = await ask(base, "POST", "/oauth/client", { client_id: "x", redirect_uri: callback })
      expect(reply.status).toBe(401)
      expect(reply.json).toEqual({ ok: false, refusal: "session" })
    })

    it("refuses an unknown client, a different address and a wrong resource", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      const unknown = await ask(base, "POST", "/oauth/client", { client_id: "nope", redirect_uri: callback }, cookie)
      expect(unknown.json).toEqual({ ok: false, refusal: "client" })
      const other = await ask(
        base,
        "POST",
        "/oauth/client",
        { client_id: clientId, redirect_uri: "http://127.0.0.1:8123/cc" },
        cookie,
      )
      expect(other.json).toEqual({ ok: false, refusal: "redirect" })
      const wrong = await ask(
        base,
        "POST",
        "/oauth/client",
        { client_id: clientId, redirect_uri: callback, resource: "https://other.example.test/mcp" },
        cookie,
      )
      expect(wrong.json).toEqual({ ok: false, refusal: "resource" })
      const malformed = await ask(base, "POST", "/oauth/client", { client_id: clientId }, cookie)
      expect(malformed.json).toEqual({ ok: false, refusal: "field" })
    })

    it("answers the name, the screen and the host", async () => {
      const cookie = await sign(address())
      const named = await register([callback], "Claude Code")
      const good = await ask(
        base,
        "POST",
        "/oauth/client",
        { client_id: named, redirect_uri: callback, resource: own },
        cookie,
      )
      expect(good.status).toBe(200)
      expect(good.json).toEqual({
        ok: true,
        client_name: "Claude Code",
        screen: "claude-code",
        redirect_host: "127.0.0.1:8123",
      })
      const claude = await register(["https://claude.ai/api/mcp/auth_callback"])
      const nameless = await ask(
        base,
        "POST",
        "/oauth/client",
        { client_id: claude, redirect_uri: "https://claude.ai/api/mcp/auth_callback" },
        cookie,
      )
      expect(nameless.json).toEqual({ ok: true, client_name: null, screen: "claude", redirect_host: "claude.ai" })
    })
  })

  describe("approve", () => {
    it("refuses a call without a session and stores no grant", async () => {
      const clientId = await register()
      const reply = await approveFor("airdesign.session=nope", clientId, verifierPair().challenge)
      expect(reply.status).toBe(401)
      expect(reply.json).toEqual({ ok: false, refusal: "session" })
      const none = await ask(base, "POST", "/oauth/approve", {
        client_id: clientId,
        redirect_uri: callback,
        code_challenge: verifierPair().challenge,
        code_challenge_method: "S256",
      })
      expect(none.status).toBe(401)
      expect(await count("oauth_grant", "client_id", clientId)).toBe(0)
    })

    it("refuses each fault and stores no grant", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      const { challenge } = verifierPair()
      const cases: readonly (readonly [Record<string, unknown>, string])[] = [
        [{ client_id: "unknown" }, "client"],
        [{ redirect_uri: `${callback}x` }, "redirect"],
        [{ code_challenge_method: "plain" }, "challenge"],
        [{ code_challenge_method: undefined }, "challenge"],
        [{ code_challenge: challenge.slice(1) }, "challenge"],
        [{ code_challenge: `${challenge.slice(1)}=` }, "challenge"],
        [{ code_challenge: `${challenge.slice(1)}+` }, "challenge"],
        [{ resource: "https://other.example.test/mcp" }, "resource"],
        [{ resource: 7 }, "resource"],
        [{ state: 7 }, "field"],
      ]
      for (const [extra, refusal] of cases) {
        const reply = await approveFor(cookie, clientId, challenge, extra)
        expect(reply.status).toBe(400)
        expect(reply.json).toEqual({ ok: false, refusal })
      }
      expect(await count("oauth_grant", "client_id", clientId)).toBe(0)
    })

    it("keeps the query of the registered address and carries the state", async () => {
      const email = address()
      const cookie = await sign(email)
      const registered = "https://app.example.test/cb?keep=1"
      const clientId = await register([registered])
      const { challenge } = verifierPair()
      const reply = await ask(
        base,
        "POST",
        "/oauth/approve",
        {
          client_id: clientId,
          redirect_uri: registered,
          code_challenge: challenge,
          code_challenge_method: "S256",
          state: "s t&ate",
          resource: "https://MCP.example.test:443/mcp",
        },
        cookie,
      )
      expect(reply.status).toBe(200)
      const target = new URL((reply.json as { redirect: string }).redirect)
      expect(target.origin + target.pathname).toBe("https://app.example.test/cb")
      expect(target.searchParams.get("keep")).toBe("1")
      expect(target.searchParams.get("state")).toBe("s t&ate")
      const code = target.searchParams.get("code") ?? ""
      expect(code.length).toBeGreaterThanOrEqual(43)
      const stored = await session.query<{
        principal: string
        code: string
        generation: number
        revoked: boolean
        code_expires: number
      }>("select principal, code, generation, revoked, code_expires from session.oauth_grant where client_id = $1", [
        clientId,
      ])
      expect(stored.rows).toEqual([
        { principal: email, code: "open", generation: 0, revoked: false, code_expires: start + 600_000 },
      ])
    })

    it("leaves the state out when none was sent", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      const reply = await approveFor(cookie, clientId, verifierPair().challenge)
      const target = new URL((reply.json as { redirect: string }).redirect)
      expect([...target.searchParams.keys()]).toEqual(["code"])
      expect(await grantOf(clientId)).toMatchObject({ code: "open", generation: 0, revoked: false })
    })

    it("carries no state the agent did not send", async () => {
      const cookie = await sign(address())
      const registered = "https://app.example.test/cb?code=evil&state=evil&a=b"
      const clientId = await register([registered])
      const { verifier, challenge } = verifierPair()
      const reply = await ask(
        base,
        "POST",
        "/oauth/approve",
        { client_id: clientId, redirect_uri: registered, code_challenge: challenge, code_challenge_method: "S256" },
        cookie,
      )
      const target = new URL((reply.json as { redirect: string }).redirect)
      expect(target.searchParams.has("state")).toBe(false)
      expect(target.searchParams.getAll("code")).toHaveLength(1)
      expect(target.searchParams.get("code")).not.toBe("evil")
      expect(target.searchParams.get("a")).toBe("b")
      const code = target.searchParams.get("code") ?? ""
      expect((await exchange(clientId, code, verifier, { redirect_uri: registered })).status).toBe(200)
    })

    it("always puts the server's code and state in the redirect", async () => {
      const cookie = await sign(address())
      const registered = "https://app.example.test/cb?code=evil&state=evil&a=b"
      const clientId = await register([registered])
      const { verifier, challenge } = verifierPair()
      const reply = await ask(
        base,
        "POST",
        "/oauth/approve",
        {
          client_id: clientId,
          redirect_uri: registered,
          code_challenge: challenge,
          code_challenge_method: "S256",
          state: "real",
        },
        cookie,
      )
      const target = new URL((reply.json as { redirect: string }).redirect)
      expect(target.searchParams.getAll("code")).toHaveLength(1)
      expect(target.searchParams.getAll("state")).toEqual(["real"])
      expect(target.searchParams.get("a")).toBe("b")
      const code = target.searchParams.get("code") ?? ""
      expect(code).not.toBe("evil")
      expect((await exchange(clientId, code, verifier, { redirect_uri: registered })).status).toBe(200)
    })

    it("refuses text that Postgres cannot store and stores no grant", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      const { challenge } = verifierPair()
      const probes: readonly Record<string, unknown>[] = [
        { client_id: "\u0000" },
        { client_id: "\ud800" },
        { redirect_uri: "\u0000" },
        { state: "a\u0000" },
        { state: "\udc00" },
        { resource: "\u0000" },
        { resource: "\ud800" },
      ]
      for (const probe of probes) {
        const reply = await approveFor(cookie, clientId, challenge, probe)
        expect(reply.status).toBe(400)
        expect(reply.json).toEqual({ ok: false, refusal: "field" })
        const described = await ask(
          base,
          "POST",
          "/oauth/client",
          { client_id: clientId, redirect_uri: callback, ...probe },
          cookie,
        )
        if ("state" in probe) expect(described.status).toBe(200)
        else expect(described.json).toEqual({ ok: false, refusal: "field" })
      }
      expect(await count("oauth_grant", "client_id", clientId)).toBe(0)
    })
  })

  describe("session cookie", () => {
    const malformed = ["%", "%E0%A4%A", "%00", "%ED%A0%80"]

    it("reads a cookie that cannot be decoded or holds NUL as no session on every cookie route", async () => {
      const clientId = await register()
      const { challenge } = verifierPair()
      for (const value of malformed) {
        const cookie = `airdesign.session=${value}`
        const described = await ask(
          base,
          "POST",
          "/oauth/client",
          { client_id: clientId, redirect_uri: callback },
          cookie,
        )
        expect(described.status).toBe(401)
        expect(described.json).toEqual({ ok: false, refusal: "session" })
        const approved = await approveFor(cookie, clientId, challenge)
        expect(approved.status).toBe(401)
        expect(approved.json).toEqual({ ok: false, refusal: "session" })
        const opened = await ask(base, "POST", "/decks/open", { deck: "cookie-deck" }, cookie)
        expect(opened.status).toBe(401)
        expect(opened.json).toEqual({ ok: false, refusal: "session" })
      }
      expect(await count("oauth_grant", "client_id", clientId)).toBe(0)
    })

    it("still reads a good cookie", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      const described = await ask(
        base,
        "POST",
        "/oauth/client",
        { client_id: clientId, redirect_uri: callback },
        cookie,
      )
      expect(described.status).toBe(200)
    })
  })

  describe("authorization code", () => {
    it("works once and a second use with the right verifier revokes what the first issued", async () => {
      const email = address()
      const cookie = await sign(email)
      const clientId = await register()
      const { verifier, challenge } = verifierPair()
      const code = await codeFor(cookie, clientId, challenge)
      const first = await exchange(clientId, code, verifier, { resource: own })
      expect(first.status).toBe(200)
      expect(first.headers["cache-control"]).toBe("no-store")
      expect(first.json).toEqual({
        access_token: tokensOf(first).access,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: tokensOf(first).refresh,
      })
      const tokens = await session.query<{ kind: string; generation: number; expires: number | null }>(
        "select t.kind, t.generation, t.expires from session.oauth_token t join session.oauth_grant g on g.id = t.grant_id where g.client_id = $1 order by t.kind",
        [clientId],
      )
      expect(tokens.rows).toEqual([
        { kind: "access", generation: 1, expires: start + 3_600_000 },
        { kind: "refresh", generation: 1, expires: null },
      ])
      expect(await works(tokensOf(first).access)).toBe(true)
      const again = await exchange(clientId, code, verifier)
      expect(again.status).toBe(400)
      expect(again.json).toEqual({ error: "invalid_grant" })
      expect(await grantOf(clientId)).toEqual({ principal: email, code: "used", generation: 1, revoked: true })
      expect(await works(tokensOf(first).access)).toBe(false)
      expect((await rotate(clientId, tokensOf(first).refresh)).json).toEqual({ error: "invalid_grant" })
    })

    it("leaves the first tokens working when a reused code fails the verifier, the client or the address", async () => {
      const cookie = await sign(address())
      const clientId = await register([callback, "http://127.0.0.1:8123/other"])
      const stranger = await register()
      const { verifier, challenge } = verifierPair()
      const code = await codeFor(cookie, clientId, challenge)
      const first = tokensOf(await exchange(clientId, code, verifier))
      const replays = [
        await exchange(clientId, code, verifierPair().verifier),
        await exchange(stranger, code, verifier),
        await exchange(clientId, code, verifier, { redirect_uri: "http://127.0.0.1:8123/other" }),
      ]
      for (const replay of replays) expect(replay.json).toEqual({ error: "invalid_grant" })
      expect(await grantOf(clientId)).toMatchObject({ code: "used", generation: 1, revoked: false })
      expect(await works(first.access)).toBe(true)
      expect((await rotate(clientId, first.refresh)).status).toBe(200)
    })

    it("refuses a wrong verifier and the right one still works", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      const { verifier, challenge } = verifierPair()
      const code = await codeFor(cookie, clientId, challenge)
      for (const wrong of [verifierPair().verifier, "short", `${verifier}x`]) {
        const reply = await exchange(clientId, code, wrong)
        expect(reply.status).toBe(400)
        expect(reply.json).toEqual({ error: "invalid_grant" })
      }
      expect(await grantOf(clientId)).toMatchObject({ code: "open", generation: 0, revoked: false })
      expect((await exchange(clientId, code, verifier)).status).toBe(200)
    })

    it("refuses an expired code and accepts one just before", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      const late = verifierPair()
      const lateCode = await codeFor(cookie, clientId, late.challenge)
      clock = start + 600_000
      const expired = await exchange(clientId, lateCode, late.verifier)
      expect(expired.json).toEqual({ error: "invalid_grant" })
      clock = start
      const timely = verifierPair()
      const timelyCode = await codeFor(cookie, clientId, timely.challenge)
      clock = start + 599_999
      expect((await exchange(clientId, timelyCode, timely.verifier)).status).toBe(200)
    })

    it("refuses another client, another address, an unknown code and a wrong resource", async () => {
      const cookie = await sign(address())
      const clientId = await register([callback, "http://127.0.0.1:8123/other"])
      const stranger = await register()
      const { verifier, challenge } = verifierPair()
      const code = await codeFor(cookie, clientId, challenge)
      const other = await exchange(stranger, code, verifier)
      expect(other.json).toEqual({ error: "invalid_grant" })
      const moved = await exchange(clientId, code, verifier, { redirect_uri: "http://127.0.0.1:8123/other" })
      expect(moved.json).toEqual({ error: "invalid_grant" })
      const missing = await exchange(clientId, randomBytes(32).toString("base64url"), verifier)
      expect(missing.json).toEqual({ error: "invalid_grant" })
      const unknown = await exchange("nobody", code, verifier)
      expect(unknown.json).toEqual({ error: "invalid_client" })
      const target = await exchange(clientId, code, verifier, { resource: "https://other.example.test/mcp" })
      expect(target.status).toBe(400)
      expect(target.json).toEqual({ error: "invalid_target" })
      expect(await grantOf(clientId)).toMatchObject({ code: "open", generation: 0 })
      expect((await exchange(clientId, code, verifier)).status).toBe(200)
    })

    it("refuses a request that is not a token request", async () => {
      const reply = await askForm(base, "/oauth/token", { grant_type: "password" })
      expect(reply.json).toEqual({ error: "unsupported_grant_type" })
      const bare = await askForm(base, "/oauth/token", {})
      expect(bare.json).toEqual({ error: "invalid_request" })
      const partial = await askForm(base, "/oauth/token", { grant_type: "authorization_code", code: "x" })
      expect(partial.json).toEqual({ error: "invalid_request" })
      const json = await ask(base, "POST", "/oauth/token", { grant_type: "authorization_code" })
      expect(json.status).toBe(400)
      expect(json.json).toEqual({ error: "invalid_request" })
      for (const answer of [reply, bare, partial, json]) expect(answer.headers["cache-control"]).toBe("no-store")
    })
  })

  describe("token form", () => {
    it("refuses a verifier of 42 or 129 characters even when its challenge matches", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      for (const length of [42, 129]) {
        const verifier = "a".repeat(length)
        const challenge = createHash("sha256").update(verifier).digest("base64url")
        const code = await codeFor(cookie, clientId, challenge)
        const reply = await exchange(clientId, code, verifier)
        expect(reply.status).toBe(400)
        expect(reply.json).toEqual({ error: "invalid_grant" })
        expect(await works("none")).toBe(false)
      }
      expect(await count("oauth_token", "grant_id", "none")).toBe(0)
      const grants = await session.query<{ code: string }>(
        "select code from session.oauth_grant where client_id = $1",
        [clientId],
      )
      expect(grants.rows.map((row) => row.code)).toEqual(["open", "open"])
    })

    it("accepts a verifier of 43 and of 128 characters", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      for (const length of [43, 128]) {
        const verifier = "a".repeat(length)
        const challenge = createHash("sha256").update(verifier).digest("base64url")
        const code = await codeFor(cookie, clientId, challenge)
        expect((await exchange(clientId, code, verifier)).status).toBe(200)
      }
    })

    it("refuses a repeated form field", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      const { verifier, challenge } = verifierPair()
      const code = await codeFor(cookie, clientId, challenge)
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: clientId,
        redirect_uri: callback,
      })
      body.append("client_id", "another")
      const reply = await rawForm("/oauth/token", body.toString())
      expect(reply.status).toBe(400)
      expect(reply.json).toEqual({ error: "invalid_request" })
      expect(await grantOf(clientId)).toMatchObject({ code: "open", generation: 0 })
      expect((await exchange(clientId, code, verifier)).status).toBe(200)
    })

    it("refuses text that Postgres cannot store on the token and revoke routes", async () => {
      const bad = ["a\u0000", "\u0000"]
      for (const value of bad) {
        for (const fields of [
          { grant_type: "authorization_code", code: "c", code_verifier: "v", client_id: value, redirect_uri: callback },
          { grant_type: "refresh_token", refresh_token: "r", client_id: value },
          { grant_type: "refresh_token", refresh_token: value, client_id: "c" },
          { grant_type: "authorization_code", code: value, code_verifier: "v", client_id: "c", redirect_uri: callback },
          { grant_type: "authorization_code", code: "c", code_verifier: value, client_id: "c", redirect_uri: callback },
          { grant_type: "refresh_token", refresh_token: "r", client_id: "c", resource: value },
        ]) {
          const reply = await askForm(base, "/oauth/token", fields)
          expect(reply.status).toBe(400)
          expect(reply.json).toEqual({ error: "invalid_request" })
          expect(reply.headers["cache-control"]).toBe("no-store")
        }
        const revoked = await askForm(base, "/oauth/revoke", { token: value })
        expect(revoked.status).toBe(200)
        expect(revoked.json).toEqual({})
        expect(revoked.headers["cache-control"]).toBe("no-store")
      }
    })
  })

  describe("rotation", () => {
    it("gives a new pair and stops the old access token", async () => {
      const { clientId, pair, email } = await flow()
      const next = await rotate(clientId, pair.refresh, { resource: own })
      expect(next.status).toBe(200)
      expect(next.headers["cache-control"]).toBe("no-store")
      const second = tokensOf(next)
      expect(await works(pair.access)).toBe(false)
      expect(await bearerPrincipal(session, second.access, clock)).toEqual({ ok: true, principal: email })
      expect(await grantOf(clientId)).toMatchObject({ generation: 2, revoked: false })
      const kept = await session.query<{ generation: number }>(
        "select generation from session.oauth_token where hash = $1",
        [createHash("sha256").update(pair.refresh).digest("hex")],
      )
      expect(kept.rows[0]?.generation).toBe(1)
    })

    it("works five times in a row and replaying the first refresh token revokes the family", async () => {
      const { clientId, pair: first } = await flow()
      let previous = first
      for (let step = 0; step < 5; step += 1) {
        const reply = await rotate(clientId, previous.refresh)
        expect(reply.status).toBe(200)
        const current = tokensOf(reply)
        expect(await works(current.access)).toBe(true)
        expect(await works(previous.access)).toBe(false)
        previous = current
      }
      expect(await grantOf(clientId)).toMatchObject({ generation: 6, revoked: false })
      const replay = await rotate(clientId, first.refresh)
      expect(replay.status).toBe(400)
      expect(replay.json).toEqual({ error: "invalid_grant" })
      expect(await grantOf(clientId)).toMatchObject({ generation: 6, revoked: true })
      expect(await works(previous.access)).toBe(false)
      const newest = await rotate(clientId, previous.refresh)
      expect(newest.json).toEqual({ error: "invalid_grant" })
    })

    it("refuses an access token, another client and an unknown client as a refresh token", async () => {
      const { clientId, pair } = await flow()
      const stranger = await register()
      expect((await rotate(clientId, pair.access)).json).toEqual({ error: "invalid_grant" })
      expect((await rotate(stranger, pair.refresh)).json).toEqual({ error: "invalid_grant" })
      expect((await rotate("nobody", pair.refresh)).json).toEqual({ error: "invalid_client" })
      expect((await rotate(clientId, "unknown")).json).toEqual({ error: "invalid_grant" })
      expect((await rotate(clientId, pair.refresh, { resource: "https://other.example.test/mcp" })).json).toEqual({
        error: "invalid_target",
      })
      expect((await askForm(base, "/oauth/token", { grant_type: "refresh_token" })).json).toEqual({
        error: "invalid_request",
      })
      expect(await grantOf(clientId)).toMatchObject({ generation: 1, revoked: false })
      expect(await works(pair.access)).toBe(true)
    })
  })

  describe("revoke", () => {
    it("by the refresh token refuses both tokens", async () => {
      const { clientId, pair } = await flow()
      const reply = await askForm(base, "/oauth/revoke", { token: pair.refresh })
      expect(reply.status).toBe(200)
      expect(reply.json).toEqual({})
      expect(reply.headers["cache-control"]).toBe("no-store")
      expect(await grantOf(clientId)).toMatchObject({ revoked: true })
      expect(await works(pair.access)).toBe(false)
      expect((await rotate(clientId, pair.refresh)).json).toEqual({ error: "invalid_grant" })
    })

    it("by the access token refuses both tokens", async () => {
      const { clientId, pair } = await flow()
      expect((await askForm(base, "/oauth/revoke", { token: pair.access })).status).toBe(200)
      expect(await works(pair.access)).toBe(false)
      expect((await rotate(clientId, pair.refresh)).json).toEqual({ error: "invalid_grant" })
    })

    it("answers 200 for an unknown token, a repeat and no token", async () => {
      const { pair } = await flow()
      for (const fields of [{ token: "unknown" }, {}, { token: pair.refresh }, { token: pair.refresh }]) {
        const reply = await askForm(base, "/oauth/revoke", fields)
        expect(reply.status).toBe(200)
        expect(reply.json).toEqual({})
        expect(reply.headers["cache-control"]).toBe("no-store")
      }
      const json = await ask(base, "POST", "/oauth/revoke", { token: "x" })
      expect(json.status).toBe(200)
    })
  })

  describe("bearer principal", () => {
    it("answers the approving session's email", async () => {
      const { email, pair } = await flow()
      expect(await bearerPrincipal(session, pair.access, clock)).toEqual({ ok: true, principal: email })
    })

    it("refuses an access token past its hour", async () => {
      const { pair } = await flow()
      expect(await works(pair.access)).toBe(true)
      clock = start + 3_599_999
      expect(await works(pair.access)).toBe(true)
      clock = start + 3_600_000
      expect(await works(pair.access)).toBe(false)
    })

    it("refuses a refresh token as a bearer and an unknown string", async () => {
      const { pair } = await flow()
      expect(await works(pair.refresh)).toBe(false)
      expect(await works("unknown")).toBe(false)
      expect(await works("")).toBe(false)
    })
  })

  describe("identity", () => {
    it("is the approving session's email whatever the bodies say", async () => {
      const email = address()
      const cookie = await sign(email)
      const clientId = await register()
      const { verifier, challenge } = verifierPair()
      const impostor = {
        principal: "evil@example.com",
        email: "evil@example.com",
        sub: "evil@example.com",
        generation: 9,
      }
      const code = await codeFor(cookie, clientId, challenge, impostor)
      const first = await exchange(clientId, code, verifier, { ...impostor, generation: "5" })
      const pair = tokensOf(first)
      expect(await grantOf(clientId)).toEqual({ principal: email, code: "used", generation: 1, revoked: false })
      expect(await bearerPrincipal(session, pair.access, clock)).toEqual({ ok: true, principal: email })
      const next = await rotate(clientId, pair.refresh, { ...impostor, generation: "7" })
      const rotated = tokensOf(next)
      expect(await grantOf(clientId)).toEqual({ principal: email, code: "used", generation: 2, revoked: false })
      expect(await bearerPrincipal(session, rotated.access, clock)).toEqual({ ok: true, principal: email })
      const generations = await session.query<{ generation: number }>(
        "select t.generation from session.oauth_token t join session.oauth_grant g on g.id = t.grant_id where g.client_id = $1 order by t.generation",
        [clientId],
      )
      expect(generations.rows.map((row) => row.generation)).toEqual([1, 1, 2, 2])
    })
  })

  describe("secrets at rest", () => {
    it("stores no code, access token or refresh token as sent", async () => {
      const email = address()
      const cookie = await sign(email)
      const clientId = await register()
      const { verifier, challenge } = verifierPair()
      const code = await codeFor(cookie, clientId, challenge)
      const pair = tokensOf(await exchange(clientId, code, verifier))
      const next = tokensOf(await rotate(clientId, pair.refresh))
      for (const secret of [code, verifier, pair.access, pair.refresh, next.access, next.refresh]) {
        for (const table of ["oauth_client", "oauth_grant", "oauth_token"]) {
          const found = await session.query<{ count: number }>(
            `select count(*)::int as count from session.${table} t where position($1 in row_to_json(t)::text) > 0`,
            [secret],
          )
          expect(found.rows[0]?.count).toBe(0)
        }
      }
      const hashed = await session.query<{ count: number }>(
        "select count(*)::int as count from session.oauth_token where hash = $1",
        [createHash("sha256").update(next.refresh).digest("hex")],
      )
      expect(hashed.rows[0]?.count).toBe(1)
    })
  })

  describe("two requests at once", () => {
    it("two refreshes of one token leave no more than one refresh token that works", async () => {
      const { clientId, pair } = await flow()
      const side = await sideServer({ wrap: holdingTwoWrites })
      try {
        const fields = { grant_type: "refresh_token", refresh_token: pair.refresh, client_id: clientId }
        const [left, right] = await Promise.all([
          askForm(side.base, "/oauth/token", fields),
          askForm(side.base, "/oauth/token", fields),
        ])
        expect([left.status, right.status].sort()).toEqual([200, 400])
        const winner = tokensOf(left.status === 200 ? left : right)
        const loser = left.status === 200 ? right : left
        expect(loser.json).toEqual({ error: "invalid_grant" })
        expect(await grantOf(clientId)).toMatchObject({ generation: 2, revoked: true })
        expect(await works(winner.access)).toBe(false)
        expect((await rotate(clientId, winner.refresh)).json).toEqual({ error: "invalid_grant" })
        const rows = await session.query<{ count: number }>(
          "select count(*)::int as count from session.oauth_token t join session.oauth_grant g on g.id = t.grant_id where g.client_id = $1",
          [clientId],
        )
        expect(rows.rows[0]?.count).toBe(4)
      } finally {
        await side.close()
      }
    })

    it("two exchanges of one code issue tokens once", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      const { verifier, challenge } = verifierPair()
      const code = await codeFor(cookie, clientId, challenge)
      const side = await sideServer({ wrap: holdingTwoWrites })
      try {
        const fields = {
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          client_id: clientId,
          redirect_uri: callback,
        }
        const [left, right] = await Promise.all([
          askForm(side.base, "/oauth/token", fields),
          askForm(side.base, "/oauth/token", fields),
        ])
        expect([left.status, right.status].sort()).toEqual([200, 400])
        const winner = tokensOf(left.status === 200 ? left : right)
        expect((left.status === 200 ? right : left).json).toEqual({ error: "invalid_grant" })
        const rows = await session.query<{ kind: string }>(
          "select t.kind from session.oauth_token t join session.oauth_grant g on g.id = t.grant_id where g.client_id = $1 order by t.kind",
          [clientId],
        )
        expect(rows.rows.map((row) => row.kind)).toEqual(["access", "refresh"])
        expect(await grantOf(clientId)).toMatchObject({ code: "used", generation: 1, revoked: true })
        expect(await works(winner.access)).toBe(false)
      } finally {
        await side.close()
      }
    })
  })

  describe("a store that fails", () => {
    it("answers no-store and a bare server error on the token and revoke routes", async () => {
      const side = await sideServer({
        wrap: (pool) => intercepting(pool, () => Promise.reject(new Error("internal detail: relation oauth"))),
      })
      try {
        const token = await askForm(side.base, "/oauth/token", {
          grant_type: "refresh_token",
          refresh_token: "r",
          client_id: "c",
        })
        expect(token.status).toBe(500)
        expect(token.json).toEqual({ error: "server_error" })
        expect(token.headers["cache-control"]).toBe("no-store")
        expect(token.text).not.toContain("internal")
        const revoke = await askForm(side.base, "/oauth/revoke", { token: "t" })
        expect(revoke.status).toBe(500)
        expect(revoke.json).toEqual({ error: "server_error" })
        expect(revoke.headers["cache-control"]).toBe("no-store")
      } finally {
        await side.close()
      }
    })

    it("does not answer 200 for a revoke that loses every write", async () => {
      const { clientId, pair } = await flow()
      const side = await sideServer({
        wrap: (pool) =>
          intercepting(pool, (text) =>
            text.includes("update session.oauth_grant") ? Promise.resolve({ rows: [], rowCount: 0 }) : undefined,
          ),
      })
      try {
        for (const token of [pair.refresh, pair.access]) {
          const reply = await askForm(side.base, "/oauth/revoke", { token })
          expect(reply.status).toBe(503)
          expect(reply.json).toEqual({ error: "temporarily_unavailable" })
          expect(reply.headers["cache-control"]).toBe("no-store")
        }
        expect(await grantOf(clientId)).toMatchObject({ revoked: false })
        expect(await works(pair.access)).toBe(true)
        expect((await askForm(base, "/oauth/revoke", { token: pair.access })).status).toBe(200)
        expect(await works(pair.access)).toBe(false)
      } finally {
        await side.close()
      }
    })

    it("does not answer invalid_grant for a reuse revocation that loses every write", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      const { verifier, challenge } = verifierPair()
      const code = await codeFor(cookie, clientId, challenge)
      const first = tokensOf(await exchange(clientId, code, verifier))
      const side = await sideServer({
        wrap: (pool) =>
          intercepting(pool, (text) =>
            text.includes("update session.oauth_grant") ? Promise.resolve({ rows: [], rowCount: 0 }) : undefined,
          ),
      })
      try {
        const reply = await askForm(side.base, "/oauth/token", {
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          client_id: clientId,
          redirect_uri: callback,
        })
        expect(reply.status).toBe(503)
        expect(reply.json).toEqual({ error: "temporarily_unavailable" })
        expect(reply.headers["cache-control"]).toBe("no-store")
        expect(await grantOf(clientId)).toMatchObject({ revoked: false })
        expect(await works(first.access)).toBe(true)
      } finally {
        await side.close()
      }
    })
  })

  describe("a token request whose grant write is lost", () => {
    function losing(): (pool: Pool) => Pool {
      return (pool) =>
        intercepting(pool, (text) =>
          text.includes("update session.oauth_grant") ? Promise.resolve({ rows: [], rowCount: 0 }) : undefined,
        )
    }

    it("answers 503 for a replayed refresh token and leaves the grant live", async () => {
      const { clientId, pair: first } = await flow()
      const second = tokensOf(await rotate(clientId, first.refresh))
      const side = await sideServer({ wrap: losing() })
      try {
        const reply = await askForm(side.base, "/oauth/token", {
          grant_type: "refresh_token",
          refresh_token: first.refresh,
          client_id: clientId,
        })
        expect(reply.status).toBe(503)
        expect(reply.json).toEqual({ error: "temporarily_unavailable" })
        expect(reply.headers["cache-control"]).toBe("no-store")
        expect(await grantOf(clientId)).toMatchObject({ generation: 2, revoked: false })
        expect(await works(second.access)).toBe(true)
      } finally {
        await side.close()
      }
    })

    it("answers 503 for a good rotation and the old refresh token still works", async () => {
      const { clientId, pair } = await flow()
      const side = await sideServer({ wrap: losing() })
      try {
        const reply = await askForm(side.base, "/oauth/token", {
          grant_type: "refresh_token",
          refresh_token: pair.refresh,
          client_id: clientId,
        })
        expect(reply.status).toBe(503)
        expect(reply.json).toEqual({ error: "temporarily_unavailable" })
        expect(await grantOf(clientId)).toMatchObject({ generation: 1, revoked: false })
        expect(await works(pair.access)).toBe(true)
        expect((await rotate(clientId, pair.refresh)).status).toBe(200)
      } finally {
        await side.close()
      }
    })

    it("answers 503 for a first exchange and the code still works", async () => {
      const cookie = await sign(address())
      const clientId = await register()
      const { verifier, challenge } = verifierPair()
      const code = await codeFor(cookie, clientId, challenge)
      const side = await sideServer({ wrap: losing() })
      try {
        const reply = await askForm(side.base, "/oauth/token", {
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          client_id: clientId,
          redirect_uri: callback,
        })
        expect(reply.status).toBe(503)
        expect(reply.json).toEqual({ error: "temporarily_unavailable" })
        expect(await grantOf(clientId)).toMatchObject({ code: "open", generation: 0, revoked: false })
        expect((await exchange(clientId, code, verifier)).status).toBe(200)
      } finally {
        await side.close()
      }
    })
  })

  describe("start", () => {
    it("throws naming resource when it is missing or not https", () => {
      const unused = openPool("postgres://session@127.0.0.1/api")
      const base = {
        session: unused,
        deck: unused,
        listen: new DeckListen("postgres://listen@127.0.0.1/api"),
        send: async () => undefined,
        ...origins,
      }
      const missing: { resource: string } = JSON.parse("{}") as { resource: string }
      expect(() => createApi({ ...base, ...missing })).toThrow(/resource/)
      expect(() => createApi({ ...base, resource: "http://mcp.example.test/mcp" })).toThrow(/resource/)
      expect(() => createApi({ ...base, resource: "not a url" })).toThrow(/resource/)
    })
  })

  describe("stored grant", () => {
    it("gives the session role no delete on the oauth tables", async () => {
      for (const table of ["oauth_client", "oauth_grant", "oauth_token"]) {
        await expect(session.query(`delete from session.${table} where false`)).rejects.toThrow(/permission denied/)
      }
      await expect(session.query("delete from session.access where false")).resolves.toBeDefined()
    })

    it("refuses a code state that is not open or used", async () => {
      const clientId = await register()
      await expect(
        session.query(
          "insert into session.oauth_grant (id, principal, code, generation, revoked, client_id, redirect_uri, challenge, code_hash, code_expires) values ($1, 'a@example.com', 'bogus', 0, false, $2, 'x', 'y', $1, 0)",
          [randomBytes(8).toString("hex"), clientId],
        ),
      ).rejects.toThrow(/check/)
    })
  })
})
