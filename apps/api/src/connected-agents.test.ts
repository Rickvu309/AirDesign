import { accountRoutes, mcpRoutes, oauthRoutes, signInRoutes } from "@airdesign/catalog"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, askForm, cookieFrom, postgresInfo, serve, testResource, verifierPair } from "./testing/harness.js"
import { readSignInMail } from "./account/testing/read-sign-in-mail.js"

type AgentRow = {
  readonly id: string
  readonly name: string | null
  readonly agent: "claude" | "claude-code" | "codex" | "other"
  readonly host: string
  readonly connected: string
}

type ListedAgents = {
  readonly ok: true
  readonly account: { readonly email: string }
  readonly mcp: string
  readonly agents: readonly AgentRow[]
}

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }

describe("connected agents routes", () => {
  let base = ""
  let sessionSql: Sql
  let clock = 1_700_000_000_000
  const mails: Mail[] = []
  const closers: (() => Promise<void>)[] = []

  beforeAll(async () => {
    const info = await postgresInfo()
    const sessionPool = openPool(info.session)
    const deckPool = openPool(info.deck)
    sessionSql = sessionPool
    const listen = new DeckListen(info.listen)
    const served = await serve({
      ...origins,
      session: sessionPool,
      deck: deckPool,
      listen,
      now: () => clock,
      send: async (mail) => {
        mails.push(mail)
      },
    })
    base = served.base
    closers.push(
      () => served.close(),
      () => listen.close(),
      () => sessionPool.end(),
      () => deckPool.end(),
    )
  })

  afterAll(async () => {
    for (const close of closers) await close()
  })

  async function signIn(email: string): Promise<string> {
    const index = mails.length
    await ask(base, "POST", signInRoutes.email.path, { email })
    const { code } = readSignInMail(mails[index]?.text ?? "")
    const signed = await ask(base, "POST", signInRoutes.code.path, { email, code })
    const cookie = cookieFrom(signed.headers)
    if (cookie === undefined) throw new Error("cookie")
    return cookie
  }

  it("requires a name for a new account and saves it only for its session", async () => {
    const cookie = await signIn("name-owner@example.com")
    const other = await signIn("name-other@example.com")
    expect((await ask(base, "POST", "/account/profile", {}, cookie)).json).toEqual({
      ok: true,
      account: { email: "name-owner@example.com", name: null },
    })
    expect((await ask(base, "POST", "/account/name", { name: "  Nguyễn Quân  " }, cookie)).status).toBe(200)
    expect((await ask(base, "POST", "/account/profile", {}, cookie)).json).toEqual({
      ok: true,
      account: { email: "name-owner@example.com", name: "Nguyễn Quân" },
    })
    expect((await ask(base, "POST", "/account/profile", {}, other)).json).toMatchObject({ account: { name: null } })
    for (const name of ["", "  ", "x".repeat(101), "Ada\nLovelace"])
      expect((await ask(base, "POST", "/account/name", { name }, cookie)).status).toBe(400)
    expect((await ask(base, "POST", "/account/name", { name: "Intruder" })).status).toBe(401)
    expect((await ask(base, "POST", "/account/profile", {}, cookie)).json).toMatchObject({
      account: { name: "Nguyễn Quân" },
    })
    const again = await signIn("name-owner@example.com")
    expect((await ask(base, "POST", "/account/profile", {}, again)).json).toMatchObject({
      account: { name: "Nguyễn Quân" },
    })
  })

  async function registerClient(redirectUri: string, name?: string): Promise<string> {
    const registered = await ask(base, "POST", oauthRoutes.register.path, {
      redirect_uris: [redirectUri],
      ...(name === undefined ? {} : { client_name: name }),
    })
    return (registered.json as { client_id: string }).client_id
  }

  async function approveOnly(cookie: string, clientId: string, redirectUri: string) {
    const { verifier, challenge } = verifierPair()
    const approved = await ask(
      base,
      "POST",
      oauthRoutes.approve.path,
      {
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: "S256",
      },
      cookie,
    )
    const code = new URL((approved.json as { redirect: string }).redirect).searchParams.get("code") ?? ""
    return { code, verifier }
  }

  async function connectAgent(
    cookie: string,
    redirectUri: string,
    name?: string,
  ): Promise<{ clientId: string; access: string; refresh: string }> {
    const clientId = await registerClient(redirectUri, name)
    const { code, verifier } = await approveOnly(cookie, clientId, redirectUri)
    const exchanged = await askForm(base, oauthRoutes.token.path, {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: clientId,
      redirect_uri: redirectUri,
    })
    const tokens = exchanged.json as { access_token: string; refresh_token: string }
    return { clientId, access: tokens.access_token, refresh: tokens.refresh_token }
  }

  async function mcpCall(access: string): Promise<{ status: number; json: unknown }> {
    const response = await fetch(`${base}${mcpRoutes.mcp.path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${access}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })
    const text = await response.text()
    const isJson = response.headers.get("content-type")?.includes("application/json") === true
    return { status: response.status, json: isJson && text !== "" ? (JSON.parse(text) as unknown) : undefined }
  }

  it("lists only the caller's live grants with their registered name, known agent, connected time, id, and MCP address", async () => {
    const alice = await signIn("alice-agents@example.com")
    const bob = await signIn("bob-agents@example.com")

    clock = 1_700_000_010_000
    await connectAgent(alice, "https://claude.ai/api/mcp/auth_callback", "Claude")

    clock = 1_700_000_020_000
    const custom = await connectAgent(alice, "http://127.0.0.1:8124/cb")

    clock = 1_700_000_090_000
    const rotated = await askForm(base, oauthRoutes.token.path, {
      grant_type: "refresh_token",
      refresh_token: custom.refresh,
      client_id: custom.clientId,
    })
    expect(rotated.status).toBe(200)

    clock = 1_700_000_030_000
    const unexchangedClient = await registerClient("http://127.0.0.1:1455/auth/callback", "Codex")
    await approveOnly(alice, unexchangedClient, "http://127.0.0.1:1455/auth/callback")

    clock = 1_700_000_040_000
    await connectAgent(bob, "http://localhost:9001/callback", "Claude Code")

    const aliceList = await ask(base, "POST", accountRoutes.agents.path, {}, alice)
    expect(aliceList.status).toBe(200)
    const aliceBody = aliceList.json as ListedAgents
    expect(aliceBody.ok).toBe(true)
    expect(aliceBody.account).toEqual({ email: "alice-agents@example.com" })
    expect(aliceBody.mcp).toBe(testResource)
    expect(aliceBody.agents).toEqual([
      {
        id: expect.any(String),
        name: null,
        agent: "other",
        host: "127.0.0.1:8124",
        connected: new Date(1_700_000_020_000).toISOString(),
      },
      {
        id: expect.any(String),
        name: "Claude",
        agent: "claude",
        host: "claude.ai",
        connected: new Date(1_700_000_010_000).toISOString(),
      },
    ])

    const bobList = await ask(base, "POST", accountRoutes.agents.path, {}, bob)
    expect(bobList.status).toBe(200)
    expect(bobList.json).toEqual({
      ok: true,
      account: { email: "bob-agents@example.com" },
      mcp: testResource,
      agents: [
        {
          id: expect.any(String),
          name: "Claude Code",
          agent: "claude-code",
          host: "localhost:9001",
          connected: new Date(1_700_000_040_000).toISOString(),
        },
      ],
    })
  })

  it("reads the MCP address from options.resource rather than inventing one", async () => {
    const info = await postgresInfo()
    const pool = openPool(info.session)
    const deck = openPool(info.deck)
    const listen = new DeckListen(info.listen)
    const localMails: Mail[] = []
    const configured = "https://configured-mcp.example.test/mcp"
    const custom = await serve({
      ...origins,
      session: pool,
      deck,
      listen,
      resource: configured,
      send: async (mail) => {
        localMails.push(mail)
      },
    })
    try {
      await ask(custom.base, "POST", signInRoutes.email.path, { email: "resource@example.com" })
      const { code } = readSignInMail(localMails[0]?.text ?? "")
      const signed = await ask(custom.base, "POST", signInRoutes.code.path, { email: "resource@example.com", code })
      const cookie = cookieFrom(signed.headers)
      const listed = await ask(custom.base, "POST", accountRoutes.agents.path, {}, cookie)
      expect(listed.status).toBe(200)
      expect(listed.json).toEqual({
        ok: true,
        account: { email: "resource@example.com" },
        mcp: configured,
        agents: [],
      })
    } finally {
      await custom.close()
      await listen.close()
      await pool.end()
      await deck.end()
    }
  })

  it("revokes one grant immediately on /mcp and /oauth/token, keeps other grants live, and is safe to call twice", async () => {
    const owner = await signIn("revoke-owner@example.com")
    clock = 1_700_000_100_000
    const codex = await connectAgent(owner, "http://127.0.0.1:1455/auth/callback", "Codex")
    clock = 1_700_000_200_000
    const claude = await connectAgent(owner, "https://claude.ai/api/mcp/auth_callback", "Claude")

    expect((await mcpCall(codex.access)).status).toBe(200)
    expect((await mcpCall(claude.access)).status).toBe(200)

    const before = (await ask(base, "POST", accountRoutes.agents.path, {}, owner)).json as ListedAgents
    const codexRow = before.agents.find((row) => row.agent === "codex")
    const claudeRow = before.agents.find((row) => row.agent === "claude")
    if (codexRow === undefined || claudeRow === undefined) throw new Error("missing rows")

    const firstRevoke = await ask(base, "POST", accountRoutes.revokeAgent.path, { id: codexRow.id }, owner)
    expect([firstRevoke.status, firstRevoke.json]).toEqual([200, { ok: true }])

    const afterMcp = await mcpCall(codex.access)
    expect([afterMcp.status, afterMcp.json]).toEqual([401, { error: "invalid_token" }])

    const afterRefresh = await askForm(base, oauthRoutes.token.path, {
      grant_type: "refresh_token",
      refresh_token: codex.refresh,
      client_id: codex.clientId,
    })
    expect([afterRefresh.status, afterRefresh.json]).toEqual([400, { error: "invalid_grant" }])

    expect((await mcpCall(claude.access)).status).toBe(200)

    const after = (await ask(base, "POST", accountRoutes.agents.path, {}, owner)).json as ListedAgents
    expect(after.agents.map((row) => row.id)).toEqual([claudeRow.id])

    const secondRevoke = await ask(base, "POST", accountRoutes.revokeAgent.path, { id: codexRow.id }, owner)
    expect([secondRevoke.status, secondRevoke.json]).toEqual([200, { ok: true }])
    expect((await mcpCall(claude.access)).status).toBe(200)
  })

  it("refuses revoking another person's grant or an unknown id and changes nothing", async () => {
    const first = await signIn("first-isolation@example.com")
    const second = await signIn("second-isolation@example.com")
    clock = 1_700_000_300_000
    const secondGrant = await connectAgent(second, "https://claude.ai/api/mcp/auth_callback", "Claude")
    const secondListed = (await ask(base, "POST", accountRoutes.agents.path, {}, second)).json as ListedAgents
    const targetId = secondListed.agents[0]?.id
    if (targetId === undefined) throw new Error("missing grant")

    const beforeRow = await sessionSql.query("select * from session.oauth_grant where id = $1", [targetId])

    const crossAttempt = await ask(base, "POST", accountRoutes.revokeAgent.path, { id: targetId }, first)
    expect([crossAttempt.status, crossAttempt.json]).toEqual([403, { ok: false, refusal: "owner" }])

    const missingAttempt = await ask(base, "POST", accountRoutes.revokeAgent.path, { id: "unknown-grant-id" }, first)
    expect([missingAttempt.status, missingAttempt.json]).toEqual([403, { ok: false, refusal: "owner" }])

    const afterRow = await sessionSql.query("select * from session.oauth_grant where id = $1", [targetId])
    expect(afterRow.rows).toEqual(beforeRow.rows)
    expect((await mcpCall(secondGrant.access)).status).toBe(200)
    const rotated = await askForm(base, oauthRoutes.token.path, {
      grant_type: "refresh_token",
      refresh_token: secondGrant.refresh,
      client_id: secondGrant.clientId,
    })
    expect(rotated.status).toBe(200)
  })

  it("refuses bearer tokens, missing sessions, and malformed bodies on both routes", async () => {
    const owner = await signIn("bearer-refused@example.com")
    clock = 1_700_000_400_000
    const agent = await connectAgent(owner, "https://claude.ai/api/mcp/auth_callback", "Claude")
    const listed = (await ask(base, "POST", accountRoutes.agents.path, {}, owner)).json as ListedAgents
    const grantId = listed.agents[0]?.id
    if (grantId === undefined) throw new Error("missing grant")

    const bearerList = await ask(base, "POST", accountRoutes.agents.path, {}, undefined, {
      authorization: `Bearer ${agent.access}`,
    })
    expect([bearerList.status, bearerList.json]).toEqual([401, { ok: false, refusal: "session" }])

    const bearerWithCookieList = await ask(base, "POST", accountRoutes.agents.path, {}, owner, {
      authorization: `Bearer ${agent.access}`,
    })
    expect([bearerWithCookieList.status, bearerWithCookieList.json]).toEqual([401, { ok: false, refusal: "session" }])

    const bearerRevoke = await ask(base, "POST", accountRoutes.revokeAgent.path, { id: grantId }, undefined, {
      authorization: `Bearer ${agent.access}`,
    })
    expect([bearerRevoke.status, bearerRevoke.json]).toEqual([401, { ok: false, refusal: "session" }])

    const bearerWithCookieRevoke = await ask(base, "POST", accountRoutes.revokeAgent.path, { id: grantId }, owner, {
      authorization: `Bearer ${agent.access}`,
    })
    expect([bearerWithCookieRevoke.status, bearerWithCookieRevoke.json]).toEqual([
      401,
      { ok: false, refusal: "session" },
    ])

    const unsignedList = await ask(base, "POST", accountRoutes.agents.path, {})
    expect([unsignedList.status, unsignedList.json]).toEqual([401, { ok: false, refusal: "session" }])

    const unsignedRevoke = await ask(base, "POST", accountRoutes.revokeAgent.path, { id: grantId })
    expect([unsignedRevoke.status, unsignedRevoke.json]).toEqual([401, { ok: false, refusal: "session" }])

    const extraFieldList = await ask(base, "POST", accountRoutes.agents.path, { extra: 1 }, owner)
    expect([extraFieldList.status, extraFieldList.json]).toEqual([400, { ok: false, refusal: "field" }])

    const emptyIdRevoke = await ask(base, "POST", accountRoutes.revokeAgent.path, { id: "" }, owner)
    expect([emptyIdRevoke.status, emptyIdRevoke.json]).toEqual([400, { ok: false, refusal: "field" }])

    const textTypeList = await fetch(`${base}${accountRoutes.agents.path}`, {
      method: "POST",
      headers: { "content-type": "text/plain", cookie: owner },
      body: "{}",
    })
    expect([textTypeList.status, await textTypeList.json()]).toEqual([400, { ok: false, refusal: "field" }])

    expect((await mcpCall(agent.access)).status).toBe(200)
  })
})
