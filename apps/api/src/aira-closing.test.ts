import { randomBytes } from "node:crypto"

import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { Closing, type Followed } from "./aira-closing.js"
import { postgresInfo } from "./harness.js"
import { DeckListen, openPool, type Sql } from "./index.js"
import { same, specGraph, type Graph, type SpecState } from "./spec-graph.js"

type Seen = {
  readonly call: string
  readonly row: string
  readonly charges: number
  readonly stop: string
  readonly next: string
}

type Run = {
  readonly email: string
  readonly left: AbortController
  followed?: Followed
  settled: boolean
  charges: number
  stop?: { answered: boolean; readonly done: Promise<void> }
  next?: { result?: boolean; readonly done: Promise<void>; readonly own: Followed }
}

type Step = { readonly actions: readonly string[]; readonly act: (run: Run) => Promise<void> }

const observed = ["call", "row", "charges", "stop", "next"] as const

let session: Sql = openPool("postgres://session@127.0.0.1/api")
let admin = new Client()
let listens: DeckListen[] = []
let a: Closing
let b: Closing
let brief: Closing
let graph: Graph = { states: new Map(), edges: [] }

beforeAll(async () => {
  const info = await postgresInfo()
  session = openPool(info.session, "closing-session")
  admin = new Client({ connectionString: info.admin, application_name: "closing-admin" })
  await admin.connect()
  listens = [new DeckListen(info.listen), new DeckListen(info.listen)]
  const [first, second] = listens
  if (first === undefined || second === undefined) throw new Error("listen")
  a = new Closing({ db: session, listen: first })
  b = new Closing({ db: session, listen: second })
  brief = new Closing({ db: session, listen: second }, 50)
  graph = await specGraph("stop", "Stop")
}, 60_000)

afterAll(async () => {
  for (const listen of listens) await listen.close()
  await admin.end()
  await session.end()
})

async function rowOf(run: Run): Promise<string> {
  if (run.followed === undefined) return "none"
  const found = await admin.query<{ stopped: boolean }>(
    "select stopped is not null as stopped from session.aira_ask where id = $1",
    [run.followed.id],
  )
  const row = found.rows[0]
  if (row === undefined) return "gone"
  return row.stopped ? "stopped" : "live"
}

async function seen(run: Run): Promise<Seen> {
  const call =
    run.followed === undefined ? "none" : run.settled ? "closed" : run.followed.signal.aborted ? "aborted" : "running"
  const stop = run.stop === undefined ? "idle" : run.stop.answered ? "answered" : "waiting"
  const next =
    run.next === undefined
      ? "idle"
      : run.next.result === undefined
        ? "waiting"
        : run.next.result && run.settled
          ? "reserved"
          : "refused"
  return { call, row: await rowOf(run), charges: run.charges, stop, next }
}

function shown(state: SpecState | undefined): Record<string, unknown> {
  return Object.fromEntries(observed.map((name) => [name, state?.[name]]))
}

function quiet(ids: ReadonlySet<string>): Set<string> {
  const found = new Set(ids)
  for (let grew = true; grew;) {
    grew = false
    for (const edge of graph.edges) {
      if (!found.has(edge.from) || found.has(edge.to)) continue
      if (!same(shown(graph.states.get(edge.from)), shown(graph.states.get(edge.to)))) continue
      found.add(edge.to)
      grew = true
    }
  }
  return found
}

function after(ids: ReadonlySet<string>, actions: readonly string[]): Set<string> {
  let current = quiet(ids)
  for (const action of actions) {
    const reached = new Set<string>()
    for (const edge of graph.edges) if (edge.action === action && current.has(edge.from)) reached.add(edge.to)
    current = quiet(reached)
  }
  return current
}

function initial(): Set<string> {
  const start: SpecState = { call: "none", row: "none", charges: 0, stop: "idle", next: "idle" }
  const unset: SpecState = { reached: false, late: false, wake: false, left: false }
  const ids = [...graph.states].filter(([, state]) => same(state, { ...start, ...unset }))
  return new Set(ids.map(([id]) => id))
}

async function replay(steps: readonly Step[]): Promise<void> {
  const email = `closing${randomBytes(6).toString("hex")}@example.com`
  await admin.query("insert into session.account (email) values ($1)", [email])
  const run: Run = { email, left: new AbortController(), settled: false, charges: 0 }
  let ids = initial()
  expect(ids.size).toBe(1)
  for (const step of steps) {
    await step.act(run)
    const now = await seen(run)
    const matched = [...after(ids, step.actions)].filter((id) => same(shown(graph.states.get(id)), now))
    expect({ step: step.actions.join(" "), matched: matched.length > 0, now }).toEqual({
      step: step.actions.join(" "),
      matched: true,
      now,
    })
    ids = new Set(matched)
  }
}

const follow: Step = {
  actions: ["Follow"],
  act: async (run) => {
    run.followed = await a.follow(run.email, "ask", run.left.signal)
  },
}

function stopFrom(closing: Closing, actions: readonly string[], until: (run: Run) => Promise<boolean>): Step {
  return {
    actions,
    act: async (run) => {
      const stop: { answered: boolean; done: Promise<void> } = { answered: false, done: Promise.resolve() }
      stop.done = closing.stop(run.email, "ask").then(() => {
        stop.answered = true
      })
      run.stop = stop
      await vi.waitFor(async () => {
        expect(await until(run)).toBe(true)
      })
    },
  }
}

const settle: Step = {
  actions: ["Settle"],
  act: async (run) => {
    run.settled = true
    run.charges += 1
  },
}

function forget(actions: readonly string[]): Step {
  return {
    actions,
    act: async (run) => {
      await run.followed?.done()
      await run.stop?.done
      await run.next?.done
    },
  }
}

const leave: Step = {
  actions: ["Leave", "Mark"],
  act: async (run) => {
    run.left.abort()
    await vi.waitFor(async () => {
      expect(await rowOf(run)).toBe("stopped")
    })
  },
}

describe("a stop replays the stop spec through two servers on one database", () => {
  it("aborts the call on server A from server B and answers once A forgot the ask", async () => {
    await replay([
      follow,
      stopFrom(b, ["StopSent", "Watch"], async (run) => run.followed?.signal.aborted === true),
      settle,
      forget(["Forget", "Answer"]),
    ])
  })

  it("charges once when the person leaves A before B's stop arrives", async () => {
    await replay([
      follow,
      leave,
      stopFrom(b, ["StopSent"], async (run) => (await rowOf(run)) === "stopped"),
      settle,
      forget(["Forget", "Answer"]),
    ])
  })

  it("answers after the wait when A has not settled, and A still settles once", async () => {
    await replay([
      follow,
      stopFrom(
        brief,
        ["StopSent", "Watch", "Late", "Answer"],
        async (run) => run.stop?.answered === true && run.followed?.signal.aborted === true,
      ),
      settle,
      forget(["Forget"]),
    ])
  })

  it("answers at once a stop for an ask no server holds yet, and the ask then runs", async () => {
    await replay([
      stopFrom(b, ["StopSent"], async (run) => run.stop?.answered === true),
      follow,
      settle,
      forget(["Forget"]),
    ])
  })

  it("holds a new ask on B until the turn the person left on A has closed", async () => {
    await replay([
      follow,
      leave,
      {
        actions: ["NextAsk"],
        act: async (run) => {
          const own = await b.follow(run.email, "next", new AbortController().signal)
          const next: { result?: boolean; done: Promise<void>; own: Followed } = { done: Promise.resolve(), own }
          next.done = b.closed(run.email, own).then(async (result) => {
            next.result = result
            await own.done()
          })
          run.next = next
        },
      },
      settle,
      forget(["Forget", "NextRetry"]),
    ])
  })
})
