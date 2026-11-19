import { connect } from "@airdesign/live"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { commitKept } from "./commit-edit"
import { saveStatus, useDeckStatus } from "./editor/use-deck-status"
import { useNetwork } from "./editor/use-network"

type Send = {
  readonly caller: number
  readonly signal: AbortSignal | null
  readonly resolve: (answer: unknown) => void
  readonly reject: (error: Error) => void
  started: boolean
}
type Rest = { readonly signal: AbortSignal; readonly end: () => void; ended: boolean }
type Status = ReturnType<typeof useDeckStatus>

const world = vi.hoisted(() => ({
  caller: 0,
  net: true,
  lane: [] as Send[],
  rests: [] as Rest[],
  waiting: false,
  tell: null as ((unsent: boolean) => void) | null,
  status: null as Status | null,
}))

function deviceHolds(rows: boolean): void {
  world.waiting = rows
  world.tell?.(rows)
}

vi.mock("@airdesign/live", async () => {
  const actual = await vi.importActual<object>("@airdesign/live")
  return {
    ...actual,
    connect: () => ({
      flush: () =>
        new Promise((resolve, reject) => {
          const signal = world.caller === 2 ? (world.rests.at(-1)?.signal ?? null) : null
          world.lane.push({ caller: world.caller, signal, resolve, reject, started: false })
        }),
      pending: () => Promise.resolve(world.waiting ? ["row"] : []),
    }),
    flushOriginal: () => Promise.resolve({ ok: true }),
    watchUnsent: (_deck: string, tell: (unsent: boolean) => void) => {
      world.tell = tell
      tell(world.waiting)
      return () => {
        world.tell = null
      }
    },
  }
})

vi.mock("./deck-follow", async () => {
  const actual = await vi.importActual<object>("./deck-follow")
  return {
    ...actual,
    pause: (_ms: number, signal: AbortSignal) =>
      new Promise<void>((resolve) => {
        const rest: Rest = {
          signal,
          end: () => {
            rest.ended = true
            resolve()
          },
          ended: false,
        }
        world.rests.push(rest)
        signal.addEventListener("abort", rest.end, { once: true })
      }),
  }
})

type Value = boolean | number | string
type Spec = Record<string, Value>
type Edge = { readonly from: string; readonly to: string; readonly action: string }
type Graph = { readonly states: Map<string, Spec>; readonly edges: readonly Edge[] }
type View = { state: (v: Spec) => string }
type World = {
  readonly steps: Record<string, (source: Spec, target: Spec) => Promise<void>>
  readonly seen: () => Spec
  readonly close: () => Promise<void>
}

const deck = "connection-deck"
const event = 1
const resend = 2
const edit = 3
const stopped = 4

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let graph: Graph
let view: View

async function specGraph(name: string, module: string): Promise<Graph> {
  const checks: string = new URL("../../../scripts/check-specs.mjs", import.meta.url).href
  const graphs: string = new URL("../../../tests/spec-graph.ts", import.meta.url).href
  const specs = (await import(checks)) as {
    dumpSpec: (topic: string, java: string, jar: string, spec: string, config: string) => { graph: string }
    javaBin: () => string
    jarPath: () => string
  }
  const { parseDot } = (await import(graphs)) as { parseDot: (dot: string) => Graph }
  const topic = decodeURIComponent(new URL(`../../../specs/${name}`, import.meta.url).pathname)
  return parseDot(specs.dumpSpec(topic, specs.javaBin(), specs.jarPath(), `${module}.tla`, `${module}.cfg`).graph)
}

function Editor() {
  const status = useDeckStatus(deck)
  useNetwork({ id: deck, ...status })
  world.status = status
  return null
}

function shownBy(v: Spec): Value {
  if (v.net !== true) return "offline"
  if (v.rows !== true) return "saved"
  return v.offline === true ? "unreached" : "saving"
}

function answerOf(v: Spec): "sent" | "empty" | "offline" {
  if (v.carry !== true) return "empty"
  return v.net === true && v.up === true ? "sent" : "offline"
}

function laneCode(): number {
  return world.lane.reduce(
    (code, send) => code * 10 + (send.caller === resend && send.signal?.aborted === true ? stopped : send.caller),
    0,
  )
}

function loopNow(): string {
  const rest = world.rests.at(-1)
  if (rest === undefined || rest.signal.aborted) return "off"
  if (!rest.ended) return "rest"
  return world.lane.some((send) => send.caller === resend && send.signal === rest.signal) ? "wait" : "off"
}

async function settled(work: () => void): Promise<void> {
  await act(async () => {
    work()
    for (let tick = 0; tick < 5; tick += 1) await new Promise((done) => setTimeout(done, 0))
  })
}

async function openEditor(): Promise<World> {
  world.caller = 0
  world.net = true
  world.lane = []
  world.rests = []
  world.waiting = false
  world.tell = null
  world.status = null
  let open = true
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await settled(() => root.render(createElement(Editor)))
  const status = (): Status => {
    if (world.status === null) throw new Error("the editor did not render")
    return world.status
  }
  const steps: World["steps"] = {
    GoOffline: () =>
      settled(() => {
        world.net = false
        window.dispatchEvent(new window.Event("offline"))
      }),
    GoOnline: () =>
      settled(() => {
        world.net = true
        world.caller = event
        window.dispatchEvent(new window.Event("online"))
      }),
    ServerDown: () => Promise.resolve(),
    ServerUp: () => Promise.resolve(),
    EditRow: () =>
      settled(() => {
        world.caller = edit
        const written = Promise.resolve().then(() => {
          deviceHolds(true)
          return { ok: true }
        })
        void commitKept(connect, deck, written).then(status().settle)
      }),
    Send: async () => {
      const first = world.lane[0]
      if (first === undefined) throw new Error("no send in the lane")
      first.started = true
    },
    Answer: (source, target) =>
      settled(() => {
        const first = world.lane.shift()
        if (first === undefined) throw new Error("no send in the lane")
        const answer = answerOf(source)
        deviceHolds(target.rows === true)
        if (answer === "offline") first.reject(new TypeError("Failed to fetch"))
        else first.resolve(answer === "sent" ? { ok: true } : { ok: false, refusal: "batch" })
      }),
    Retry: () =>
      settled(() => {
        const rest = world.rests.at(-1)
        if (rest === undefined || rest.ended) throw new Error("no resend loop rests")
        world.caller = resend
        rest.end()
      }),
    Leave: async () => {
      await settled(() => root.unmount())
      open = false
    },
  }
  return {
    steps,
    seen: () => {
      const shown = status()
      return {
        open,
        net: window.navigator.onLine,
        pending: open && shown.pending,
        offline: shown.offline,
        lane: laneCode(),
        started: world.lane[0]?.started ?? false,
        loop: loopNow(),
        shown: open ? saveStatus(shown) : "closed",
      }
    },
    close: async () => {
      if (open) await settled(() => root.unmount())
      host.remove()
    },
  }
}

function modelled(v: Spec): Spec {
  return {
    open: v.open ?? false,
    net: v.net ?? false,
    pending: v.open === true && v.rows === true,
    offline: v.offline ?? false,
    lane: v.lane ?? 0,
    started: v.started ?? false,
    loop: v.loop ?? "off",
    shown: v.open === true ? shownBy(v) : "closed",
  }
}

function same(left: Spec, right: Spec): boolean {
  const sorted = (spec: Spec) => JSON.stringify(Object.entries(spec).sort(([a], [b]) => a.localeCompare(b)))
  return sorted(left) === sorted(right)
}

function startOf(): string {
  const targets = new Set(graph.edges.map((edge) => edge.to))
  const start = [...graph.states.keys()].find((id) => !targets.has(id))
  if (start === undefined) throw new Error("no start")
  return start
}

function outgoingOf(): Map<string, Edge[]> {
  const outgoing = new Map<string, Edge[]>()
  for (const edge of graph.edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge])
  return outgoing
}

async function walked(walk: readonly Edge[], failures: string[], taken: (edge: Edge) => void): Promise<Spec | null> {
  const world = await openEditor()
  const trail: string[] = []
  let actual: Spec | null = null
  try {
    for (const edge of walk) {
      taken(edge)
      trail.push(edge.action)
      const source = graph.states.get(edge.from) ?? {}
      const target = graph.states.get(edge.to) ?? {}
      const said = `after ${trail.join(", ")}: ${view.state(source)} -${edge.action}-> ${view.state(target)}`
      const step = world.steps[edge.action]
      if (step === undefined) failures.push(`${said} is not connected`)
      else await step(source, target).catch((error: unknown) => failures.push(`${said}: ${String(error)}`))
      if (failures.length > 0) break
      actual = world.seen()
      const expected = modelled(target)
      if (!same(actual, expected))
        failures.push(`${said}\n  code ${JSON.stringify(actual)}\n  model ${JSON.stringify(expected)}`)
      if (failures.length > 0) break
    }
  } finally {
    await world.close()
  }
  return actual
}

function shortestTo(reached: (v: Spec) => boolean, left: Set<Edge> | null): Edge[] | undefined {
  const outgoing = outgoingOf()
  const start = startOf()
  const way = new Map<string, Edge[]>([[start, []]])
  const queue = [start]
  for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
    const path = way.get(at) ?? []
    if (left === null && reached(graph.states.get(at) ?? {})) return path
    const fresh = left === null ? undefined : (outgoing.get(at) ?? []).find((edge) => left.has(edge))
    if (fresh !== undefined) return [...path, fresh]
    for (const edge of outgoing.get(at) ?? []) {
      if (way.has(edge.to)) continue
      way.set(edge.to, [...path, edge])
      queue.push(edge.to)
    }
  }
  return undefined
}

async function replayed(): Promise<{ walks: number; edges: number; failures: string[] }> {
  const failures: string[] = []
  const left = new Set(graph.edges)
  const outgoing = outgoingOf()
  let walks = 0
  while (left.size > 0 && failures.length === 0) {
    const found = shortestTo(() => false, left)
    if (found === undefined) break
    const walk = [...found]
    for (let at = walk.at(-1)?.to; at !== undefined;) {
      const next = (outgoing.get(at) ?? []).find((edge) => left.has(edge) && !walk.includes(edge))
      if (next === undefined) break
      walk.push(next)
      at = next.to
    }
    walks += 1
    await walked(walk, failures, (edge) => left.delete(edge))
  }
  return { walks, edges: graph.edges.length - left.size, failures }
}

function followed(actions: readonly string[]): Edge[] {
  const outgoing = outgoingOf()
  let at = startOf()
  return actions.map((action) => {
    const edge = (outgoing.get(at) ?? []).find((each) => each.action === action)
    if (edge === undefined) throw new Error(`no ${action} after ${view.state(graph.states.get(at) ?? {})}`)
    at = edge.to
    return edge
  })
}

function settledButNotSaved(v: Spec): boolean {
  return (
    v.open === true && v.net === true && v.rows !== true && v.lane === 0 && v.loop === "off" && shownBy(v) !== "saved"
  )
}

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => world.net })
  const shared: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["navigator", window.navigator],
    ["HTMLElement", window.HTMLElement],
    ["Event", window.Event],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
  view = (await import(new URL("../../../specs/connection/view.mjs", import.meta.url).href)) as View
  graph = await specGraph("connection", "Connection")
}, 60_000)

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it("replays every edge of the connection spec through the editor's network hook, its status and its sends", async () => {
  const report = await replayed()
  expect(report.failures).toEqual([])
  expect(report.edges).toBe(graph.edges.length)
  expect(graph.states.size).toBeLessThan(500)
}, 600_000)

it("reads Saved once a stopped loop's send carried the rows and the online event's send found none", async () => {
  expect(shortestTo(settledButNotSaved, null)).toBeUndefined()
  const walk = followed([
    "ServerDown",
    "EditRow",
    "Send",
    "Answer",
    "ServerUp",
    "Retry",
    "GoOffline",
    "GoOnline",
    "Send",
    "Answer",
    "Send",
    "Answer",
  ])
  const failures: string[] = []
  const seen = await walked(walk, failures, () => undefined)
  expect(failures).toEqual([])
  expect(seen?.shown).toBe("saved")
}, 60_000)
