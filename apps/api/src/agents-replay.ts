import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { agentKey } from "./agent-key.js"
import {
  account,
  clock,
  connected,
  deckOf,
  edit,
  granted,
  idleWindow,
  startAgents,
  stores,
  versionOf,
  x,
  type Account,
  type Agent,
  type Pairing,
} from "./agents-drive.js"
import { pathsFrom, specGraph, walks, type Graph, type Path, type SpecState } from "./spec-graph.js"

export const shareCount = 3

export type Numbered = { readonly walk: Path; readonly index: number }

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
  const found = await stores.deck.query<{ register: { elements: Record<string, Body> } }>(
    "select register from deck.saved where id = $1",
    [live.deck],
  )
  const body = found.rows[0]?.register.elements[x]
  const ver =
    body === undefined ? 0 : (body.version ?? body.landed.length + body.landed.filter((row) => !row.visible).length)
  const rows = await stores.session.query<{ agent: string; run_id: string | null; last_call: string }>(
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
      seen[name === "a" ? "liveA" : "liveB"] = clock.now - Number(row.last_call) < idleWindow
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
    await stores.session.query(
      "update session.agent_turn set last_call = last_call - $4 where email = $1 and deck = $2 and agent = $3",
      [live.owner.email, live.deck, live.keys[name], idleWindow],
    )
    live.who = "none"
    live.out = "none"
    return
  }
  throw new Error(`no step for ${action}`)
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

export function shareOf(covering: readonly Path[], share: number): readonly Numbered[] {
  return covering.map((walk, index) => ({ walk, index })).filter(({ index }) => index % shareCount === share)
}

export async function agentsWalks(): Promise<{ readonly graph: Graph; readonly covering: readonly Path[] }> {
  const graph = await specGraph("agents", "Agents")
  const paths = pathsFrom(graph, (state) => state.ver === 0 && state.holder === "none" && state.out === "none")
  expect(paths.size).toBe(graph.states.size)
  const outs = new Set([...graph.states.values()].map((state) => state.out))
  expect([...outs].toSorted()).toEqual(["held", "landed", "none", "run-fenced", "stale"])
  return { graph, covering: walks(graph, paths) }
}

export function replayShare(share: number): void {
  let stop = async () => {}

  beforeAll(async () => {
    stop = await startAgents()
  })

  afterAll(async () => {
    await stop()
  })

  describe(`agents replay, share ${String(share)} of ${String(shareCount)}`, () => {
    it("drives every edge of the agents model through POST /mcp, with two agents and with Aira and an agent", async () => {
      const { graph, covering } = await agentsWalks()
      const mine = shareOf(covering, share)
      const failures: string[] = []
      for (let at = 0; at < mine.length; at += 8) {
        const batch = mine.slice(at, at + 8)
        const told = await Promise.all(
          batch.map(({ walk, index }) => replayWalk(graph, walk, index % 2 === 0 ? "two agents" : "Aira and an agent")),
        )
        for (const line of told) if (line !== null) failures.push(line)
      }
      expect(failures.slice(0, 5)).toEqual([])
    }, 300_000)
  })
}
