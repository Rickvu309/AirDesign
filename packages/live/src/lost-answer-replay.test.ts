import type { WireEdit, WireSlide } from "@airdesign/catalog"
import { elementId, presentSlides, slideId } from "@airdesign/document"
import { afterEach, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { newPage } from "./device.js"
import { connect, deleteDatabase, httpRemote, memoryRemote, type CommitResult, type Remote } from "./index.js"

type Value = boolean | number | string
type Spec = Record<string, Value>
type Edge = { readonly from: string; readonly to: string; readonly action: string }
type Graph = { readonly states: Map<string, Spec>; readonly edges: readonly Edge[] }
type View = { state: (v: Spec) => string }
type Body = { readonly deck: string; readonly batch: readonly (WireEdit | WireSlide)[]; readonly once?: string }

const deck = "replayed"
const file = [slideId("256"), slideId("257")] as const
const added = {
  slide: "add" as const,
  grid: 1 as const,
  row: "same" as const,
  id: slideId("258"),
  after: file[0],
  layout: file[0],
}
const elsewhere = elementId("256.9")

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

type Wire = {
  readonly body: Body
  readonly resolve: (response: Response) => void
  readonly reject: (error: Error) => void
  answer?: CommitResult
}

const page = (status: number, text: string) => new Response(text, { status, headers: { "content-type": "text/html" } })
const json = (status: number, text: string) =>
  new Response(text, { status, headers: { "content-type": "application/json" } })

const lostSends: readonly ((wire: Wire) => void)[] = [
  (wire) => wire.reject(new TypeError("Failed to fetch")),
  (wire) => wire.resolve(page(502, "<html><body>Bad gateway</body></html>")),
  (wire) => wire.resolve(json(500, JSON.stringify({ error: "internal" }))),
]

const lostAnswers: readonly ((wire: Wire) => void)[] = [
  (wire) => wire.resolve(json(200, JSON.stringify(wire.answer).slice(0, 12))),
  (wire) => wire.resolve(page(504, "<html><body>Gateway timeout</body></html>")),
]

let losses = 0

afterEach(() => {
  vi.unstubAllGlobals()
})

async function world() {
  installIndexedDb()
  const server = memoryRemote()
  let wire: Wire | undefined
  let orphan: Body | undefined
  let flushing: Promise<unknown> = Promise.resolve()
  let reached: () => void = () => undefined
  vi.stubGlobal(
    "fetch",
    (_path: string, init: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        wire = { body: JSON.parse(String(init.body)) as Body, resolve, reject }
        reached()
      }),
  )
  const tab = (): Remote => ({ ...server, commit: httpRemote().commit })
  let cache = connect(tab())
  expect(await cache.openDeck(deck)).toMatchObject({ ok: true })
  expect(await cache.enqueueSlide(deck, file, added)).toMatchObject({ ok: true })
  const held = (): Wire => {
    if (wire === undefined) throw new Error("no request on its way")
    return wire
  }
  const drop = async () => {
    held().reject(new TypeError("closed"))
    wire = undefined
    await flushing
  }
  const lose = async (ways: readonly ((wire: Wire) => void)[]) => {
    const way = ways[losses % ways.length]
    if (way === undefined) throw new Error("no way to lose")
    losses += 1
    way(held())
    wire = undefined
    expect(await flushing).toBeInstanceOf(TypeError)
  }
  const steps: Record<string, (from: Spec) => Promise<void>> = {
    Send: async () => {
      const sent = new Promise<void>((resolve) => {
        reached = resolve
      })
      flushing = cache.flush(deck).catch((error: unknown) => error)
      await sent
    },
    Land: async () => {
      const request = held()
      request.answer = await server.commit(request.body)
    },
    Lose: (from) => lose(from.wire === "answered" ? lostAnswers : lostSends),
    Refuse: async () => {
      held().resolve(json(200, '{"ok":false,"refusal":"storage"}'))
      wire = undefined
      expect(await flushing).toEqual({ ok: false, refusal: "storage" })
    },
    FlushAfterRefusal: async () => {
      const sent = new Promise<void>((resolve) => {
        reached = resolve
      })
      flushing = cache.flush(deck)
      await Promise.race([flushing, sent])
      if (wire !== undefined) {
        held().resolve(json(200, '{"ok":false,"refusal":"storage"}'))
        wire = undefined
        await flushing
        throw new Error("sent the refused command again")
      }
      expect(await flushing).toEqual({ ok: false, refusal: "storage" })
    },
    Answer: async () => {
      const request = held()
      if (request.answer === undefined) throw new Error("no answer")
      request.resolve(json(200, JSON.stringify(request.answer)))
      wire = undefined
      expect(await flushing).toMatchObject({ ok: true })
    },
    Reload: async () => {
      if (wire !== undefined) {
        if (wire.answer === undefined) orphan = wire.body
        await drop()
      }
      newPage()
      cache = connect(tab())
    },
    OrphanLands: async () => {
      if (orphan === undefined) throw new Error("no old request")
      await server.commit(orphan)
      orphan = undefined
    },
    OrphanLost: async () => {
      orphan = undefined
    },
    Adopt: async (from) => {
      if (from.known !== -1) {
        expect(await cache.follow(deck)).toMatchObject({ ok: true, changed: true })
        return
      }
      expect(await cache.open(deck)).toEqual({ ok: true })
      expect(await cache.openDeck(deck)).toMatchObject({ ok: true })
    },
    Other: async () => {
      expect(await server.commit({ deck, batch: [{ node: elsewhere, value: "Other" }] })).toMatchObject({ ok: true })
    },
  }
  const seen = async () => {
    const stored = await server.open({ deck })
    if (!stored.ok) throw new Error(stored.refusal)
    const rows = await cache.rows(deck)
    const device = await connect(memoryRemote()).openDeck(deck)
    return {
      lands: stored.register.order.filter((edit) => edit.slide === "add" && edit.id === added.id).length,
      rev: stored.revision,
      pending: (await cache.pending(deck)).length > 0,
      mirror: rows.filter((row) => row.kind === "confirmed" && row.slideEdit?.slide === "add").length,
      shown: device.ok ? presentSlides(device.register).filter((spot) => spot.id === added.id).length : -1,
    }
  }
  const close = async () => {
    if (wire !== undefined) await drop()
    await deleteDatabase()
  }
  return { steps, seen, close }
}

function within(work: Promise<void>, said: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const hung = new Promise<void>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${said} did not finish`)), 5000)
  })
  return Promise.race([work, hung]).finally(() => clearTimeout(timer))
}

async function replayed(graph: Graph, view: View): Promise<{ edges: number; failures: string[] }> {
  const failures: string[] = []
  const outgoing = new Map<string, Edge[]>()
  for (const edge of graph.edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge])
  const start = [...graph.states.entries()].find(
    ([, state]) => state.reloads === 0 && state.known === 0 && state.wire === "none" && state.lands === 0,
  )?.[0]
  if (start === undefined) throw new Error("no start")
  const left = new Set(graph.edges)
  while (left.size > 0 && failures.length === 0) {
    const way = new Map<string, Edge[]>([[start, []]])
    const queue = [start]
    let found: Edge[] | undefined
    for (let at = queue.shift(); at !== undefined && found === undefined; at = queue.shift()) {
      const path = way.get(at) ?? []
      if ((outgoing.get(at) ?? []).some((edge) => left.has(edge))) found = path
      for (const edge of outgoing.get(at) ?? []) {
        if (way.has(edge.to)) continue
        way.set(edge.to, [...path, edge])
        queue.push(edge.to)
      }
    }
    if (found === undefined) break
    const replay = await world()
    const trail: string[] = []
    let at = start
    const walk = [...found]
    const onward = () => {
      const next = (outgoing.get(at) ?? []).find((each) => left.has(each))
      if (next !== undefined) walk.push(next)
    }
    if (walk.length === 0) onward()
    for (let edge: Edge | undefined = walk.shift(); edge !== undefined; edge = walk.shift()) {
      left.delete(edge)
      trail.push(edge.action)
      const target = graph.states.get(edge.to) ?? {}
      const said = `after ${trail.join(", ")}: ${view.state(graph.states.get(edge.from) ?? {})} -${edge.action}-> ${view.state(target)}`
      const step = replay.steps[edge.action]
      if (step === undefined) failures.push(`${said} is not connected`)
      else
        await within(step(graph.states.get(edge.from) ?? {}), edge.action).catch((error: unknown) =>
          failures.push(`${said}: ${String(error)}`),
        )
      if (failures.length > 0) break
      const actual = await replay.seen()
      const copies = Number(target.mirror) + (target.pending === true ? 1 : 0)
      const expected = {
        lands: target.lands,
        rev: target.rev,
        pending: target.pending,
        mirror: target.mirror,
        shown: copies > 0 ? 1 : 0,
      }
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        failures.push(`${said}\n  code ${JSON.stringify(actual)}`)
      if (failures.length > 0) break
      at = edge.to
      if (walk.length === 0) onward()
    }
    await replay.close()
  }
  return { edges: graph.edges.length - left.size, failures }
}

it("replays every edge of the lost-answer spec through the device's queue, its mirror and the server's once", async () => {
  const view = (await import(new URL("../../../specs/lost-answer/view.mjs", import.meta.url).href)) as View
  const graph = await specGraph("lost-answer", "LostAnswer")
  const report = await replayed(graph, view)
  expect(report.failures).toEqual([])
  expect(report.edges).toBe(graph.edges.length)
  expect(graph.states.size).toBeLessThan(500)
}, 60_000)
