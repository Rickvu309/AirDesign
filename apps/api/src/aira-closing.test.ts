import { randomBytes } from "node:crypto"

import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { Closing, type Followed } from "./aira-closing.js"
import { postgresInfo } from "./harness.js"
import { heldQueries, type HeldQueries } from "./held-queries.js"
import { DeckListen, openPool, type Sql } from "./index.js"
import { same, specGraph, type Graph, type SpecState } from "./spec-graph.js"

type Seen = {
  readonly call: string
  readonly model: string
  readonly row: string
  readonly charges: number
  readonly stop: string
  readonly next: string
}

type Run = {
  readonly email: string
  readonly left: AbortController
  followed?: Followed
  sent?: boolean
  settled: boolean
  charges: number
  stop?: { answered: boolean; readonly done: Promise<void> }
  next?: { reserved?: boolean; readonly done: Promise<void>; readonly own: Followed }
}

type Step = { readonly actions: readonly string[]; readonly act: (run: Run) => Promise<void> }

const observed = ["call", "model", "row", "charges", "stop", "next"] as const

const stoppedRead = "select stopped is not null as stopped from session.aira_ask"

const openStopRead = "id <> $2 and stopped is not null"

let session: Sql = openPool("postgres://session@127.0.0.1/api")
let admin = new Client()
let listens: DeckListen[] = []
let a: Closing
let held: HeldQueries
let heldB: HeldQueries
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
  held = heldQueries(session)
  a = new Closing({ db: held.db, listen: first })
  heldB = heldQueries(session)
  b = new Closing({ db: heldB.db, listen: second })
  brief = new Closing({ db: session, listen: second }, 50)
  graph = await specGraph("stop", "Stop")
}, 60_000)

afterAll(async () => {
  for (const listen of listens) await listen.close()
  await admin.end()
  await session.end()
})

async function rowOf(run: Run): Promise<string> {
  const found = await admin.query<{ stopped: boolean; followed: boolean }>(
    "select stopped is not null as stopped, followed from session.aira_ask where email = $1 and ask = 'ask'",
    [run.email],
  )
  const row = found.rows[0]
  if (row === undefined) return run.followed === undefined ? "none" : "gone"
  if (!row.followed) return "noted"
  return row.stopped ? "stopped" : "live"
}

async function seen(run: Run): Promise<Seen> {
  const call =
    run.followed === undefined ? "none" : run.settled ? "closed" : run.followed.signal.aborted ? "aborted" : "running"
  const stop = run.stop === undefined ? "idle" : run.stop.answered ? "answered" : "waiting"
  const next =
    run.next === undefined
      ? "idle"
      : run.next.reserved === undefined
        ? "waiting"
        : run.next.reserved
          ? "reserved"
          : "refused"
  const model = run.sent === undefined ? "unsent" : run.sent ? "sent" : "skipped"
  return { call, model, row: await rowOf(run), charges: run.charges, stop, next }
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
  const start: SpecState = { call: "none", model: "unsent", row: "none", charges: 0, stop: "idle", next: "idle" }
  const unset: SpecState = { reached: false, late: false, wake: false }
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
    const reached = [...after(ids, step.actions)]
    const matched = reached.filter((id) => same(shown(graph.states.get(id)), now))
    if (matched.length === 0) {
      const sample = reached.slice(0, 6).map((id) => shown(graph.states.get(id)))
      expect({ step: step.actions.join(" "), matched: false, now, reached: reached.length, sample }).toEqual({
        step: step.actions.join(" "),
        matched: true,
        now,
        reached: reached.length,
        sample,
      })
    }
    ids = new Set(matched)
  }
}

const follow: Step = {
  actions: ["Follow"],
  act: async (run) => {
    const reads = held.times(stoppedRead)
    run.followed = await a.follow(run.email, "ask", run.left.signal)
    await vi.waitFor(() => {
      expect(held.times(stoppedRead)).toBeGreaterThan(reads)
    })
  },
}

function followFrom(closing: Closing): Step {
  return {
    actions: ["Follow"],
    act: async (run) => {
      run.followed = await closing.follow(run.email, "ask", run.left.signal)
    },
  }
}

function decide(actions: readonly string[]): Step {
  return {
    actions,
    act: async (run) => {
      run.sent = !(await run.followed?.stopped())
      if (!run.sent) run.settled = true
    },
  }
}

const send = decide(["Send"])

const skip = decide(["Skip"])

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

const nextAsk: Step = {
  actions: ["NextAsk"],
  act: async (run) => {
    const own = await b.follow(run.email, "next", new AbortController().signal)
    const next: { reserved?: boolean; done: Promise<void>; own: Followed } = { done: Promise.resolve(), own }
    next.done = b.closed(run.email, own).then(async () => {
      next.reserved = run.settled
      await own.done()
    })
    run.next = next
  },
}

describe("a stop replays the stop spec through two servers on one database", () => {
  it("aborts the call on server A from server B and answers once A forgot the ask", async () => {
    await replay([
      follow,
      send,
      stopFrom(b, ["StopSent", "Watch"], async (run) => run.followed?.signal.aborted === true),
      settle,
      forget(["Forget", "Answer"]),
    ])
  })

  it("charges once when the person leaves A before B's stop arrives", async () => {
    await replay([
      follow,
      send,
      leave,
      stopFrom(b, ["StopSent"], async (run) => (await rowOf(run)) === "stopped"),
      settle,
      forget(["Forget", "Answer"]),
    ])
  })

  it("answers after the wait when A has not settled, and A still settles once", async () => {
    await replay([
      follow,
      send,
      stopFrom(
        brief,
        ["StopSent", "Watch", "Late", "Answer"],
        async (run) => run.stop?.answered === true && run.followed?.signal.aborted === true,
      ),
      settle,
      forget(["Forget"]),
    ])
  })

  it("answers at once a stop from B for an ask no server holds yet, and A's follow starts stopped", async () => {
    await replay([
      stopFrom(b, ["StopSent"], async (run) => run.stop?.answered === true),
      followFrom(a),
      skip,
      forget(["Forget"]),
    ])
  })

  it("heeds a stop that reached A before A followed its ask", async () => {
    await replay([
      stopFrom(a, ["StopSent"], async (run) => run.stop?.answered === true),
      followFrom(a),
      skip,
      forget(["Forget"]),
    ])
  })

  it("holds a new ask on B until A closed the ask a stop came before", async () => {
    await replay([
      stopFrom(b, ["StopSent"], async (run) => run.stop?.answered === true),
      followFrom(a),
      nextAsk,
      skip,
      forget(["Forget", "NextRetry"]),
    ])
  })

  it("holds a new ask on B until the turn the person left on A has closed", async () => {
    await replay([follow, send, leave, nextAsk, settle, forget(["Forget", "NextRetry"])])
  })

  it("reserves a new ask on B whose look at the rows comes back after A's turn closed", async () => {
    let look = { reached: Promise.resolve(), release: () => undefined as void }
    await replay([
      follow,
      send,
      leave,
      {
        actions: nextAsk.actions,
        act: async (run) => {
          look = heldB.hold(openStopRead)
          await nextAsk.act(run)
          await look.reached
        },
      },
      settle,
      {
        actions: ["Forget", "NextRetry"],
        act: async (run) => {
          await run.followed?.done()
          look.release()
          await run.next?.done
        },
      },
    ])
  })

  it("skips the model call when B marked the row before A sent, though A's wake is late", async () => {
    let wake = { reached: Promise.resolve(), release: () => undefined as void }
    await replay([
      follow,
      {
        actions: ["StopSent"],
        act: async (run) => {
          wake = held.hold(stoppedRead)
          await stopFrom(b, [], async (found) => (await rowOf(found)) === "stopped").act(run)
          await wake.reached
        },
      },
      skip,
      {
        actions: ["Forget", "Answer"],
        act: async (run) => {
          wake.release()
          await forget([]).act(run)
        },
      },
    ])
  })

  it("skips the model call when the person left A before it sent", async () => {
    await replay([follow, leave, skip, forget(["Forget"])])
  })
})

describe("one ask's row outside the replay", () => {
  it("never holds a new ask on a stop's note whose ask never comes", async () => {
    const email = `noted${randomBytes(6).toString("hex")}@example.com`
    await admin.query("insert into session.account (email) values ($1)", [email])
    const [, second] = listens
    if (second === undefined) throw new Error("listen")
    const patient = new Closing({ db: session, listen: second }, 600_000)
    await b.stop(email, "never")
    const own = await patient.follow(email, "next", new AbortController().signal)
    await patient.closed(email, own)
    expect(own.signal.aborted).toBe(false)
    await own.done()
    const rows = await admin.query("select ask, followed from session.aira_ask where email = $1", [email])
    expect(rows.rows).toEqual([{ ask: "never", followed: false }])
  })

  it("keeps the next model turn's row when the turn before it forgets its row late", async () => {
    const email = `turns${randomBytes(6).toString("hex")}@example.com`
    await admin.query("insert into session.account (email) values ($1)", [email])
    const first = await a.follow(email, "ask", new AbortController().signal)
    const second = await b.follow(email, "ask", new AbortController().signal)
    await first.done()
    expect(await second.stopped()).toBe(false)
    await second.done()
  })
})
