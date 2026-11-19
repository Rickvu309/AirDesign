import { decide, elementId, openRegister, readTextValue, type Command, type Register } from "@airdesign/document"
import { readPackage } from "@airdesign/pptx"
import { Passage, paintStore } from "@airdesign/render"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { commitEdit } from "./commit-edit"
import { NotesBar } from "./editor/notes-bar"
import type { DeckPaint } from "./editor/use-deck-paint"
import { useUndoList, useUndoTurn, type UndoList as UndoHooks } from "./editor/use-undo"
import { busyElements, liveRepaint, showText, shownValue } from "./live-repaint"
import { useNotes, type NotesDeck } from "./notes-edit"
import { structureOf } from "./table-hook"
import type { UndoEntry, UndoList as UndoSides } from "./undo-list"

const device = vi.hoisted(() => ({ link: null as unknown }))

vi.mock("@airdesign/live", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
  connect: () => device.link,
}))

type Value = boolean | number | string
type Spec = Record<string, Value>
type Edge = { readonly from: string; readonly to: string; readonly action: string }
type Graph = { readonly states: Map<string, Spec>; readonly edges: readonly Edge[] }
type View = { state: (v: Spec) => string }
type Waiting<T> = { readonly promise: Promise<T>; readonly resolve: (value: T) => void }
type Notes = ReturnType<typeof useNotes>
type Lane = "N" | "T"

const deck = "typed-deck"
const slide = "256"
const box = elementId("256.2")
const notesNode = elementId("256.notes")
const oldText = "Old"
const oldNotes = "Talk"
const texts: Record<Lane, readonly string[]> = { T: [oldText, "N", "New"], N: [oldNotes, "S", "Say"] }

function waiting<T>(): Waiting<T> {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function plain(value: string): string {
  const read = readTextValue(value)
  return read === null ? value : read.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

function textIndex(lane: Lane, value: string): number {
  return texts[lane].indexOf(plain(value))
}

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

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let cleanParts: ReadonlyMap<string, Uint8Array> = new Map()

async function settled(work: () => void = () => undefined): Promise<void> {
  await act(async () => {
    work()
    await new Promise((done) => setTimeout(done, 0))
  })
}

type Hooks = { readonly notes: Notes; readonly undo: UndoHooks }

function Editor(props: {
  readonly paint: DeckPaint
  readonly onEdit: (value: string) => void
  readonly notes: Omit<NotesDeck, "typed" | "sessions" | "records">
  readonly exposed: (hooks: Hooks) => void
}) {
  const undo = useUndoList()
  const notes = useNotes({ ...props.notes, typed: undo.typed, sessions: undo.sessions, records: undo.records })
  const nothing = () => undefined
  useUndoTurn({
    id: deck,
    paintedDeck: deck,
    undo,
    shown: props.paint,
    notesBar: notes,
    settle: nothing,
  })
  props.exposed({ notes, undo })
  return createElement(
    "div",
    null,
    createElement(Passage, { store: props.paint.store.current, id: box, onEdit: props.onEdit }),
    createElement(NotesBar, {
      text: notes.notes.find((row) => row.slide === slide)?.text ?? "",
      onEdit: (value) => notes.edit(slide, value),
    }),
  )
}

async function typingDeck() {
  let register: Register = openRegister("", "deck")
  const kept: Record<Lane, Waiting<{ ok: boolean }>[]> = { N: [], T: [] }
  const flushes: Waiting<{ ok: boolean }>[] = []
  const sent: Record<Lane, Waiting<{ ok: boolean }>[]> = { N: [], T: [] }
  const count = { nTyped: 0, nRec: 0, nUp: 0, tTyped: 0, tRec: 0, tUp: 0 }
  let gate: Waiting<undefined> | null = null
  let read: UndoSides | null = null
  const turn = { asked: "none", over: true, done: "none", turned: "none", missing: false, painted: false }
  const exposed: { current: Hooks | null } = { current: null }
  function hooks(): Hooks {
    if (exposed.current === null) throw new Error("not rendered")
    return exposed.current
  }
  function land(command: Command) {
    const decision = decide(register, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    register = decision.register
  }
  device.link = {
    enqueue(_deck: string, value: string, node: typeof box, floor: string) {
      if (register.elements[node] === undefined) land({ command: "add", node, floor, route: "deck" })
      land({ command: "person", node, value })
      if (gate !== null) return Promise.resolve({ ok: true })
      const answer = waiting<{ ok: boolean }>()
      kept[node === notesNode ? "N" : "T"].push(answer)
      return answer.promise
    },
    flush() {
      if (gate !== null) return Promise.resolve({ ok: true })
      const answer = waiting<{ ok: boolean }>()
      flushes.push(answer)
      return answer.promise
    },
    async openDeck() {
      if (gate === null) {
        turn.missing ||= count.tRec < count.tTyped || count.nRec < count.nTyped
        read = hooks().undo.undoList.current
        gate = waiting()
        await gate.promise
      }
      return { ok: true, register }
    },
  }
  const store = paintStore()
  store.publish({ id: box, kind: "shape", text: oldText })
  const busy = busyElements()
  const paint = {
    store: { current: store },
    shownParts: { current: cleanParts },
    structure: { current: structureOf(register) },
    bound: { current: new Set() },
    repaint: { current: liveRepaint(store, new Map([[box, oldText]]), null, busy) },
    setCurrent: () => undefined,
    showRegister: () => (turn.painted = true),
  } as unknown as DeckPaint
  function record(entry: UndoEntry) {
    if ("steps" in entry.undoable && entry.undoable.steps.some((step) => step.node === notesNode)) count.nRec += 1
    else count.tRec += 1
    hooks().undo.record(entry)
  }
  function onEdit(value: string) {
    const free = busy.hold(box)
    const { records, typed, sessions } = hooks().undo
    const release = records.current.hold()
    count.tTyped += 1
    if (typed.current?.node !== box) {
      sessions.current += 1
      typed.current = {
        node: box,
        session: sessions.current,
        before: Promise.resolve(shownValue(register, box, oldText)),
      }
    }
    const { session, before } = typed.current
    showText(store, box, value)
    void commitEdit(
      () => device.link as never,
      deck,
      value,
      { id: box, file: oldText },
      async () => {
        const from = await before
        record({
          name: "text",
          session,
          undoable: {
            steps: [
              { node: box, before: { text: { value: { set: from } } }, after: { text: { value: { set: value } } } },
            ],
          },
        })
        release()
      },
    )
      .then(() => (count.tUp += 1))
      .finally(() => {
        release()
        free()
      })
  }
  function notes(): Notes {
    return hooks().notes
  }
  function asked(key: string) {
    turn.asked = key
    turn.over = false
    read = null
    void hooks().undo.turning.current.then(() => {
      const after = hooks().undo.undoList.current
      const other = key === "undo" ? "redo" : "undo"
      const moved = read !== null && after[other].length > read[other].length ? after[other].at(-1) : undefined
      turn.done = read === null ? "empty" : moved === undefined ? "told" : key === "undo" ? "undone" : "redone"
      const node = moved !== undefined && "steps" in moved.undoable ? moved.undoable.steps[0]?.node : undefined
      if (node !== undefined) turn.turned = node === notesNode ? "N" : "T"
      turn.over = true
      gate = null
    })
  }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const notesDeck = { id: deck, record, settle: () => (count.nUp += 1) }
  const expose = (current: Hooks) => (exposed.current = current)
  await settled(() => root.render(createElement(Editor, { paint, onEdit, notes: notesDeck, exposed: expose })))
  await settled(() => notes().show([{ slide, text: oldNotes }]))
  const found = host.querySelector("[contenteditable]")
  if (!(found instanceof window.HTMLElement)) throw new Error("no box")
  const editor: HTMLElement = found
  await settled(() => host.querySelector<HTMLButtonElement>("button[aria-label='Expand presenter notes']")?.click())
  const opened = host.querySelector("textarea")
  if (opened === null) throw new Error("no notes field")
  const field: HTMLTextAreaElement = opened
  const typedIn = () => (count.tTyped > 0 ? editor : field)
  function filed(lane: Lane) {
    const call = flushes.shift()
    if (call === undefined || flushes.length > 0) throw new Error(`${lane} record sent ${flushes.length + 1} times`)
    sent[lane].push(call)
  }
  function answer(queue: Waiting<{ ok: boolean }>[], at: number) {
    const call = queue[at]
    if (call === undefined) throw new Error("nothing to answer")
    call.resolve({ ok: true })
  }
  async function keyed(direction: "undo" | "redo") {
    const target = typedIn()
    const shiftKey = direction === "redo"
    const event = new window.KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      shiftKey,
      bubbles: true,
      cancelable: true,
    })
    const turning = hooks().undo.turning.current
    await settled(() => {
      target.dispatchEvent(event)
      if (hooks().undo.turning.current !== turning) asked(direction)
    })
    if (!event.defaultPrevented || turn.over) throw new Error(`Ctrl+Z for ${direction} went to the browser`)
  }
  function entries(side: readonly UndoEntry[]): number {
    return side.reduce((digits, entry) => {
      const { undoable } = entry
      const [step, ...rest] = "steps" in undoable ? undoable.steps : []
      if (step === undefined || rest.length > 0) throw new Error("not a text entry")
      const lane: Lane = step.node === notesNode ? "N" : "T"
      const before = lane === "N" ? step.before.notes?.value : step.before.text?.value
      const after = lane === "N" ? step.after.notes?.value : step.after.text?.value
      if (typeof before !== "object" || typeof after !== "object") throw new Error("not a text entry")
      if (textIndex(lane, before.set) !== 0) throw new Error(`${lane} entry starts at ${before.set}`)
      return digits * 10 + textIndex(lane, after.set) + (lane === "N" ? 0 : 2)
    }, 0)
  }
  const steps: Record<string, () => Promise<void> | void> = {
    TypeNotes: () =>
      settled(() => {
        count.nTyped += 1
        notes().edit(slide, texts.N[count.nTyped] ?? "")
      }),
    TypeText: () =>
      settled(() => {
        const node = window.document.createTreeWalker(editor, window.NodeFilter.SHOW_TEXT).nextNode()
        if (node === null) throw new Error("no text")
        node.nodeValue = texts.T[count.tTyped + 1] ?? ""
        editor.dispatchEvent(new window.InputEvent("input", { bubbles: true }))
      }),
    RecordNotes: async () => {
      await settled(() => answer(kept.N, count.nRec))
      filed("N")
    },
    RecordText: async () => {
      await settled(() => answer(kept.T, count.tRec))
      filed("T")
    },
    UploadNotes: () => settled(() => answer(sent.N, count.nUp)),
    UploadText: () => settled(() => answer(sent.T, count.tUp)),
    KeyUndo: () => keyed("undo"),
    KeyRedo: () => keyed("redo"),
    MenuUndo: async () => {
      const event = new window.InputEvent("beforeinput", { inputType: "historyUndo", bubbles: true, cancelable: true })
      await settled(() => typedIn().dispatchEvent(event))
      if (!event.defaultPrevented)
        throw new Error(`the ${count.tTyped > 0 ? "box" : "notes field"} let the browser undo`)
    },
    Turn: () => settled(() => gate?.resolve(undefined)),
  }
  function seen(): Spec {
    const shownNotes = field.value
    return {
      ...count,
      list: entries(hooks().undo.undoList.current.undo),
      redo: entries(hooks().undo.undoList.current.redo),
      ask: turn.over ? "none" : turn.asked,
      deckT: textIndex("T", shownValue(register, box, oldText)),
      deckN: textIndex("N", shownValue(register, notesNode, oldNotes)),
      shownT: textIndex("T", editor.textContent ?? ""),
      shownN: textIndex("N", shownNotes),
      done: turn.done,
      turned: turn.turned,
      missing: turn.missing,
    }
  }
  return {
    steps,
    seen,
    held: () => ({ busy: busy.has(box), reached: gate !== null && !turn.over, painted: turn.painted }),
    close: () => settled(() => root.unmount()),
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
    walks += 1
    const typing = await typingDeck()
    let at = start
    const walk = [...found]
    const onward = () => {
      const next = (outgoing.get(at) ?? []).find((each) => left.has(each))
      if (next !== undefined) walk.push(next)
    }
    if (walk.length === 0) onward()
    for (let edge: Edge | undefined = walk.shift(); edge !== undefined; edge = walk.shift()) {
      left.delete(edge)
      const source = graph.states.get(edge.from) ?? {}
      const target = graph.states.get(edge.to) ?? {}
      const said = `${view.state(source)} -${edge.action}-> ${view.state(target)}`
      const step = typing.steps[edge.action]
      if (step === undefined) failures.push(`${said} is not connected`)
      else await Promise.resolve(step()).catch((error: unknown) => failures.push(`${said}: ${String(error)}`))
      const actual = typing.seen()
      const held = typing.held()
      const busy = Number(target.tUp) < Number(target.tTyped)
      const reached = target.ask !== "none" && target.tRec === target.tTyped && target.nRec === target.nTyped
      if (!same(actual, target)) failures.push(`${said}\n  code ${JSON.stringify(actual)}`)
      if (held.busy !== busy) failures.push(`${said}: the box is ${held.busy ? "" : "not "}busy`)
      if (held.reached !== reached)
        failures.push(`${said}: the undo ${held.reached ? "read" : "did not read"} the deck`)
      if (held.painted) failures.push(`${said}: the undo painted the whole deck again`)
      if (failures.length > 0) break
      at = edge.to
      if (walk.length === 0) onward()
    }
    await typing.close()
  }
  return { walks, edges: graph.edges.length - left.size, failures }
}

beforeAll(async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/clean.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  cleanParts = read.parts
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  const shared: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["Element", window.Element],
    ["Node", window.Node],
    ["InputEvent", window.InputEvent],
    ["Event", window.Event],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    [
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    ],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it("replays every edge of the typing spec through the undo list, the repaint, the notes and the box", async () => {
  const view = (await import(new URL("../../../specs/typing/view.mjs", import.meta.url).href)) as View
  const graph = await specGraph("typing", "Typing")
  const report = await replayed(graph, view)
  expect(report.failures).toEqual([])
  expect(report.edges).toBe(graph.edges.length)
  expect(graph.states.size).toBeLessThan(500)
}, 120_000)

it("brings back the text with one Ctrl+Z after typing notes then the text, while the notes are still sending", async () => {
  const typing = await typingDeck()
  const typed = ["TypeNotes", "TypeNotes", "TypeText", "RecordNotes", "RecordNotes", "RecordText"]
  for (const action of [...typed, "KeyUndo", "Turn"]) await typing.steps[action]?.()
  const shown = typing.seen()
  await typing.close()
  expect({
    nUp: shown.nUp,
    turned: shown.turned,
    shownT: shown.shownT,
    deckT: shown.deckT,
    shownN: shown.shownN,
  }).toEqual({
    nUp: 0,
    turned: "T",
    shownT: 0,
    deckT: 0,
    shownN: 2,
  })
})
