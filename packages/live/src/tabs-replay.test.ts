import { currentBox, currentValue, format, type Box, type Register } from "@airdesign/document"
import { afterEach, expect, it, vi } from "vitest"
import { installIndexedDb, node } from "./browser-fixtures.js"
import { accountKey, databaseName, scoped, storeName } from "./device.js"
import * as first from "./index.js"
import { memoryRemote, type CommitResult, type Remote } from "./index.js"
import { revisionKey, rowRange, type StoredRow } from "./store.js"

type Live = typeof first
type Value = boolean | number | string
type Spec = Record<string, Value>
type Edge = { readonly from: string; readonly to: string; readonly action: string }
type Graph = { readonly states: Map<string, Spec>; readonly edges: readonly Edge[] }
type View = { state: (v: Spec) => string }
type Body = Parameters<Remote["commit"]>[0]

const deck = "tabs"
const words = "The file's words"
const placed: Box = { x: 914400, y: 457200, cx: 1828800, cy: 914400 }
const moved: Box = { x: 1828800, y: 914400, cx: 1828800, cy: 914400 }
const bold = (text: string) => text.toUpperCase()

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

async function build(newer: boolean): Promise<Live> {
  vi.resetModules()
  if (newer)
    vi.doMock("@airdesign/document", async (original) => ({ ...(await original<object>()), format: format + 1 }))
  const live = (await import("./index.js")) as Live
  vi.doUnmock("@airdesign/document")
  return live
}

const second = await build(false)

afterEach(() => {
  vi.unstubAllGlobals()
})

function text(value: string): string {
  if (value === words) return "file"
  if (value === bold(words)) return "bold"
  if (value === "") return "none"
  return `unknown ${value}`
}

function deckOf(register: Register): string {
  const body = register.elements[node]
  const shown = body === undefined ? "file" : text(currentValue(body))
  const box = body === undefined ? placed : currentBox(body)
  return JSON.stringify(box) === JSON.stringify(moved) ? `moved ${shown}` : shown
}

type Request = { readonly body: Body; readonly resolve: (answer: CommitResult) => void; answer?: CommitResult }

type Tab = {
  live: Live
  page: ReturnType<Live["connect"]>
  request?: Request | undefined
  reached: () => void
  flushing: Promise<unknown>
  painted: string
}

async function copyOf(version: number): Promise<{ rows: StoredRow[]; revision: unknown }> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = globalThis.indexedDB.open(databaseName, version)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error("open"))
  })
  const store = database.transaction(storeName, "readonly").objectStore(storeName)
  const all = store.getAll(rowRange(scoped(accountKey() ?? "", deck)))
  const revision = store.get(scoped(accountKey() ?? "", revisionKey(deck)))
  return new Promise((resolve) => {
    revision.onsuccess = () => resolve({ rows: all.result as StoredRow[], revision: revision.result })
  })
}

function rowState(row: StoredRow | undefined): string {
  if (row === undefined) return "none"
  return row.kind === "pending" && row.once !== undefined ? "sealed" : "row"
}

async function world() {
  installIndexedDb()
  const server = memoryRemote()
  const landed = { move: 0, bold: 0 }
  let stamped = false
  let newer = false
  let version = format
  let answerNow = false
  const remoteOf = (tab: () => Tab, older: boolean): Remote => ({
    open: async (body) => {
      const opened = await server.open(body)
      if (older && stamped && landed.bold > 0) return { ok: false, refusal: "newer" }
      return opened
    },
    watch: async (body) => {
      if (!answerNow) return server.watch(body)
      const opened = await server.open({ deck: body.deck })
      return opened.ok ? { ok: true, deck: opened.deck, revision: opened.revision } : opened
    },
    commit: (body) =>
      new Promise<CommitResult>((resolve) => {
        tab().request = { body, resolve }
        tab().reached()
      }),
  })
  const tabOf = (live: Live, older: boolean): Tab => {
    const tab: Tab = {
      live,
      page: live.connect(remoteOf(() => tab, older)),
      reached: () => undefined,
      flushing: Promise.resolve(),
      painted: "file",
    }
    return tab
  }
  const one = tabOf(first, true)
  let two = tabOf(second, false)
  expect(await one.page.openDeck(deck)).toMatchObject({ ok: true })
  expect(await two.page.openDeck(deck)).toMatchObject({ ok: true })
  const paint = async (tab: Tab) => {
    const opened = await tab.live.connect(memoryRemote()).openDeck(deck)
    if (!opened.ok) throw new Error(opened.refusal)
    tab.painted = deckOf(opened.register)
  }
  const told = (tab: Tab) => {
    expect(tab.live.storeNewer()).toBe(true)
    tab.painted = ""
  }
  const send = async (tab: Tab, to: Spec, wire: string) => {
    const reached = new Promise<void>((resolve) => {
      tab.reached = resolve
    })
    tab.flushing = tab.page.flush(deck).catch((error: unknown) => error)
    await Promise.race([reached, tab.flushing])
    if (to[wire] === "sent") expect(tab.request).toBeDefined()
    else {
      expect(await tab.flushing).toEqual({ ok: false, refusal: "newer" })
      told(tab)
    }
  }
  const apply = async (tab: Tab) => {
    const request = tab.request
    if (request === undefined) throw new Error("no request on its way")
    request.answer = await server.commit(request.body)
    if (!request.answer.ok) throw new Error(request.answer.refusal)
    const revision = request.answer.revision
    for (const edit of request.body.batch) {
      if (!("node" in edit)) continue
      if ("property" in edit && edit.property === "box") landed.move ||= revision
      else landed.bold ||= revision
    }
  }
  const answer = async (tab: Tab, to: Spec, wire: string, stopped: boolean) => {
    const request = tab.request
    if (request?.answer === undefined) throw new Error("no answer on its way")
    tab.request = undefined
    const reached = new Promise<void>((resolve) => {
      tab.reached = resolve
    })
    request.resolve(request.answer)
    if (to[wire] === "sent") {
      await reached
      return
    }
    const result = await tab.flushing
    if (stopped) {
      expect(result).toEqual({ ok: false, refusal: "newer" })
      told(tab)
    } else expect(result).toMatchObject({ ok: true })
  }
  const follow = async (tab: Tab, stopped: boolean) => {
    const followed = await tab.page.follow(deck)
    if (stopped) {
      expect(followed).toEqual({ ok: false, refusal: "newer" })
      told(tab)
      return
    }
    expect(followed).toMatchObject({ ok: true, changed: true })
    const opened = await tab.page.openDeck(deck)
    if (!opened.ok) throw new Error(opened.refusal)
    tab.painted = deckOf(opened.register)
  }
  const steps: Record<string, (from: Spec, to: Spec) => Promise<void>> = {
    Move: async (_, to) => {
      const kept = await one.live.connect(memoryRemote()).enqueueBox(deck, moved, node, words)
      if (to.stopped1 === true) {
        expect(kept).toEqual({ ok: false, refusal: "newer" })
        told(one)
        return
      }
      expect(kept).toMatchObject({ ok: true })
      await paint(one)
    },
    Format: async () => {
      const opened = await two.live.connect(memoryRemote()).openDeck(deck)
      if (!opened.ok) throw new Error(opened.refusal)
      const body = opened.register.elements[node]
      const planned = body === undefined ? words : currentValue(body)
      expect(await two.live.connect(memoryRemote()).enqueue(deck, bold(planned), node, words)).toMatchObject({
        ok: true,
      })
      stamped = newer
      await paint(two)
    },
    SendOne: (_, to) => send(one, to, "wire1"),
    SendTwo: (_, to) => send(two, to, "wire2"),
    ApplyOne: () => apply(one),
    ApplyTwo: () => apply(two),
    AnswerOne: (_, to) => answer(one, to, "wire1", to.stopped1 === true),
    AnswerTwo: (_, to) => answer(two, to, "wire2", false),
    FollowOne: (_, to) => follow(one, to.stopped1 === true),
    FollowTwo: () => follow(two, false),
    ReloadTwo: async (_, to) => {
      newer = to.build2 === 2
      two = tabOf(await build(newer), false)
      if (newer) version = format + 1
      await paint(two)
    },
    ReadTwo: async () => {
      expect(await two.page.open(deck)).toEqual({ ok: true })
    },
    AdoptTwo: async () => {
      const opened = await two.page.openDeck(deck)
      if (!opened.ok) throw new Error(opened.refusal)
      two.painted = deckOf(opened.register)
    },
  }
  const seen = async () => {
    const stored = await server.open({ deck })
    if (!stored.ok) throw new Error(stored.refusal)
    const { rows, revision } = await copyOf(version)
    const pendingBox = rows.find((row) => row.kind === "pending" && "property" in row && row.property === "box")
    const pendingText = rows.find((row) => row.kind === "pending" && !("property" in row && row.property === "box"))
    const confirmed = rows.filter((row) => row.kind === "confirmed")
    const textRow = [pendingText, ...confirmed.filter((row) => !("property" in row && row.property === "box"))].find(
      (row) => row !== undefined,
    )
    const once = (row: StoredRow | undefined) => (row?.kind === "pending" ? row.once : undefined)
    return {
      rev: stored.revision,
      mvAt: landed.move,
      fmAt: landed.bold,
      server: deckOf(stored.register),
      mv: rowState(pendingBox),
      mvc: confirmed.some((row) => "property" in row && row.property === "box"),
      fm: rowState(pendingText),
      fmc: confirmed.some((row) => !("property" in row && row.property === "box")),
      sealedTogether: once(pendingBox) !== undefined && once(pendingBox) === once(pendingText),
      words: textRow === undefined || !("value" in textRow) ? null : text(String(textRow.value)),
      crev: revision,
      stopped1: one.live.storeNewer(),
      shown1: one.painted,
      shown2: two.painted,
    }
  }
  const close = async () => {
    for (const tab of [one, two]) {
      const request = tab.request
      if (request === undefined) continue
      request.resolve(request.answer ?? { ok: false, refusal: "batch" })
      await tab.flushing
    }
  }
  const watchAnswersNow = () => {
    answerNow = true
  }
  return { steps, seen, close, tabs: () => [one, two] as const, watchAnswersNow }
}

async function walked(trail: readonly (readonly [string, Spec])[]) {
  const replay = await world()
  for (const [action, to] of trail) {
    const step = replay.steps[action]
    if (step === undefined) throw new Error(`no step ${action}`)
    await step({}, to)
  }
  return replay
}

const serverDeck = (v: Spec) => {
  const movedOn = Number(v.mvAt) > 0 && Number(v.mvAt) <= Number(v.rev)
  const boldOn = Number(v.fmAt) > 0 && Number(v.fmAt) <= Number(v.rev)
  const shown = boldOn ? String(v.words) : "file"
  return movedOn ? `moved ${shown}` : shown
}

function expected(v: Spec) {
  return {
    rev: v.rev,
    mvAt: v.mvAt,
    fmAt: v.fmAt,
    server: serverDeck(v),
    mv: v.mv,
    mvc: v.mvc,
    fm: v.fm,
    fmc: v.fmc,
    sealedTogether: v.together === true && v.mv === "sealed" && v.fm === "sealed",
    words: v.made === 2 && (v.fm !== "none" || v.fmc === true) ? v.words : null,
    crev: v.crev,
    stopped1: v.stopped1,
    shown1: v.shown1,
    shown2: v.shown2,
  }
}

function within(work: Promise<void>, said: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const hung = new Promise<void>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${said} did not finish`)), 5000)
  })
  return Promise.race([work, hung]).finally(() => clearTimeout(timer))
}

async function walk(
  graph: Graph,
  view: View,
  trail: readonly Edge[],
  replay: Awaited<ReturnType<typeof world>>,
  failures: string[],
): Promise<void> {
  const said: string[] = []
  for (const edge of trail) {
    said.push(edge.action)
    const from = graph.states.get(edge.from) ?? {}
    const to = graph.states.get(edge.to) ?? {}
    const where = `after ${said.join(", ")}: ${view.state(from)} -${edge.action}-> ${view.state(to)}`
    const step = replay.steps[edge.action]
    if (step === undefined) failures.push(`${where} is not connected`)
    else
      await within(step(from, to), edge.action).catch((error: unknown) => failures.push(`${where}: ${String(error)}`))
    if (failures.length > 0) return
    const actual = await replay.seen()
    if (JSON.stringify(actual) !== JSON.stringify(expected(to)))
      failures.push(`${where}\n  code ${JSON.stringify(actual)}\n  spec ${JSON.stringify(expected(to))}`)
    if (failures.length > 0) return
  }
}

function startOf(graph: Graph): string {
  const start = [...graph.states.entries()].find(
    ([, state]) => state.made === 0 && state.reloads === 0 && state.rev === 0,
  )?.[0]
  if (start === undefined) throw new Error("no start")
  return start
}

async function replayed(graph: Graph, view: View): Promise<{ edges: number; walks: number; failures: string[] }> {
  const failures: string[] = []
  const outgoing = new Map<string, Edge[]>()
  for (const edge of graph.edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge])
  const start = startOf(graph)
  const left = new Set(graph.edges)
  let walks = 0
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
    const trail = [...found]
    let at = trail.at(-1)?.to ?? start
    for (;;) {
      const next = (outgoing.get(at) ?? []).find((edge) => left.has(edge) && !trail.includes(edge))
      if (next === undefined) break
      trail.push(next)
      at = next.to
    }
    for (const edge of trail) left.delete(edge)
    walks += 1
    const replay = await world()
    await walk(graph, view, trail, replay, failures)
    await replay.close()
  }
  return { edges: graph.edges.length - left.size, walks, failures }
}

it("replays every edge of the tabs spec through two copies of the device queue on one IndexedDB", async () => {
  const view = (await import(new URL("../../../specs/tabs/view.mjs", import.meta.url).href)) as View
  const graph = await specGraph("tabs", "Tabs")
  const report = await replayed(graph, view)
  expect(report.failures).toEqual([])
  expect(report.edges).toBe(graph.edges.length)
  expect(graph.states.size).toBeLessThan(500)
}, 120_000)

it("repaints a tab that sent the other tab's move, once every answer came", async () => {
  const replay = await walked([
    ["Move", {}],
    ["SendTwo", { wire2: "sent" }],
    ["ApplyTwo", {}],
    ["AnswerTwo", {}],
    ["FollowOne", {}],
  ])
  const [, two] = replay.tabs()
  replay.watchAnswersNow()
  expect(two.painted).toBe("file")
  expect(await two.page.follow(deck)).toMatchObject({ ok: true, changed: true })
})

it("keeps the first tab's saved move when the second tab opens from an older answer", async () => {
  const replay = await walked([
    ["Move", {}],
    ["SendOne", { wire1: "sent" }],
    ["ReloadTwo", { build2: 1 }],
    ["ReadTwo", {}],
    ["ApplyOne", {}],
    ["AnswerOne", {}],
    ["AdoptTwo", {}],
  ])
  expect(await replay.seen()).toMatchObject({ mvc: true, shown2: "moved file" })
})

it("keeps a saved text the second tab's older open answer dropped when the first tab edits it again", async () => {
  installIndexedDb()
  const server = memoryRemote()
  const one = first.connect(server)
  expect(await one.openDeck(deck)).toMatchObject({ ok: true })
  await first.connect(memoryRemote()).enqueue(deck, "Before", node, words)
  expect(await one.flush(deck)).toMatchObject({ ok: true, revision: 1 })
  const two = second.connect(server)
  expect(await two.open(deck)).toEqual({ ok: true })
  await first.connect(memoryRemote()).enqueue(deck, "Mine", node, words)
  expect(await one.flush(deck)).toMatchObject({ ok: true, revision: 2 })
  expect(await two.openDeck(deck)).toMatchObject({ ok: true })
  const planned = await first.connect(memoryRemote()).openDeck(deck)
  if (!planned.ok) throw new Error(planned.refusal)
  const body = planned.register.elements[node]
  await first.connect(memoryRemote()).enqueue(deck, bold(body === undefined ? words : currentValue(body)), node, words)
  expect(await one.flush(deck)).toMatchObject({ ok: true, revision: 3 })
  const stored = await server.open({ deck })
  if (!stored.ok) throw new Error(stored.refusal)
  const kept = stored.register.elements[node]
  expect(kept === undefined ? undefined : currentValue(kept)).toBe("MINE")
})
