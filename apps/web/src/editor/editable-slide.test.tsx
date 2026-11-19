import { decide, openRegister, slideId, type Command, type ElementId, type Register } from "@airdesign/document"
import { noSelection } from "@airdesign/render"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { editableSlide } from "./editable-slide"
import { useDeckPaint, type DeckPaint } from "./use-deck-paint"
import { saveStatus, useDeckStatus, type SaveStatus } from "./use-deck-status"
import { useUndoList, useUndoTurn, type UndoList } from "./use-undo"
import { elementCommand } from "../element-edit"
import { onSlide, twoBoxSlide, xml } from "../slide-fixtures"

const device = vi.hoisted(() => ({ link: null as unknown }))

vi.mock("@airdesign/live", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
  connect: () => device.link,
}))

type Answer = { readonly resolve: (value: { ok: boolean }) => void }
type Exposed = { readonly shown: DeckPaint; readonly undo: UndoList; readonly status: SaveStatus }

const deck = "table-deck"
const size = { width: 12192000, height: 6858000 }
let window: Window & typeof globalThis

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function insertedTable() {
  const parts = onSlide(xml(twoBoxSlide))
  const top = { x: 0, y: 0, width: size.width, height: 3000000, rotation: 0, flipH: false, flipV: false }
  const edit = elementCommand(parts, openRegister("", ""), {
    change: "table",
    index: 0,
    size: { ...size, elements: [{ box: top }] },
    rows: 3,
    columns: 3,
  })
  if (edit?.slide !== "element-add") throw new Error("element-add")
  const register = applied(openRegister("", ""), { command: "slide", file: [slideId("256")], edit })
  return { parts, register, node: edit.element.node }
}

function Deck(props: { readonly exposed: (deck: Exposed) => void }) {
  const nothing = () => undefined
  const notes = { show: nothing }
  const pictures = { store: { bytes: new Map(), load: async () => false, keep: nothing } }
  const undo = useUndoList()
  const status = useDeckStatus(deck)
  const { settle } = status
  const shown = useDeckPaint(deck, pictures, notes)
  const changeElement = async () => "kept" as const
  useUndoTurn({ id: deck, paintedDeck: deck, undo, shown, notesBar: notes, settle: nothing })
  props.exposed({ shown, undo, status: saveStatus(status) })
  return editableSlide({
    id: deck,
    shown,
    undo,
    record: nothing,
    settle,
    changeElement,
    selection: noSelection,
    select: nothing,
  })(800)
}

async function tableDeck() {
  const opened = insertedTable()
  let register = opened.register
  const sent: string[] = []
  const answers: Answer[] = []
  const flushes: Answer[] = []
  device.link = {
    enqueue(_deck: string, value: string, node: ElementId, floor: string) {
      if (register.elements[node] === undefined)
        register = applied(register, { command: "add", node, floor, route: "deck" })
      register = applied(register, { command: "person", node, value })
      sent.push(value)
      return new Promise((resolve) => answers.push({ resolve }))
    },
    flush: () => new Promise((resolve) => flushes.push({ resolve })),
    openDeck: async () => ({ ok: true, register }),
  }
  const exposed: { current: Exposed | null } = { current: null }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(createElement(Deck, { exposed: (now) => (exposed.current = now) })))
  const { shown } =
    exposed.current ??
    (() => {
      throw new Error("not rendered")
    })()
  await act(async () => {
    shown.shownParts.current = opened.parts
    shown.showRegister(register)
  })
  const cell = host.querySelector<HTMLElement>('[data-table-text="0.0"]')
  expect(cell).toBeNull()
  expect(host.querySelector("[data-canvas-table]")).not.toBeNull()
  return {
    host,
    close: async () => {
      await act(async () => {
        for (const flush of flushes.splice(0)) flush.resolve({ ok: true })
        root.unmount()
      })
      host.remove()
    },
  }
}

beforeAll(async () => {
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
    ["KeyboardEvent", window.KeyboardEvent],
    ["Event", window.Event],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it("paints a saved table without cell authoring", async () => {
  const table = await tableDeck()
  expect(table.host.querySelector("[data-table-bar]")).toBeNull()
  await table.close()
})
