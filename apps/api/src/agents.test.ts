import { randomBytes } from "node:crypto"

import { deckRoutes, mcpRoutes, oauthRoutes, signInRoutes } from "@airdesign/catalog"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { agentKey } from "./agent-key.js"
import { ask, askForm, cookieFrom, postgresInfo, serve, verifierPair } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { readSignInMail } from "./sign-in-mail.js"
import { pathsFrom, specGraph, type Graph, type Path, type SpecState } from "./spec-graph.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const idleWindow = 600_000
const x = "258.7"
const y = "258.8"

let base = ""
let deckSql: Sql
let sessionSql: Sql
let clock = 1_700_000_000_000
let held: { readonly opened: Promise<void>; armed: boolean } | undefined
const mails: Mail[] = []
const closers: (() => Promise<void>)[] = []

beforeAll(async () => {
  const info = await postgresInfo()
  const sessionPool = openPool(info.session, "agents-session")
  const deckPool = openPool(info.deck, "agents-deck")
  deckSql = deckPool
  sessionSql = sessionPool
  const deck = new Proxy(deckPool, {
    get(target, prop, receiver) {
      if (prop !== "query") return Reflect.get(target, prop, receiver)
      const query = target.query.bind(target) as (sql: unknown, params?: unknown[]) => Promise<unknown>
      return async (sql: unknown, params?: unknown[]) => {
        if (typeof sql === "string" && sql.includes("update deck.saved") && held?.armed === true) {
          held.armed = false
          await held.opened
        }
        return query(sql, params)
      }
    },
  }) as Sql
  const listen = new DeckListen(info.listen)
  const served = await serve({
    ...origins,
    session: sessionPool,
    deck,
    listen,
    now: () => clock,
    send: async (mail) => void mails.push(mail),
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

type Account = { readonly email: string; readonly cookie: string }

async function account(): Promise<Account> {
  const email = `agents${randomBytes(5).toString("hex")}@example.com`
  await ask(base, "POST", signInRoutes.email.path, { email })
  const mail = mails.find((sent) => sent.to === email)
  const { code } = readSignInMail(mail?.text ?? "")
  const signed = await ask(base, "POST", signInRoutes.code.path, { email, code })
  const cookie = cookieFrom(signed.headers)
  if (cookie === undefined) throw new Error("cookie")
  return { email, cookie }
}

async function grant(owner: Account, name: string): Promise<string> {
  return (await granted(owner, name)).token
}

async function granted(owner: Account, name: string): Promise<{ readonly token: string; readonly key: string }> {
  const redirectUri = `https://${name}.example/callback`
  const registered = await ask(base, "POST", oauthRoutes.register.path, {
    redirect_uris: [redirectUri],
    client_name: name,
  })
  const clientId = (registered.json as { client_id: string }).client_id
  const { verifier, challenge } = verifierPair()
  const approved = await ask(
    base,
    "POST",
    oauthRoutes.approve.path,
    { client_id: clientId, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: "S256" },
    owner.cookie,
  )
  const code = new URL((approved.json as { redirect: string }).redirect).searchParams.get("code") ?? ""
  const exchanged = await askForm(base, oauthRoutes.token.path, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  })
  const row = await sessionSql.query<{ id: string }>("select id from session.oauth_grant where client_id = $1", [
    clientId,
  ])
  return {
    token: (exchanged.json as { access_token: string }).access_token,
    key: agentKey("grant", row.rows[0]?.id ?? ""),
  }
}

type Answer = { readonly ok: boolean; readonly text: string; readonly body: Record<string, unknown> }

type Agent = {
  readonly call: (tool: string, args: Record<string, unknown>) => Promise<Answer>
}

async function connected(headers: Record<string, string>): Promise<Agent> {
  return {
    call: async (tool, args) => {
      const response = await fetch(`${base}${mcpRoutes.mcp.path}`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: `airdesign_${tool}`, arguments: args },
        }),
      })
      const text = await response.text()
      const line = text.startsWith("{")
        ? text
        : (text
            .split("\n")
            .find((each) => each.startsWith("data: "))
            ?.slice(6) ?? "")
      const result = (
        JSON.parse(line) as { result: { isError?: boolean; content: { text: string }[]; structuredContent?: unknown } }
      ).result
      return {
        ok: result.isError !== true,
        text: result.content[0]?.text ?? "",
        body: (result.structuredContent ?? {}) as Record<string, unknown>,
      }
    },
  }
}

type Pairing = "two agents" | "Aira and an agent"

async function agents(owner: Account, pairing: Pairing): Promise<readonly [Agent, Agent]> {
  const second = await connected({ authorization: `Bearer ${await grant(owner, "codex")}` })
  if (pairing === "Aira and an agent") return [await connected({ cookie: owner.cookie }), second]
  return [await connected({ authorization: `Bearer ${await grant(owner, "claude")}` }), second]
}

async function deckOf(owner: Account): Promise<string> {
  const id = `deck${randomBytes(5).toString("hex")}`
  await ask(base, "POST", deckRoutes.open.path, { deck: id }, owner.cookie)
  return id
}

function edit(deck: string, node: string, value: string, readAt: number) {
  return { deck, base: 0, changes: [{ node, value, readAt }] }
}

type Row = { readonly value: string; readonly visible: boolean; readonly runId?: string }

async function rows(deck: string, node: string): Promise<readonly Row[]> {
  const found = await deckSql.query<{ register: { elements: Record<string, { landed: readonly Row[] }> } }>(
    "select register from deck.saved where id = $1",
    [deck],
  )
  return found.rows[0]?.register.elements[node]?.landed ?? []
}

async function shown(deck: string, node: string): Promise<string | undefined> {
  return (await rows(deck, node)).filter((row) => row.visible).at(-1)?.value
}

async function turnRuns(owner: Account, deck: string): Promise<readonly (string | null)[]> {
  const found = await sessionSql.query<{ run_id: string | null }>(
    "select run_id from session.agent_turn where email = $1 and deck = $2 order by run_id",
    [owner.email, deck],
  )
  return found.rows.map((row) => row.run_id)
}

function versionOf(answer: Answer, node: string): number {
  const elements = (answer.body.elements ?? []) as readonly { readonly node: string; readonly version: number }[]
  const found = elements.find((element) => element.node === node)
  if (found === undefined) throw new Error(JSON.stringify(answer))
  return found.version
}

for (const pairing of ["two agents", "Aira and an agent"] as const) {
  describe(`${pairing} on one account`, () => {
    it("each work in their own run, with their own turn row, Stop and Undo", async () => {
      const owner = await account()
      const [first, second] = await agents(owner, pairing)
      const deck = await deckOf(owner)
      const a = await first.call("edit_deck", edit(deck, x, "first on x", 0))
      const b = await second.call("edit_deck", edit(deck, y, "second on y", 0))
      expect([a.text, b.text]).toEqual(["Landed revision 1.", "Landed revision 2."])
      expect(b.body.runId).not.toBe(a.body.runId)
      expect(await turnRuns(owner, deck)).toEqual([a.body.runId, b.body.runId].toSorted())

      const stopOther = await second.call("stop_run", { deck, runId: a.body.runId })
      expect([stopOther.ok, stopOther.body.refusal]).toEqual([false, "run-fenced"])
      const again = await first.call("edit_deck", edit(deck, x, "first again", 1))
      expect([again.text, again.body.runId]).toEqual(["Landed revision 3.", a.body.runId])

      const undone = await ask(base, "POST", deckRoutes.undo.path, { deck, runId: a.body.runId }, owner.cookie)
      expect(undone.status).toBe(200)
      expect(await shown(deck, x)).toBeUndefined()
      expect(await shown(deck, y)).toBe("second on y")
    })

    it("refuse an edit of an element the other agent's live turn holds, and stale once that turn ends", async () => {
      const owner = await account()
      const [first, second] = await agents(owner, pairing)
      const deck = await deckOf(owner)
      const read = await first.call("read_deck", { deck })
      expect(read.ok).toBe(true)
      const b = await second.call("edit_deck", edit(deck, x, "second wrote x", 0))
      expect(b.text).toBe("Landed revision 1.")
      const a = await first.call("edit_deck", edit(deck, x, "first wrote x on its old read", 0))
      expect([a.ok, a.body.refusal]).toEqual([false, "held"])
      expect(await shown(deck, x)).toBe("second wrote x")

      clock += idleWindow
      const late = await first.call("edit_deck", edit(deck, x, "first wrote x on its old read", 0))
      expect([late.ok, late.body.refusal]).toEqual([false, "stale"])
      expect(await shown(deck, x)).toBe("second wrote x")
      const fresh = await first.call("edit_deck", edit(deck, x, "first on a fresh read", versionOf(late, x)))
      expect(fresh.text).toBe("Landed revision 2.")
    })

    it("refuse an edit held at its deck write while the other agent takes the element", async () => {
      const owner = await account()
      const [first, second] = await agents(owner, pairing)
      const deck = await deckOf(owner)
      expect((await first.call("edit_deck", edit(deck, y, "first holds y", 0))).ok).toBe(true)
      let open = () => {}
      held = { opened: new Promise<void>((resolve) => (open = resolve)), armed: true }
      const pending = first.call("edit_deck", edit(deck, x, "first held at its write", 0))
      while (held.armed) await new Promise((resolve) => setTimeout(resolve, 10))
      const b = await second.call("edit_deck", edit(deck, x, "second wrote x meanwhile", 0))
      open()
      const a = await pending
      expect(b.text).toBe("Landed revision 2.")
      expect([a.ok, a.body.refusal]).toEqual([false, "held"])
      expect(await shown(deck, x)).toBe("second wrote x meanwhile")
    })
  })
}

describe("one grant from two connections", () => {
  it("is one agent: its calls share one run, as the server cannot tell the connections apart", async () => {
    const owner = await account()
    const token = await grant(owner, "claude")
    const [first, second] = await Promise.all([
      connected({ authorization: `Bearer ${token}` }),
      connected({ authorization: `Bearer ${token}` }),
    ])
    const deck = await deckOf(owner)
    const a = await first.call("edit_deck", edit(deck, x, "one connection", 0))
    const b = await second.call("edit_deck", edit(deck, y, "the other connection", 0))
    expect(b.body.runId).toBe(a.body.runId)
  })
})

describe("tool call limits", () => {
  it("give each agent its own thirty calls in five minutes and the account ninety", async () => {
    const owner = await account()
    const deck = await deckOf(owner)
    const tokens = await Promise.all(["one", "two", "three", "four"].map((name) => grant(owner, name)))
    const callers = await Promise.all(tokens.map((token) => connected({ authorization: `Bearer ${token}` })))
    const [one, two, three, four] = callers
    if (one === undefined || two === undefined || three === undefined || four === undefined) throw new Error("agents")
    for (let count = 0; count < 30; count += 1) expect((await one.call("read_deck", { deck })).ok).toBe(true)
    const thirtyFirst = await one.call("read_deck", { deck })
    expect(thirtyFirst.text).toMatch(/^Thirty tool calls in five minutes\./)
    for (const agent of [two, three]) {
      for (let count = 0; count < 30; count += 1) expect((await agent.call("read_deck", { deck })).ok).toBe(true)
    }
    const ninetyFirst = await four.call("read_deck", { deck })
    expect(ninetyFirst.text).toMatch(/^Ninety tool calls in five minutes from this account's agents\./)
  }, 60_000)
})

type Name = "a" | "b"

type Replay = {
  readonly owner: Account
  readonly deck: string
  readonly agents: Readonly<Record<Name, Agent>>
  readonly keys: Readonly<Record<Name, string>>
  readonly runs: Map<string, string>
  readonly read: Record<Name, number>
  out: string
  who: string
  overwrote: boolean
  mixed: boolean
  stoppedOther: boolean
}

type Seen = Record<string, string | number | boolean>

async function opened(pairing: Pairing): Promise<Replay> {
  const owner = await account()
  const b = await granted(owner, "codex")
  const a =
    pairing === "two agents" ? await granted(owner, "claude") : { token: undefined, key: agentKey("aira", owner.email) }
  const first = await connected(
    a.token === undefined ? { cookie: owner.cookie } : { authorization: `Bearer ${a.token}` },
  )
  const second = await connected({ authorization: `Bearer ${b.token}` })
  return {
    owner,
    deck: await deckOf(owner),
    agents: { a: first, b: second },
    keys: { a: a.key, b: b.key },
    runs: new Map(),
    read: { a: 0, b: 0 },
    out: "none",
    who: "none",
    overwrote: false,
    mixed: false,
    stoppedOther: false,
  }
}

function modelRun(live: Replay, runId: string | null | undefined): string {
  if (runId === null || runId === undefined) return "none"
  for (const [name, id] of live.runs) if (id === runId) return name
  return `unknown ${runId}`
}

async function observed(live: Replay): Promise<Seen> {
  type Body = { phase: string; runId: string | null; version?: number; landed: readonly { visible: boolean }[] }
  const found = await deckSql.query<{ register: { elements: Record<string, Body> } }>(
    "select register from deck.saved where id = $1",
    [live.deck],
  )
  const body = found.rows[0]?.register.elements[x]
  const ver =
    body === undefined ? 0 : (body.version ?? body.landed.length + body.landed.filter((row) => !row.visible).length)
  const rows = await sessionSql.query<{ agent: string; run_id: string | null; last_call: string }>(
    "select agent, run_id, last_call from session.agent_turn where email = $1 and deck = $2",
    [live.owner.email, live.deck],
  )
  const seen: Seen = {
    holder: body?.phase === "running" ? modelRun(live, body.runId) : "none",
    ver,
    readA: live.read.a,
    readB: live.read.b,
    usedA: [...live.runs.keys()].filter((name) => name.startsWith("a")).length,
    usedB: [...live.runs.keys()].filter((name) => name.startsWith("b")).length,
    out: live.out,
    who: live.who,
    overwrote: live.overwrote,
    mixed: live.mixed,
    stoppedOther: live.stoppedOther,
  }
  for (const name of ["a", "b"] as const) {
    const row = rows.rows.find((each) => each.agent === live.keys[name])
    const turn = modelRun(live, row?.run_id)
    seen[name === "a" ? "turnA" : "turnB"] = turn
    if (turn !== "none" && row !== undefined)
      seen[name === "a" ? "liveA" : "liveB"] = clock - Number(row.last_call) < idleWindow
  }
  return seen
}

function actor(action: string, from: SpecState, to: SpecState): Name {
  if (action === "AgentEdits" || action === "AgentStopsOther") return to.who === "a" ? "a" : "b"
  if (action === "AgentReads") return from.readA !== to.readA ? "a" : "b"
  if (action === "AgentStops") return from.turnA !== to.turnA ? "a" : "b"
  return from.liveA !== to.liveA ? "a" : "b"
}

function other(name: Name): Name {
  return name === "a" ? "b" : "a"
}

function turnOf(state: SpecState, name: Name): string {
  return String(name === "a" ? state.turnA : state.turnB)
}

async function act(live: Replay, action: string, from: SpecState, to: SpecState): Promise<void> {
  const name = actor(action, from, to)
  const agent = live.agents[name]
  if (action === "AgentReads") {
    const read = await agent.call("read_deck", { deck: live.deck })
    const elements = (read.body.elements ?? []) as readonly { readonly node: string; readonly version: number }[]
    live.read[name] = elements.find((element) => element.node === x)?.version ?? 0
    return
  }
  if (action === "AgentEdits") {
    const before = (await observed(live)).ver
    const answer = await agent.call("edit_deck", edit(live.deck, x, `${name} ${String(before)}`, live.read[name]))
    live.who = name
    live.out = answer.ok ? "landed" : String(answer.body.refusal)
    if (!answer.ok) return
    const runId = String(answer.body.runId)
    if (!runId.startsWith(`${live.keys[name]}-`)) live.mixed = true
    if (typeof before === "number" && live.read[name] < before) live.overwrote = true
    const turn = turnOf(to, name)
    if (!live.runs.has(turn) && ![...live.runs.values()].includes(runId)) live.runs.set(turn, runId)
    live.read[name] = versionOf(answer, x)
    return
  }
  if (action === "AgentStops" || action === "AgentStopsOther") {
    const named = live.runs.get(turnOf(from, action === "AgentStops" ? name : other(name)))
    const holder = (await observed(live)).holder
    const answer = await agent.call("stop_run", { deck: live.deck, runId: named })
    if (action === "AgentStopsOther") {
      live.who = name
      live.out = answer.ok ? "stopped" : String(answer.body.refusal)
      return
    }
    live.who = "none"
    live.out = "none"
    const after = (await observed(live)).holder
    if (typeof holder === "string" && holder.startsWith(other(name)) && after === "none") live.stoppedOther = true
    return
  }
  if (action === "Idle") {
    await sessionSql.query(
      "update session.agent_turn set last_call = last_call - $4 where email = $1 and deck = $2 and agent = $3",
      [live.owner.email, live.deck, live.keys[name], idleWindow],
    )
    live.who = "none"
    live.out = "none"
    return
  }
  throw new Error(`no step for ${action}`)
}

function walks(graph: Graph, paths: Map<string, Path>): readonly Path[] {
  const edges = graph.edges.filter((edge) => edge.action !== "Done")
  const left = new Set(edges)
  const covered = (from: string, step: { readonly action: string; readonly to: string }) => {
    for (const edge of left)
      if (edge.from === from && edge.action === step.action && edge.to === step.to) left.delete(edge)
  }
  const found: Path[] = []
  for (const first of edges) {
    if (!left.has(first)) continue
    const path = paths.get(first.from)
    if (path === undefined) throw new Error(`no path to ${first.from}`)
    const steps = [...path.steps, { action: first.action, to: first.to }]
    let at = path.root
    for (const step of steps) {
      covered(at, step)
      at = step.to
    }
    for (let next = edges.find((edge) => left.has(edge) && edge.from === at); next !== undefined;) {
      left.delete(next)
      steps.push({ action: next.action, to: next.to })
      at = next.to
      next = edges.find((edge) => left.has(edge) && edge.from === at)
    }
    found.push({ root: path.root, steps })
  }
  return found
}

async function replayWalk(graph: Graph, walk: Path, pairing: Pairing): Promise<string | null> {
  const root = graph.states.get(walk.root)
  if (root === undefined) return "no root"
  const live = await opened(pairing)
  let from = root
  for (const step of walk.steps) {
    const to = graph.states.get(step.to)
    if (to === undefined) return "no target"
    await act(live, step.action, from, to)
    if (step.action !== "AgentEdits" && step.action !== "AgentStopsOther") {
      live.who = "none"
      live.out = "none"
    }
    const seen = await observed(live)
    const wrong = Object.keys(seen).filter((key) => seen[key] !== to[key])
    if (wrong.length > 0)
      return `${pairing}: ${step.action} into ${JSON.stringify(to)}: ${wrong.map((key) => `${key} ${String(seen[key])}`).join(", ")}`
    from = to
  }
  return null
}

describe("agents replay", () => {
  it("drives every edge of the agents model through POST /mcp, with two agents and with Aira and an agent", async () => {
    const graph = await specGraph("agents", "Agents")
    const paths = pathsFrom(graph, (state) => state.ver === 0 && state.holder === "none" && state.out === "none")
    expect(paths.size).toBe(graph.states.size)
    const outs = new Set([...graph.states.values()].map((state) => state.out))
    expect([...outs].toSorted()).toEqual(["held", "landed", "none", "run-fenced", "stale"])
    const covering = walks(graph, paths)
    const failures: string[] = []
    for (let at = 0; at < covering.length; at += 8) {
      const batch = covering.slice(at, at + 8)
      const told = await Promise.all(
        batch.map((walk, index) => replayWalk(graph, walk, index % 2 === 0 ? "two agents" : "Aira and an agent")),
      )
      for (const line of told) if (line !== null) failures.push(line)
    }
    expect(failures.slice(0, 5)).toEqual([])
  }, 300_000)
})
