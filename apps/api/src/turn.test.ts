import { randomBytes } from "node:crypto"

import { readDeckId } from "@airdesign/catalog"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, signInByCode, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { same, specGraph, type SpecState } from "./spec-graph.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }
const nodes = { x: "258.7", y: "258.8" } as const
const idleWindow = 600_000

const slideTools = ["add_slide", "add_text_box", "delete_element"] as const
const spare = Array.from({ length: 8 }, (_, count) => `258.${String(20 + count)}`)

type SlideTool = (typeof slideTools)[number]
type Name = keyof typeof nodes
type Action = "TurnStart" | "AgentEdit" | "SlideStart" | "SlideInTurn" | "PersonEdit" | "Stop" | "Idle" | "Refused"
type Step = { readonly action: Action; readonly element?: Name; readonly refusal?: "stale" | "unknown" }
type Stored = {
  readonly revision: number
  readonly register: {
    readonly elements: Record<
      string,
      {
        readonly phase: string
        readonly guarded: boolean
        readonly runId: string | null
        readonly landed: readonly { readonly visible: boolean }[]
      }
    >
    readonly order?: readonly { readonly id?: string; readonly runId?: string }[]
  }
}
type Reply = {
  readonly ok: boolean
  readonly runId?: string
  readonly slide?: string
  readonly refusal?: string
}
type Seen = { readonly outcome: string; readonly landedOn: string; readonly runId?: string; readonly slide?: string }

const traces: readonly (readonly Step[])[] = [
  [
    { action: "TurnStart", element: "x" },
    { action: "AgentEdit", element: "x" },
    { action: "PersonEdit", element: "x" },
    { action: "AgentEdit", element: "x" },
    { action: "Refused", refusal: "unknown" },
    { action: "AgentEdit", element: "x" },
    { action: "Refused", refusal: "stale", element: "y" },
    { action: "AgentEdit", element: "x" },
    { action: "AgentEdit", element: "y" },
    { action: "PersonEdit", element: "y" },
    { action: "Stop" },
    { action: "TurnStart", element: "x" },
    { action: "PersonEdit", element: "y" },
    { action: "Stop" },
    { action: "TurnStart", element: "y" },
    { action: "PersonEdit", element: "y" },
    { action: "Idle" },
    { action: "Refused", refusal: "unknown" },
    { action: "PersonEdit", element: "y" },
    { action: "TurnStart", element: "x" },
    { action: "AgentEdit", element: "y" },
  ],
  [
    { action: "SlideStart" },
    { action: "AgentEdit", element: "x" },
    { action: "PersonEdit", element: "x" },
    { action: "SlideInTurn" },
    { action: "AgentEdit", element: "x" },
    { action: "Stop" },
    { action: "SlideStart" },
    { action: "AgentEdit", element: "y" },
    { action: "Idle" },
  ],
  [
    { action: "TurnStart", element: "y" },
    { action: "PersonEdit", element: "x" },
    { action: "AgentEdit", element: "x" },
    { action: "PersonEdit", element: "y" },
    { action: "Idle" },
    { action: "TurnStart", element: "y" },
    { action: "PersonEdit", element: "y" },
    { action: "AgentEdit", element: "y" },
  ],
  [
    { action: "TurnStart", element: "x" },
    { action: "Idle" },
    { action: "SlideStart" },
    { action: "SlideInTurn" },
    { action: "AgentEdit", element: "y" },
  ],
]

function stateOf(stored: Stored | undefined, name: Name): string {
  const body = stored?.register.elements[nodes[name]]
  if (body === undefined || body.phase === "idle") return "idle"
  if (body.phase !== "running") return "ended"
  return body.guarded ? "closed" : "open"
}

function versionOf(stored: Stored | undefined, name: Name): number {
  return stored?.register.elements[nodes[name]]?.landed.filter((row) => row.visible).length ?? 0
}

function runRows(stored: Stored | undefined, seen: Seen): readonly (string | null | undefined)[] {
  const held = (Object.keys(nodes) as Name[])
    .filter((name) => ["open", "closed"].includes(stateOf(stored, name)))
    .map((name) => stored?.register.elements[nodes[name]]?.runId)
  const slide = seen.slide === undefined ? [] : [stored?.register.order?.find((row) => row.id === seen.slide)?.runId]
  return [...held, ...slide, seen.runId]
}

function matches(state: SpecState | undefined, stored: Stored | undefined, seen: Seen): boolean {
  return (
    state?.stateX === stateOf(stored, "x") &&
    state.stateY === stateOf(stored, "y") &&
    state.outcome === seen.outcome &&
    state.landedOn === seen.landedOn
  )
}

describe("a person closes an element for the rest of a turn", () => {
  const mails: Mail[] = []
  let clock = 1_000_000
  let base = ""
  let deck: Sql = openPool("postgres://deck@127.0.0.1/api")
  let session: Sql = openPool("postgres://session@127.0.0.1/api")
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    session = openPool(info.session, "turn-session")
    deck = openPool(info.deck, "turn-deck")
    const listen = new DeckListen(info.listen)
    const served = await serve({
      ...origins,
      session,
      deck,
      listen,
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

  async function row(id: string): Promise<Stored | undefined> {
    const result = await deck.query<Stored>("select revision, register from deck.saved where id = $1", [id])
    return result.rows[0]
  }

  async function turnRow(id: string): Promise<string | null | undefined> {
    const result = await session.query<{ run_id: string | null }>(
      "select run_id from session.agent_turn where deck = $1",
      [id],
    )
    return result.rows[0]?.run_id
  }

  async function replay(
    trace: readonly Step[],
    index: number,
    failures: string[],
    tool: SlideTool = "add_slide",
  ): Promise<void> {
    const graph = await specGraph("turn", "Turn")
    const initial = [...graph.states.entries()].find(
      ([, state]) =>
        state.turn === "none" && state.stateX === "idle" && state.stateY === "idle" && state.outcome === "none",
    )
    if (initial === undefined) throw new Error("initial")
    const named = readDeckId(`deck${randomBytes(4).toString("hex")}`)
    if (!named.ok) throw new Error(named.refusal)
    const id = named.deck
    const cookie = await sign(`turn${String(index)}${randomBytes(4).toString("hex")}@example.com`)
    await ask(base, "POST", "/decks/open", { deck: id }, cookie)
    const floor = { kind: "shape", value: "", box: null, grouped: false }
    await ask(
      base,
      "POST",
      "/decks/index",
      {
        deck: id,
        once: "turn-index",
        offset: 0,
        total: 2 + spare.length,
        slides: [
          {
            id: "258",
            position: 0,
            size: { width: 12192000, height: 6858000 },
            free: 40,
            animated: [],
            layout: [],
          },
        ],
        elements: [
          { node: nodes.x, ...floor },
          { node: nodes.y, ...floor },
          ...spare.map((node) => ({ node, ...floor })),
        ],
      },
      cookie,
    )
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { cookie } },
    })
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(transport)
    let runId = ""
    let written = 0
    let deleted = 0

    async function called(name: string, args: Record<string, unknown>): Promise<Reply> {
      const result = await client.callTool({ name, arguments: args })
      return result.structuredContent as Reply
    }

    async function edited(name: Name, stored: Stored | undefined, readAt: number): Promise<Reply> {
      written += 1
      const value = `agent${String(written)}`
      return called("airdesign_edit_deck", {
        deck: id,
        base: stored?.revision ?? 0,
        changes: [{ value, node: nodes[name], readAt }],
      })
    }

    async function act(step: Step, stored: Stored | undefined): Promise<Seen> {
      const none = { outcome: "none", landedOn: "none" }
      if (step.action === "Idle") {
        clock += idleWindow
        return none
      }
      if (step.action === "PersonEdit") {
        const node = nodes[step.element ?? "x"]
        await ask(base, "POST", "/decks/commit", { deck: id, batch: [{ value: "person", node }] }, cookie)
        return none
      }
      if (step.action === "Stop") {
        const answer = await called("airdesign_stop_run", { deck: id, runId })
        return { outcome: answer.ok ? "ended" : (answer.refusal ?? "none"), landedOn: "none" }
      }
      if (step.action === "Refused") {
        const answer =
          step.refusal === "stale"
            ? await edited(step.element ?? "x", stored, 99)
            : await called("airdesign_stop_run", { deck: id, runId: "unknown" })
        return { outcome: answer.ok ? "landed" : "refused", landedOn: "none" }
      }
      if (step.action === "SlideStart" || step.action === "SlideInTurn") {
        const base = stored?.revision ?? 0
        const inputs = {
          add_slide: { after: "258", layout: "258" },
          add_text_box: { slide: "258", box: { x: 0, y: 0, cx: 100, cy: 100 } },
          delete_element: { node: spare[deleted++] },
        }
        const answer = await called(`airdesign_${tool}`, { deck: id, base, ...inputs[tool] })
        if (!answer.ok) return { outcome: answer.refusal ?? "none", landedOn: "none" }
        runId = answer.runId ?? ""
        return {
          outcome: "landed",
          landedOn: "none",
          runId,
          ...(answer.slide === undefined ? {} : { slide: answer.slide }),
        }
      }
      const name = step.element ?? "x"
      const answer = await edited(name, stored, versionOf(stored, name))
      if (!answer.ok) return { outcome: answer.refusal ?? "none", landedOn: "none" }
      runId = answer.runId ?? ""
      return { outcome: "landed", landedOn: name, runId }
    }

    const opened = new Set<string>()
    let turnRun = ""
    try {
      let at = initial[0]
      for (const [position, step] of trace.entries()) {
        const before = await row(id)
        const seen = await act(step, before)
        const after = await row(id)
        const where = `trace ${String(index)} step ${String(position)} ${JSON.stringify(step)}`
        const edge = graph.edges.find(
          (item) => item.from === at && item.action === step.action && matches(graph.states.get(item.to), after, seen),
        )
        if (edge === undefined) {
          failures.push(
            `${where} did ${JSON.stringify(seen)}, x ${stateOf(after, "x")}, y ${stateOf(after, "y")}, which the spec does not allow from ${JSON.stringify(graph.states.get(at))}`,
          )
          return
        }
        const refused = seen.outcome === "refused" || seen.outcome === "person-protected"
        if (refused && !same(before, after)) failures.push(`${where} was refused and changed the stored row`)
        const starts = graph.states.get(at)?.turn === "none" && seen.runId !== undefined
        if (starts && opened.has(seen.runId ?? "")) failures.push(`${where} started a turn on an old run`)
        if (starts) turnRun = seen.runId ?? ""
        opened.add(seen.runId ?? "")
        if (graph.states.get(edge.to)?.turn === "live") {
          const rows = [...runRows(after, seen), await turnRow(id)]
          if (rows.some((each) => each !== undefined && each !== turnRun))
            failures.push(`${where} stored run ids ${JSON.stringify(rows)}, not the turn's run ${turnRun}`)
        }
        at = edge.to
      }
    } finally {
      await client.close()
    }
  }

  it("replays traces of the spec through POST /mcp and the stored rows", async () => {
    const failures: string[] = []
    for (const tool of slideTools) {
      for (const [index, trace] of traces.entries()) await replay(trace, index, failures, tool)
    }
    expect(failures).toEqual([])
  }, 120_000)

  it("covers every action of the spec", async () => {
    const graph = await specGraph("turn", "Turn")
    const replayed = new Set(traces.flat().map((step) => step.action))
    expect([...replayed].sort()).toEqual([...new Set(graph.edges.map((edge) => edge.action))].sort())
  }, 60_000)
})
