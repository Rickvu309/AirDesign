import { spawn } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import path from "node:path"

import { readDeckId } from "@airdesign/catalog"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, askForm, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const own = "https://mcp.example.test/mcp"
const callback = "http://127.0.0.1:8124/owner"
const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const element = "258.7"
const captureNext = "Open the deck in AirDesign, then try again."
const invalidToken = 'Bearer error="invalid_token"'

type Pair = { readonly access: string; readonly refresh: string }
type Stored = { readonly revision: number; readonly register: unknown; readonly owner: string }
type Called = { readonly status: number; readonly text: string; readonly challenge: string | null }
type Value = boolean | number | string
type SpecState = Record<string, Value>
type Graph = {
  readonly states: Map<string, SpecState>
  readonly edges: readonly { readonly from: string; readonly to: string; readonly action: string }[]
}

function deckName(): string {
  const named = readDeckId(`deck${randomBytes(4).toString("hex")}`)
  if (!named.ok) throw new Error(named.refusal)
  return named.deck
}

function address(mark: string): string {
  return `${mark}${randomBytes(4).toString("hex")}@example.com`
}

function verifierPair(): { readonly verifier: string; readonly challenge: string } {
  const verifier = randomBytes(32).toString("base64url")
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") }
}

function parseValue(raw: string): Value {
  if (raw === "TRUE") return true
  if (raw === "FALSE") return false
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1)
  const number = Number(raw)
  if (Number.isNaN(number)) throw new Error(`bad value ${raw}`)
  return number
}

function parseDot(dot: string): Graph {
  const states = new Map<string, SpecState>()
  const edges: { from: string; to: string; action: string }[] = []
  for (const line of dot.split("\n")) {
    const node = /^(-?\d+) \[label="(.*)"(?:,style = filled)?\]?;?$/.exec(line)
    if (node?.[1] !== undefined && node[2] !== undefined) {
      const label = node[2].replaceAll("\\\\", "\\").replaceAll("\\n", "\n").replaceAll('\\"', '"')
      const state: SpecState = {}
      for (const part of label.split("\n")) {
        const matched = /^\/\\ (\w+) = (.+)$/.exec(part)
        if (matched?.[1] === undefined || matched[2] === undefined) throw new Error(`bad state line ${part}`)
        state[matched[1]] = parseValue(matched[2])
      }
      states.set(node[1], state)
      continue
    }
    const edge = /^(-?\d+) -> (-?\d+) \[label="([^"]+)"/.exec(line)
    if (edge?.[1] !== undefined && edge[2] !== undefined && edge[3] !== undefined) {
      edges.push({ from: edge[1], to: edge[2], action: edge[3] })
    }
  }
  return { states, edges }
}

function ownerGraph(): Promise<Graph> {
  const specifier = new URL(`file://${path.join(process.cwd(), "scripts/check-specs.mjs")}`).href
  const topic = path.join(process.cwd(), "specs/owner")
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module"], { stdio: ["pipe", "pipe", "pipe"] })
    let out = ""
    let err = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      out += chunk
    })
    child.stderr.on("data", (chunk: string) => {
      err += chunk
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(err || out))
      else resolve(parseDot(out))
    })
    child.stdin.end(
      `import { dumpSpec, javaBin, jarPath } from ${JSON.stringify(specifier)}\nprocess.stdout.write(dumpSpec(${JSON.stringify(topic)}, javaBin(), jarPath(), "Owner.tla", "Owner.cfg").graph)\n`,
    )
  })
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right))
}

function sorted(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
}

describe("only a deck's owner acts on it", () => {
  const mails: Mail[] = []
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
      now: () => 1_000_000,
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

  async function sign(email: string): Promise<string> {
    const index = mails.length
    await ask(base, "POST", "/sign-in/email", { email })
    const code = mails[index]?.text.split("\n")[1]
    const signed = await ask(base, "POST", "/sign-in/code", { email, code })
    const cookie = cookieFrom(signed.headers)
    if (cookie === undefined) throw new Error("cookie")
    return cookie
  }

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

  async function call(
    credential: { readonly cookie: string } | { readonly bearer: string },
    name: string,
    args: Record<string, unknown>,
  ): Promise<Called> {
    const response = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...("cookie" in credential ? { cookie: credential.cookie } : { authorization: `Bearer ${credential.bearer}` }),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    })
    const body = await response.text()
    const challenge = response.headers.get("www-authenticate")
    if (response.status !== 200) return { status: response.status, text: body, challenge }
    const data = body
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice("data: ".length)
    const parsed = JSON.parse(data ?? body) as { result?: { content?: { text?: string }[] } }
    return { status: response.status, text: parsed.result?.content?.[0]?.text ?? body, challenge }
  }

  async function edit(credential: { readonly cookie: string } | { readonly bearer: string }, id: string) {
    const revision = (await row(id))?.revision ?? 0
    return call(credential, "airdesign_edit_deck", {
      deck: id,
      base: revision,
      changes: [{ value: `v${String(revision + 1)}`, node: element, readAt: revision }],
    })
  }

  function capture(credential: { readonly cookie: string } | { readonly bearer: string }, id: string) {
    return call(credential, "airdesign_capture_slide", { deck: id })
  }

  describe("a credential of one account on another account's deck", () => {
    it("refuses an access token of A on B's deck with owner for an edit and a capture", async () => {
      const a = await connection(address("tokena"))
      const b = await sign(address("tokenb"))
      const id = await opened(b)
      const before = await row(id)
      expect((await edit({ bearer: a.pair.access }, id)).text).toBe("owner")
      expect((await capture({ bearer: a.pair.access }, id)).text).toBe("owner")
      expect(await row(id)).toEqual(before)
    })

    it("refuses a session cookie of A on B's deck with owner for an edit and a capture", async () => {
      const a = await sign(address("cookiea"))
      const b = await sign(address("cookieb"))
      const id = await opened(b)
      const before = await row(id)
      expect((await edit({ cookie: a }, id)).text).toBe("owner")
      expect((await capture({ cookie: a }, id)).text).toBe("owner")
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
      expect((await edit({ bearer: a.pair.access }, id)).text).toBe("deck")
      expect((await capture({ bearer: a.pair.access }, id)).text).toBe("deck")
      expect((await edit({ cookie: a.cookie }, id)).text).toBe("deck")
      expect(await row(id)).toBeUndefined()
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
      | { readonly action: "CookieCall"; readonly account: Account; readonly deck: string }
      | {
          readonly action: "TokenCall" | "TokenRefused"
          readonly account: Account
          readonly generation: number
          readonly deck: string
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
      const called = (deck: string) => ({
        ...state,
        callAccount: step.account,
        callDeck: deck,
        callOutcome: deck === "unmade" ? "deck" : owner(deck) === step.account ? "landed" : "owner",
      })
      const refused = { ...state, callAccount: "nobody", callDeck: "none", callOutcome: "invalid" }
      if (step.action === "Register") return grant({ code: "client", generation: 0, revoked: false })
      if (step.action === "Approve") return grant({ code: "open", generation: 0, revoked: false })
      if (step.action === "Exchange") return grant({ code: "used", generation: 1, revoked: false })
      if (step.action === "Rotate") return grant({ code: "used", generation: generation + 1, revoked: false })
      if (step.action === "CookieCall" || step.action === "TokenCall") return called(step.deck)
      if (step.action === "TokenRefused" || step.action === "RefreshAsBearer") return refused
      if (typeof code !== "string") throw new Error("code")
      return grant({ code, generation, revoked: true })
    }

    it("replays traces of the spec through POST /mcp and the OAuth routes", async () => {
      const graph = await ownerGraph()
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
          const landedOn = outcome === "landed" && "deck" in step ? decks[step.deck] : undefined
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
      const answer = await edit(credential, target)
      if (answer.status === 401)
        return answer.challenge === invalidToken ? "invalid" : `401 ${String(answer.challenge)}`
      if (answer.text.startsWith("Landed revision")) return "landed"
      return answer.text
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
