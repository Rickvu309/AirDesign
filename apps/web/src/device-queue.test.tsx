import { accountCookieName, deckRoutes, type WireEdit, type WireSlide } from "@airdesign/catalog"
import {
  elementGone,
  elementId,
  landedPatch,
  slideId,
  type ElementPatch,
  type Register,
  type SetChange,
} from "@airdesign/document"
import { connect, deleteDatabase, memoryRemote, type CommitResult } from "@airdesign/live"
import { readPackage } from "@airdesign/pptx"
import { paintStore } from "@airdesign/render"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { flushPending, server as deckServer, type CommitOutcome } from "./commit-edit"
import { changeDesign } from "./design/design-change"
import type { UndoButtonsState } from "./editor/undo-buttons"
import { paintingAhead } from "./editor/painted-ahead"
import { until, within } from "./replay-waits"
import type { DeckPaint } from "./editor/use-deck-paint"
import { useUndoList, useUndoTurn, type UndoList as UndoHooks } from "./editor/use-undo"
import { structureOf } from "./table-hook"
import type { UndoEntry } from "./undo-list"

type Run = () => Promise<unknown>
type Held = { readonly run: Run; readonly resolve: (value: unknown) => void; readonly reject: (error: unknown) => void }

const hold = vi.hoisted(() => ({ flush: null as null | ((run: () => Promise<unknown>) => Promise<unknown>) }))

vi.mock("@airdesign/live", async () => {
  const actual = await vi.importActual<{
    connect: (...given: unknown[]) => { readonly flush: (deck: string) => Promise<unknown> }
  }>("@airdesign/live")
  return {
    ...actual,
    connect: (...given: unknown[]) => {
      const live = actual.connect(...given)
      return {
        ...live,
        flush: (deck: string) => (hold.flush === null ? live.flush(deck) : hold.flush(() => live.flush(deck))),
      }
    },
  }
})

type Value = boolean | number | string
type Spec = Record<string, Value>
type Edge = { readonly from: string; readonly to: string; readonly action: string }
type Graph = { readonly states: Map<string, Spec>; readonly edges: readonly Edge[] }
type View = { state: (v: Spec) => string }
type Hooks = { readonly undo: UndoHooks; readonly buttons: UndoButtonsState }
type Body = { readonly deck: string; readonly batch: readonly (WireEdit | WireSlide)[]; readonly once?: string }
type Wire = {
  readonly body: Body
  readonly resolve: (response: Response) => void
  readonly reject: (error: Error) => void
  answer?: CommitResult
}

const slide = slideId("256")
const node = elementId("256.2")
const widths = [0, 0, 25400, 50800]
const firstAccount = "a".repeat(32)

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let cleanParts: ReadonlyMap<string, Uint8Array> = new Map()
let installIndexedDb: () => void = () => undefined
let walks = 0
let losses = 0

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

function widthCode(edit: unknown): number {
  if (edit === undefined || edit === "opening") return 1
  if (typeof edit === "object" && edit !== null && "set" in edit) return widths.indexOf(Number(edit.set))
  throw new Error(`not a width ${JSON.stringify(edit)}`)
}

function borderWidth(patch: ElementPatch | undefined): unknown {
  return patch?.border?.width
}

function shownWidth(register: Register | null): number {
  if (register === null) return 1
  if (elementGone(register, node)) return 0
  const body = register.elements[node]
  return widthCode(body === undefined ? undefined : borderWidth(landedPatch(body, "text")))
}

function stepsCode(side: readonly UndoEntry[]): number {
  return side.reduce((code, entry) => {
    const { undoable } = entry
    const [step, ...rest] = "steps" in undoable ? undoable.steps : []
    if (step === undefined || rest.length > 0 || step.node !== node) throw new Error("not a width step")
    return code * 100 + widthCode(borderWidth(step.before)) * 10 + widthCode(borderWidth(step.after))
  }, 0)
}

function digits(number: Value | undefined): number[] {
  return Number(number) === 0 ? [] : String(number).split("").map(Number)
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const lostAnswers: readonly ((wire: Wire) => void)[] = [
  (wire) =>
    wire.resolve(
      new Response(JSON.stringify(wire.answer).slice(0, 12), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  (wire) =>
    wire.resolve(
      new Response("<html><body>Gateway timeout</body></html>", {
        status: 504,
        headers: { "content-type": "text/html" },
      }),
    ),
]

function Editor(props: {
  readonly deck: string
  readonly paint: DeckPaint
  readonly settle: (outcome: CommitOutcome) => void
  readonly exposed: (hooks: Hooks) => void
}) {
  const undo = useUndoList()
  const nothing = () => undefined
  const buttons = useUndoTurn({
    id: props.deck,
    paintedDeck: props.deck,
    undo,
    shown: props.paint,
    notesBar: { show: nothing },
    settle: props.settle,
  })
  props.exposed({ undo, buttons })
  return null
}

async function queueDeck() {
  walks += 1
  const deck = `device-queue-${walks}`
  installIndexedDb()
  vi.stubGlobal("document", window.document)
  const server = memoryRemote()
  const held: Held[] = []
  let wire: Wire | null = null
  let running: Promise<unknown> | null = null
  let repaint = false
  let aside = 0
  let told = false
  hold.flush = (run) =>
    new Promise((resolve, reject) => {
      held.push({ run, resolve, reject })
    })
  vi.stubGlobal("fetch", async (path: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Body
    if (path === deckRoutes.open.path) return json(200, await server.open(body))
    if (path !== deckRoutes.commit.path) throw new Error(`no route ${path}`)
    return new Promise<Response>((resolve, reject) => {
      wire = { body, resolve, reject }
    })
  })
  const opened = await connect(deckServer).openDeck(deck)
  if (!opened.ok) throw new Error("the device did not open the deck")
  const painted: { register: Register | null } = { register: null }
  const bound: ReadonlySet<string> = new Set()
  const structure = { current: structureOf(null, bound) }
  const ahead = paintingAhead({
    shown: () => painted.register,
    keep: (register) => {
      painted.register = register
    },
    show: (register) => showRegister(register),
  })
  const showRegister = (register: Register | null) => {
    painted.register = register === null ? null : ahead.on(register)
    structure.current = structureOf(register, bound)
  }
  const paint = {
    store: { current: paintStore() },
    shownParts: { current: cleanParts },
    editParts: { current: cleanParts },
    boxes: { current: new Map() },
    movables: { current: new Map() },
    shapes: { current: new Map() },
    structure,
    bound: { current: bound },
    repaint: { current: () => undefined },
    setCurrent: () => undefined,
    saySlide: { current: () => undefined },
    shownRegister: {
      get current() {
        return painted.register
      },
    },
    ahead,
    paintedOf: ahead.on,
    showRegister,
  } as unknown as DeckPaint
  showRegister(opened.register)
  const settle = (outcome: CommitOutcome) => {
    if (outcome === "set-aside") repaint = true
  }
  const exposed: { current: Hooks | null } = { current: null }
  const hooks = (): Hooks => {
    if (exposed.current === null) throw new Error("not rendered")
    return exposed.current
  }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await act(async () =>
    root.render(createElement(Editor, { deck, paint, settle, exposed: (now) => (exposed.current = now) })),
  )
  const design = () => ({
    id: deck,
    shown: paint,
    undo: hooks().undo,
    record: hooks().undo.record,
    settle,
  })
  const widthChange = (code: number): SetChange => ({ target: { node }, border: { width: widths[code] } }) as SetChange
  async function clicked(click: () => void, direction: "undo" | "redo" | null) {
    await act(async () => {
      click()
      await within(hooks().undo.turning.current, "the click's link")
    })
    const said = hooks().undo.undoShown.told
    if (said !== null && said !== direction) throw new Error(`the person was told about ${said}`)
    told = said !== null
  }
  function request(): Wire {
    if (wire === null) throw new Error("no request on its way")
    return wire
  }
  async function sent(): Promise<void> {
    await until(() => wire !== null, "the device's request")
  }
  async function ended(): Promise<void> {
    if (running === null) throw new Error("no send running")
    const result = await within(running, "the send")
    running = null
    if (typeof result === "object" && result !== null && "aside" in result) aside += Number(result.aside)
  }
  const steps: Record<string, (from: Spec, to: Spec) => Promise<void>> = {
    ClickFirst: () => clicked(() => changeDesign(design(), () => widthChange(2)), null),
    ClickSecond: () => clicked(() => changeDesign(design(), () => widthChange(3)), null),
    ClickUndo: () => clicked(() => hooks().buttons.onUndo(), "undo"),
    ClickRedo: () => clicked(() => hooks().buttons.onRedo(), "redo"),
    Send: async () => {
      if (held.length === 0) void flushPending(connect, deck).then(settle)
      const calls = held.splice(0)
      const [first] = calls
      if (first === undefined) throw new Error("no send was asked for")
      running = first.run().then(
        (result) => {
          for (const call of calls) call.resolve(result)
          return result
        },
        (error: unknown) => {
          for (const call of calls) call.reject(error)
          return error
        },
      )
      await sent()
    },
    Apply: async () => {
      const wired = request()
      wired.answer = await server.commit(wired.body)
      if (!wired.answer.ok) throw new Error(`the server refused ${wired.answer.refusal}`)
    },
    Refuse: async () => {
      const wired = request()
      wired.answer = await server.commit(wired.body)
      if (wired.answer.ok) throw new Error("the server applied a batch on a deleted element")
    },
    Answer: async (_from, to) => {
      const wired = request()
      wire = null
      wired.resolve(json(200, wired.answer))
      if (to.wire === "sent") await sent()
      else await ended()
    },
    Lose: async () => {
      const wired = request()
      wire = null
      const way = lostAnswers[losses % lostAnswers.length]
      if (way === undefined) throw new Error("no way to lose")
      losses += 1
      way(wired)
      await ended()
    },
    SetAside: async () => {
      const wired = request()
      wire = null
      wired.resolve(json(200, wired.answer))
      await ended()
    },
    Reconcile: async () => {
      const next = await connect(memoryRemote()).openDeck(deck)
      if (!next.ok) throw new Error("the device did not open the deck")
      if (structure.current !== structureOf(next.register, bound)) showRegister(next.register)
      repaint = false
    },
    AgentDelete: async () => {
      const removed = await server.commit({
        deck,
        batch: [{ slide: "element-remove", id: slide, node, file: [slide] } as WireSlide],
      })
      if (!removed.ok) throw new Error(`the agent's delete was refused ${removed.refusal}`)
    },
  }
  async function seen(): Promise<Spec> {
    const stored = await server.open({ deck })
    if (!stored.ok) throw new Error(stored.refusal)
    const device = await connect(memoryRemote()).openDeck(deck)
    if (!device.ok) throw new Error("the device did not open the deck")
    const pending = await connect(memoryRemote()).pending(deck)
    const landed = stored.register.elements[node]?.landed ?? []
    const list = hooks().undo.undoList.current
    return {
      pending: pending.map((row) => (row.v === undefined ? -1 : widthCode(borderWidth(row.patch)))).join(""),
      sealed: pending.filter((row) => row.once !== undefined).length,
      wire: wire === null ? "none" : wire.answer === undefined ? "sent" : wire.answer.ok ? "applied" : "refused",
      onServer: landed.map((row) => (row.v === undefined ? -1 : widthCode(borderWidth(row.patch)))).join(""),
      gone: elementGone(stored.register, node),
      device: shownWidth(device.register),
      aside,
      shown: shownWidth(painted.register),
      repaint,
      undo: stepsCode(list.undo),
      redo: stepsCode(list.redo),
      told,
      asked: held.length > 0,
    }
  }
  const close = async () => {
    hold.flush = null
    if (wire !== null) wire.reject(new TypeError("closed"))
    for (const call of held.splice(0)) call.reject(new TypeError("closed"))
    if (running !== null) await running.catch(() => undefined)
    await act(async () => root.unmount())
    host.remove()
    await deleteDatabase()
  }
  return { steps, seen, close }
}

function modelled(v: Spec): Spec {
  const wrote = digits(v.wrote)
  const rows = (ids: readonly number[]) => ids.map((id) => wrote[id - 1]).join("")
  const pendingRows = wrote.slice(Number(v.left))
  const device = Number(v.mirror) === 0 ? 0 : pendingRows.length > 0 ? Number(wrote.at(-1)) : Number(v.mirror)
  return {
    pending: pendingRows.join(""),
    sealed: v.sealed ?? 0,
    wire: v.wire ?? "none",
    onServer: rows(digits(v.onServer)),
    gone: v.gone ?? false,
    device,
    aside: v.aside ?? 0,
    shown: v.shown ?? 1,
    repaint: v.repaint ?? false,
    undo: v.undo ?? 0,
    redo: v.redo ?? 0,
    told: v.told ?? false,
  }
}

function same(left: Spec, right: Spec): boolean {
  const sorted = (spec: Spec) => JSON.stringify(Object.entries(spec).sort(([a], [b]) => a.localeCompare(b)))
  return sorted(left) === sorted(right)
}

async function replayed(graph: Graph, view: View): Promise<{ walks: number; edges: number; failures: string[] }> {
  const failures: string[] = []
  const outgoing = new Map<string, Edge[]>()
  for (const edge of graph.edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge])
  const targets = new Set(graph.edges.map((edge) => edge.to))
  const start = [...graph.states.keys()].find((id) => !targets.has(id))
  if (start === undefined) throw new Error("no start")
  const left = new Set(graph.edges)
  let taken = 0
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
    taken += 1
    const world = await queueDeck()
    let at = start
    const walk = [...found]
    const trail: string[] = []
    const onward = () => {
      const next = (outgoing.get(at) ?? []).find((each) => left.has(each))
      if (next !== undefined) walk.push(next)
    }
    if (walk.length === 0) onward()
    for (let edge: Edge | undefined = walk.shift(); edge !== undefined; edge = walk.shift()) {
      left.delete(edge)
      trail.push(edge.action)
      const source = graph.states.get(edge.from) ?? {}
      const target = graph.states.get(edge.to) ?? {}
      const said = `after ${trail.join(", ")}: ${view.state(source)} -${edge.action}-> ${view.state(target)}`
      const step = world.steps[edge.action]
      if (step === undefined) failures.push(`${said} is not connected`)
      else await step(source, target).catch((error: unknown) => failures.push(`${said}: ${String(error)}`))
      if (failures.length > 0) break
      const { asked, ...actual } = await world.seen()
      const expected = modelled(target)
      if (!same(actual, expected))
        failures.push(`${said}\n  code ${JSON.stringify(actual)}\n  model ${JSON.stringify(expected)}`)
      const waiting = target.wire === "none" && digits(target.wrote).length > Number(target.left)
      if (waiting && asked !== true && Number(target.losses) === 0)
        failures.push(`${said}: rows wait on the device and no send was asked for`)
      if (failures.length > 0) break
      at = edge.to
      if (walk.length === 0) onward()
    }
    await world.close()
  }
  return { walks: taken, edges: graph.edges.length - left.size, failures }
}

beforeAll(async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/clean.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  cleanParts = read.parts
  const fixtures: string = new URL("../../../packages/live/src/browser-fixtures.ts", import.meta.url).href
  installIndexedDb = ((await import(fixtures)) as { installIndexedDb: () => void }).installIndexedDb
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  window.document.cookie = `${accountCookieName}=${firstAccount}`
  const shared: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["localStorage", window.localStorage],
    ["HTMLElement", window.HTMLElement],
    ["Element", window.Element],
    ["Node", window.Node],
    ["Event", window.Event],
    ["KeyboardEvent", window.KeyboardEvent],
    ["FocusEvent", window.FocusEvent],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
}, 60_000)

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it("replays every edge of the device-queue spec through the panel change, the undo chain, the device queue and the server", async () => {
  const view = (await import(new URL("../../../specs/device-queue/view.mjs", import.meta.url).href)) as View
  const graph = await specGraph("device-queue", "DeviceQueue")
  const report = await replayed(graph, view)
  expect(report.failures).toEqual([])
  expect(report.edges).toBe(graph.edges.length)
  expect(graph.states.size).toBeLessThan(500)
}, 600_000)
