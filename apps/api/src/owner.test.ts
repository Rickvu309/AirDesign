import { randomBytes } from "node:crypto"

import { readDeckId } from "@airdesign/catalog"
import { editNext } from "@airdesign/mcp"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, askForm, signInByCode, verifierPair, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { same, specGraph, type SpecState, type Value } from "./spec-graph.js"

const own = "https://mcp.example.test/mcp"
const callback = "http://127.0.0.1:8124/owner"
const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const element = "258.7"
const captureNext = "Open the deck in AirDesign, then try again."
const invalidToken =
  'Bearer resource_metadata="https://mcp.example.test/.well-known/oauth-protected-resource", error="invalid_token"'

type Pair = { readonly access: string; readonly refresh: string }
type Stored = { readonly revision: number; readonly register: unknown; readonly owner: string }
type Called = {
  readonly status: number
  readonly text: string
  readonly challenge: string | null
  readonly answer?: { readonly refusal?: string }
  readonly last?: string
}
type Credential = { readonly cookie: string } | { readonly bearer: string; readonly scheme?: string }
type Claim = { readonly headers?: Record<string, string>; readonly args?: Record<string, string> }
const claimFields = ["account", "email", "principal", "sub"] as const

function deckName(): string {
  const named = readDeckId(`deck${randomBytes(4).toString("hex")}`)
  if (!named.ok) throw new Error(named.refusal)
  return named.deck
}

function address(mark: string): string {
  return `${mark}${randomBytes(4).toString("hex")}@example.com`
}

describe("only a deck's owner acts on it", () => {
  const mails: Mail[] = []
  const start = 1_000_000
  let clock = start
  let base = ""
  let session: Sql = openPool("postgres://session@127.0.0.1/api")
  let deck: Sql = openPool("postgres://deck@127.0.0.1/api")
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    session = openPool(info.session, "owner-session")
    deck = openPool(info.deck, "owner-deck")
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

  const sign = (email: string): Promise<string> => signInByCode(base, mails, email)

  async function register(): Promise<string> {
    const reply = await ask(base, "POST", "/oauth/register", { redirect_uris: [callback] })
    const id = (reply.json as { client_id?: string }).client_id
    if (reply.status !== 201 || id === undefined) throw new Error(reply.text)
    return id
  }

  async function approve(cookie: string, clientId: string, challenge: string): Promise<string> {
    const reply = await ask(
      base,
      "POST",
      "/oauth/approve",
      { client_id: clientId, redirect_uri: callback, code_challenge: challenge, code_challenge_method: "S256" },
      cookie,
    )
    const redirect = (reply.json as { redirect?: string }).redirect
    if (redirect === undefined) throw new Error(reply.text)
    const code = new URL(redirect).searchParams.get("code")
    if (code === null) throw new Error(redirect)
    return code
  }

  async function exchange(clientId: string, code: string, verifier: string): Promise<Pair | undefined> {
    const reply = await askForm(base, "/oauth/token", {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: clientId,
      redirect_uri: callback,
    })
    return pairOf(reply.json)
  }

  async function rotate(clientId: string, refresh: string): Promise<Pair | undefined> {
    const reply = await askForm(base, "/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: clientId,
    })
    return pairOf(reply.json)
  }

  function pairOf(json: unknown): Pair | undefined {
    const body = json as { access_token?: string; refresh_token?: string } | undefined
    if (body?.access_token === undefined || body.refresh_token === undefined) return undefined
    return { access: body.access_token, refresh: body.refresh_token }
  }

  async function connection(email: string): Promise<{ readonly cookie: string; readonly pair: Pair }> {
    const cookie = await sign(email)
    const clientId = await register()
    const { verifier, challenge } = verifierPair()
    const pair = await exchange(clientId, await approve(cookie, clientId, challenge), verifier)
    if (pair === undefined) throw new Error("exchange")
    return { cookie, pair }
  }

  async function opened(cookie: string): Promise<string> {
    const id = deckName()
    const reply = await ask(base, "POST", "/decks/open", { deck: id }, cookie)
    if (reply.status !== 200) throw new Error(reply.text)
    return id
  }

  async function row(id: string): Promise<Stored | undefined> {
    const result = await deck.query<Stored>("select revision, register, owner from deck.saved where id = $1", [id])
    return result.rows[0]
  }

  function claimOf(email: string): Claim {
    return {
      headers: { "x-airdesign-account": email },
      args: Object.fromEntries(claimFields.map((field) => [field, email])),
    }
  }

  async function call(
    credential: Credential,
    name: string,
    args: Record<string, unknown>,
    claim: Claim = {},
  ): Promise<Called> {
    const response = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...claim.headers,
        ...("cookie" in credential
          ? { cookie: credential.cookie }
          : { authorization: `${credential.scheme ?? "Bearer"} ${credential.bearer}` }),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: { ...claim.args, ...args } },
      }),
    })
    const body = await response.text()
    const challenge = response.headers.get("www-authenticate")
    if (response.status !== 200) return { status: response.status, text: body, challenge }
    const data = body
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice("data: ".length)
    const parsed = JSON.parse(data ?? body) as {
      result?: { content?: { text?: string }[]; structuredContent?: { refusal?: string } }
    }
    const content = parsed.result?.content ?? []
    const answered = parsed.result?.structuredContent
    return {
      status: response.status,
      text: content[0]?.text ?? body,
      challenge,
      ...(answered === undefined ? {} : { answer: answered }),
      ...(content.length > 1 ? { last: content.at(-1)?.text ?? "" } : {}),
    }
  }

  async function edit(credential: Credential, id: string, claim: Claim = {}) {
    const revision = (await row(id))?.revision ?? 0
    return call(
      credential,
      "airdesign_edit_deck",
      {
        deck: id,
        base: revision,
        changes: [{ value: `v${String(revision + 1)}`, node: `${element}${String(revision)}`, readAt: 0 }],
      },
      claim,
    )
  }

  function capture(credential: Credential, id: string, claim: Claim = {}) {
    return call(credential, "airdesign_capture_slide", { deck: id }, claim)
  }

  function editRefusalOf(called: Called): string | undefined {
    const parsed = JSON.parse(called.last ?? "{}") as { refusal?: string }
    expect(parsed.refusal).toBe(called.answer?.refusal)
    const code = called.answer?.refusal
    if (code === undefined || !Object.hasOwn(editNext, code)) return called.text
    expect(called.text).toBe(editNext[code as keyof typeof editNext])
    return code
  }

  function captureRefusalOf(called: Called): string | undefined {
    expect(called.answer).toBeUndefined()
    if (called.text === editNext.owner) return "owner"
    if (called.text === editNext.deck) return "deck"
    return called.text
  }

  describe("a credential of one account on another account's deck", () => {
    it("refuses an access token of A on B's deck with owner for an edit and a capture", async () => {
      const a = await connection(address("tokena"))
      const b = await sign(address("tokenb"))
      const id = await opened(b)
      const before = await row(id)
      expect(editRefusalOf(await edit({ bearer: a.pair.access }, id))).toBe("owner")
      expect(captureRefusalOf(await capture({ bearer: a.pair.access }, id))).toBe("owner")
      expect(await row(id)).toEqual(before)
    })

    it("refuses a session cookie of A on B's deck with owner for an edit and a capture", async () => {
      const a = await sign(address("cookiea"))
      const b = await sign(address("cookieb"))
      const id = await opened(b)
      const before = await row(id)
      expect(editRefusalOf(await edit({ cookie: a }, id))).toBe("owner")
      expect(captureRefusalOf(await capture({ cookie: a }, id))).toBe("owner")
      expect(await row(id)).toEqual(before)
    })

    it("lands an access token of A on A's own deck", async () => {
      const a = await connection(address("ownera"))
      const id = await opened(a.cookie)
      expect((await edit({ bearer: a.pair.access }, id)).text).toBe("Landed revision 1.")
      expect((await capture({ bearer: a.pair.access }, id)).text).toBe(captureNext)
      expect((await row(id))?.revision).toBe(1)
    })

    it("refuses a deck that does not exist yet with deck and creates nothing", async () => {
      const a = await connection(address("unmade"))
      const id = deckName()
      expect(editRefusalOf(await edit({ bearer: a.pair.access }, id))).toBe("deck")
      expect(captureRefusalOf(await capture({ bearer: a.pair.access }, id))).toBe("deck")
      expect(editRefusalOf(await edit({ cookie: a.cookie }, id))).toBe("deck")
      expect(await row(id)).toBeUndefined()
    })
  })

  describe("an account the caller claims", () => {
    it("acts as the account behind A's token, not one claimed in a header or an argument, on B's deck", async () => {
      const a = await connection(address("claima"))
      const bEmail = address("claimb")
      const b = await sign(bEmail)
      const id = await opened(b)
      const before = await row(id)
      const whole = claimOf(bEmail)
      const claims: Claim[] = [
        { headers: whole.headers ?? {} },
        ...claimFields.map((field) => ({ args: { [field]: bEmail } })),
        whole,
      ]
      for (const claim of claims) {
        expect(editRefusalOf(await edit({ bearer: a.pair.access }, id, claim))).toBe("owner")
        expect(captureRefusalOf(await capture({ bearer: a.pair.access }, id, claim))).toBe("owner")
        expect(editRefusalOf(await edit({ cookie: a.cookie }, id, claim))).toBe("owner")
      }
      expect(await row(id)).toEqual(before)
    })
  })

  describe("the bearer scheme", () => {
    it("accepts bearer and BEARER as the scheme", async () => {
      const a = await connection(address("scheme"))
      const own = await opened(a.cookie)
      const other = await opened(await sign(address("schemeb")))
      const before = await row(other)
      expect((await edit({ bearer: a.pair.access, scheme: "bearer" }, own)).text).toBe("Landed revision 1.")
      expect((await edit({ bearer: a.pair.access, scheme: "BEARER" }, own)).text).toBe("Landed revision 2.")
      expect(editRefusalOf(await edit({ bearer: a.pair.access, scheme: "BEARER" }, other))).toBe("owner")
      expect(await row(other)).toEqual(before)
    })
  })

  describe("a bearer that is not live", () => {
    it("answers 401 invalid_token and runs no tool for a revoked, rotated-out, refresh or unknown token", async () => {
      const email = address("dead")
      const cookie = await sign(email)
      const id = await opened(cookie)
      const clientId = await register()
      const { verifier, challenge } = verifierPair()
      const first = await exchange(clientId, await approve(cookie, clientId, challenge), verifier)
      if (first === undefined) throw new Error("exchange")
      const second = await rotate(clientId, first.refresh)
      if (second === undefined) throw new Error("rotate")
      const before = await row(id)
      const revokedPair = await connection(email)
      expect((await askForm(base, "/oauth/revoke", { token: revokedPair.pair.refresh })).status).toBe(200)
      for (const bearer of [first.access, second.refresh, revokedPair.pair.access, "unknown", ""]) {
        for (const answer of [await edit({ bearer }, id), await capture({ bearer }, id)]) {
          expect({ status: answer.status, challenge: answer.challenge }).toEqual({
            status: 401,
            challenge: invalidToken,
          })
        }
      }
      expect(await row(id)).toEqual(before)
      expect((await edit({ bearer: second.access }, id)).text).toBe("Landed revision 1.")
    })

    it("never falls back to the cookie when a bearer is sent", async () => {
      const cookie = await sign(address("fallback"))
      const id = await opened(cookie)
      const response = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          cookie,
          authorization: "Bearer unknown",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "airdesign_capture_slide", arguments: { deck: id } },
        }),
      })
      expect(response.status).toBe(401)
      expect(response.headers.get("www-authenticate")).toBe(invalidToken)
    })
  })

  describe("a dead bearer beside the owner's own cookie", () => {
    it("answers 401 invalid_token for a revoked, rotated-out, expired or refresh token with B's cookie", async () => {
      const email = address("deadwithcookie")
      const cookie = await sign(email)
      const id = await opened(cookie)
      const clientId = await register()
      const { verifier, challenge } = verifierPair()
      const first = await exchange(clientId, await approve(cookie, clientId, challenge), verifier)
      if (first === undefined) throw new Error("exchange")
      const second = await rotate(clientId, first.refresh)
      if (second === undefined) throw new Error("rotate")
      const revoked = await connection(email)
      expect((await askForm(base, "/oauth/revoke", { token: revoked.pair.refresh })).status).toBe(200)
      const before = await row(id)
      const beside = { headers: { cookie } }
      const refused = async (bearer: string) => {
        for (const answer of [await edit({ bearer }, id, beside), await capture({ bearer }, id, beside)]) {
          expect({ status: answer.status, challenge: answer.challenge }).toEqual({
            status: 401,
            challenge: invalidToken,
          })
        }
      }
      await refused(revoked.pair.access)
      await refused(first.access)
      await refused(second.refresh)
      clock = start + 3_600_000
      try {
        await refused(second.access)
      } finally {
        clock = start
      }
      expect(await row(id)).toEqual(before)
      expect((await edit({ cookie }, id)).text).toBe("Landed revision 1.")
    })
  })

  describe("the OnlyOwnerActs spec", () => {
    type Account = "a" | "b"
    type Party = {
      readonly email: string
      readonly cookie: string
      clientId?: string
      verifier?: string
      code?: string
      readonly access: Map<number, string>
      readonly refresh: Map<number, string>
    }
    type Step =
      | { readonly action: "Register" | "Approve" | "Exchange" | "ExchangeAgain"; readonly account: Account }
      | { readonly action: "Rotate" | "ReplayRotated" | "Revoke"; readonly account: Account }
      | {
          readonly action: "CookieCall"
          readonly account: Account
          readonly deck: string
          readonly claim?: Account
          readonly tool?: "capture"
        }
      | {
          readonly action: "TokenCall" | "TokenRefused"
          readonly account: Account
          readonly generation: number
          readonly deck: string
          readonly claim?: Account
          readonly tool?: "capture"
        }
      | { readonly action: "RefreshAsBearer"; readonly account: Account; readonly generation: number }

    function next(state: SpecState, step: Step): SpecState {
      const suffix = step.account === "a" ? "A" : "B"
      const code = state[`code${suffix}`]
      const generation = Number(state[`generation${suffix}`])
      const grant = (values: { code: string; generation: number; revoked: boolean }) => ({
        ...state,
        [`code${suffix}`]: values.code,
        [`generation${suffix}`]: values.generation,
        [`revoked${suffix}`]: values.revoked,
      })
      const owner = (deck: string) => (deck === "deckA" ? "a" : deck === "deckB" ? "b" : "nobody")
      const called = (deck: string, claim: Account) => {
        const outcome = deck === "unmade" ? "deck" : owner(deck) === step.account ? "landed" : "owner"
        const landed = outcome === "landed"
        return {
          ...state,
          callHolder: landed ? step.account : "nobody",
          callClaim: landed ? claim : "nobody",
          callAccount: landed ? step.account : "nobody",
          callDeck: deck,
          callOutcome: outcome,
        }
      }
      const refused = {
        ...state,
        callHolder: "nobody",
        callClaim: "nobody",
        callAccount: "nobody",
        callDeck: "none",
        callOutcome: "invalid",
      }
      if (step.action === "Register") return grant({ code: "client", generation: 0, revoked: false })
      if (step.action === "Approve") return grant({ code: "open", generation: 0, revoked: false })
      if (step.action === "Exchange") return grant({ code: "used", generation: 1, revoked: false })
      if (step.action === "Rotate") return grant({ code: "used", generation: generation + 1, revoked: false })
      if (step.action === "CookieCall" || step.action === "TokenCall")
        return called(step.deck, step.claim ?? step.account)
      if (step.action === "TokenRefused" || step.action === "RefreshAsBearer") return refused
      if (typeof code !== "string") throw new Error("code")
      return grant({ code, generation, revoked: true })
    }

    it("replays traces of the spec through POST /mcp and the OAuth routes", async () => {
      const graph = await specGraph("owner", "Owner")
      const initial = [...graph.states.entries()].find(
        ([, state]) => state.codeA === "none" && state.codeB === "none" && state.callOutcome === "none",
      )
      if (initial === undefined) throw new Error("initial")
      const traces: readonly (readonly Step[])[] = [
        [
          { action: "CookieCall", account: "a", deck: "deckA" },
          { action: "CookieCall", account: "a", deck: "deckB" },
          { action: "CookieCall", account: "b", deck: "unmade" },
          { action: "Register", account: "a" },
          { action: "Approve", account: "a" },
          { action: "Exchange", account: "a" },
          { action: "TokenCall", account: "a", generation: 1, deck: "deckA" },
          { action: "TokenCall", account: "a", generation: 1, deck: "deckB" },
          { action: "TokenCall", account: "a", generation: 1, deck: "deckB", claim: "b" },
          { action: "CookieCall", account: "a", deck: "deckB", claim: "b", tool: "capture" },
          { action: "TokenCall", account: "a", generation: 1, deck: "deckA", claim: "b", tool: "capture" },
          { action: "TokenCall", account: "a", generation: 1, deck: "unmade" },
          { action: "RefreshAsBearer", account: "a", generation: 1 },
          { action: "Rotate", account: "a" },
          { action: "TokenRefused", account: "a", generation: 1, deck: "deckA" },
          { action: "TokenCall", account: "a", generation: 2, deck: "deckA" },
          { action: "Register", account: "b" },
          { action: "Approve", account: "b" },
          { action: "Exchange", account: "b" },
          { action: "TokenCall", account: "b", generation: 1, deck: "deckA" },
          { action: "TokenCall", account: "b", generation: 1, deck: "deckB" },
          { action: "TokenCall", account: "b", generation: 1, deck: "deckB", claim: "a" },
          { action: "ReplayRotated", account: "a" },
          { action: "TokenRefused", account: "a", generation: 2, deck: "deckA" },
          { action: "CookieCall", account: "a", deck: "deckA" },
          { action: "Revoke", account: "b" },
          { action: "TokenRefused", account: "b", generation: 1, deck: "deckB" },
          { action: "CookieCall", account: "b", deck: "deckB" },
        ],
        [
          { action: "Register", account: "b" },
          { action: "Approve", account: "b" },
          { action: "Exchange", account: "b" },
          { action: "TokenCall", account: "b", generation: 1, deck: "deckA" },
          { action: "ExchangeAgain", account: "b" },
          { action: "TokenRefused", account: "b", generation: 1, deck: "deckB" },
          { action: "CookieCall", account: "b", deck: "deckA" },
        ],
      ]
      const failures: string[] = []
      for (const [index, trace] of traces.entries()) {
        const parties: Record<Account, Party> = {
          a: { email: "", cookie: "", access: new Map(), refresh: new Map() },
          b: { email: "", cookie: "", access: new Map(), refresh: new Map() },
        }
        for (const account of ["a", "b"] as const) {
          const email = address(`replay${String(index)}${account}`)
          parties[account] = { email, cookie: await sign(email), access: new Map(), refresh: new Map() }
        }
        const decks: Record<string, string> = {
          deckA: await opened(parties.a.cookie),
          deckB: await opened(parties.b.cookie),
          unmade: deckName(),
        }
        let state = initial[1]
        let id = initial[0]
        for (const step of trace) {
          const expected = next(state, step)
          const edge = graph.edges.find((item) => item.from === id && same(graph.states.get(item.to), expected))
          if (edge === undefined) {
            failures.push(
              `trace ${String(index)} ${step.action} is not a step of the spec from ${JSON.stringify(state)}`,
            )
            break
          }
          const rows = await Promise.all(Object.values(decks).map((value) => row(value)))
          const outcome = await act(parties, decks, step)
          const after = await Promise.all(Object.values(decks).map((value) => row(value)))
          const where = `trace ${String(index)} ${step.action} ${JSON.stringify(step)}`
          if (outcome !== undefined && outcome !== expected.callOutcome) {
            failures.push(`${where} answered ${outcome}, the spec says ${String(expected.callOutcome)}`)
          }
          const edited = !("tool" in step && step.tool === "capture")
          const landedOn = outcome === "landed" && edited && "deck" in step ? decks[step.deck] : undefined
          for (const [position, value] of Object.values(decks).entries()) {
            const was = rows[position]
            const now = after[position]
            if (value === landedOn) {
              if (now?.revision !== (was?.revision ?? -1) + 1) failures.push(`${where} did not land on ${value}`)
            } else if (!same(was, now)) failures.push(`${where} changed ${value}`)
          }
          const stored = await storedState(parties, decks)
          const grants = Object.fromEntries(Object.entries(expected).filter(([key]) => !key.startsWith("call")))
          if (!same(stored, grants)) {
            failures.push(`${where} stored ${JSON.stringify(stored)}, the spec says ${JSON.stringify(grants)}`)
          }
          state = expected
          id = edge.to
        }
      }
      expect(failures).toEqual([])
    }, 20_000)

    function claimFor(parties: Record<Account, Party>, step: Step): Claim {
      if (!("claim" in step) || step.claim === undefined) return {}
      const whole = claimOf(parties[step.claim].email)
      const own = step.deck === (step.account === "a" ? "deckA" : "deckB")
      return own ? { headers: whole.headers ?? {} } : whole
    }

    async function act(
      parties: Record<Account, Party>,
      decks: Record<string, string>,
      step: Step,
    ): Promise<string | undefined> {
      const party = parties[step.account]
      if (step.action === "Register") {
        party.clientId = await register()
        return undefined
      }
      if (step.action === "Approve") {
        const { verifier, challenge } = verifierPair()
        party.verifier = verifier
        party.code = await approve(party.cookie, party.clientId ?? "", challenge)
        return undefined
      }
      if (step.action === "Exchange" || step.action === "ExchangeAgain") {
        const pair = await exchange(party.clientId ?? "", party.code ?? "", party.verifier ?? "")
        if (pair !== undefined) {
          party.access.set(1, pair.access)
          party.refresh.set(1, pair.refresh)
        }
        return undefined
      }
      if (step.action === "Rotate" || step.action === "ReplayRotated" || step.action === "Revoke") {
        const generation = Math.max(...party.refresh.keys())
        const used = step.action === "ReplayRotated" ? generation - 1 : generation
        const refresh = party.refresh.get(used) ?? ""
        if (step.action === "Revoke") {
          await askForm(base, "/oauth/revoke", { token: refresh })
          return undefined
        }
        const pair = await rotate(party.clientId ?? "", refresh)
        if (pair !== undefined) {
          party.access.set(generation + 1, pair.access)
          party.refresh.set(generation + 1, pair.refresh)
        }
        return undefined
      }
      const target = "deck" in step ? (decks[step.deck] ?? "") : (decks.deckA ?? "")
      if (step.action !== "CookieCall" && !("generation" in step)) throw new Error(step.action)
      const credential =
        step.action === "CookieCall"
          ? { cookie: party.cookie }
          : {
              bearer:
                (step.action === "RefreshAsBearer" ? party.refresh : party.access).get(step.generation) ?? "unknown",
            }
      const claimed = claimFor(parties, step)
      const answer =
        "tool" in step && step.tool === "capture"
          ? await capture(credential, target, claimed)
          : await edit(credential, target, claimed)
      if (answer.status === 401)
        return answer.challenge === invalidToken ? "invalid" : `401 ${String(answer.challenge)}`
      if (answer.text.startsWith("Landed revision") || answer.text === captureNext) return "landed"
      return "tool" in step && step.tool === "capture" ? captureRefusalOf(answer) : editRefusalOf(answer)
    }

    async function storedState(
      parties: Record<Account, Party>,
      decks: Record<string, string>,
    ): Promise<Record<string, Value>> {
      const stored: Record<string, Value> = {}
      for (const account of ["a", "b"] as const) {
        const party = parties[account]
        const suffix = account === "a" ? "A" : "B"
        const result = await session.query<{
          principal: string
          code: string
          generation: number
          revoked: boolean
        }>("select principal, code, generation, revoked from session.oauth_grant where client_id = $1", [
          party.clientId ?? "",
        ])
        const grant = result.rows[0]
        stored[`code${suffix}`] = party.clientId === undefined ? "none" : (grant?.code ?? "client")
        stored[`generation${suffix}`] = grant?.generation ?? 0
        stored[`revoked${suffix}`] = grant?.revoked ?? false
        if (grant !== undefined && grant.principal !== party.email) stored[`principal${suffix}`] = grant.principal
      }
      const owners = [(await row(decks.deckA ?? ""))?.owner, (await row(decks.deckB ?? ""))?.owner]
      if (!same(owners, [parties.a.email, parties.b.email])) stored.owners = JSON.stringify(owners)
      if ((await row(decks.unmade ?? "")) !== undefined) stored.unmade = "created"
      return stored
    }
  })
})
