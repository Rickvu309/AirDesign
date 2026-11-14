import {
  cellText,
  currentValue,
  decide,
  openRegister,
  readTableValue,
  slideId,
  type Command,
  type ElementId,
  type Register,
} from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { editableSlide } from "./editable-slide"
import { useDeckPaint, type DeckPaint } from "./use-deck-paint"
import { useUndoList, useUndoTurn, type UndoList } from "./use-undo"
import { elementCommand } from "../element-edit"
import { onSlide, twoBoxSlide, xml } from "../slide-fixtures"
import { useTables } from "../table-hook"

const device = vi.hoisted(() => ({ link: null as unknown }))

vi.mock("@airdesign/live", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
  connect: () => device.link,
}))

type Answer = { readonly resolve: (value: { ok: boolean }) => void }
type Exposed = { readonly shown: DeckPaint; readonly undo: UndoList }

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
  const shown = useDeckPaint(deck, pictures, notes, nothing)
  const changeElement = async () => "kept" as const
  const { store, shapes, editParts, canvases, current, showEdited } = shown
  const tables = useTables({ current, store, shapes, editParts, canvases, showEdited, changeElement })
  useUndoTurn({ id: deck, paintedDeck: deck, undo, shown, notesBar: notes, settle: nothing, setPending: nothing })
  props.exposed({ shown, undo })
  return editableSlide({
    id: deck,
    shown,
    undo,
    tables,
    settle: nothing,
    setPending: nothing,
    changeElement,
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
  const { shown, undo } =
    exposed.current ??
    (() => {
      throw new Error("not rendered")
    })()
  await act(async () => {
    shown.shownParts.current = opened.parts
    shown.showRegister(register)
  })
  const cell = host.querySelector<HTMLElement>('[data-table-text="0.0"]')
  if (cell === null) throw new Error("no cell")
  await act(async () => cell.focus())
  return {
    cell,
    sent,
    undo,
    shown,
    typed(text: string) {
      cell.textContent = text
      cell.dispatchEvent(new window.InputEvent("input", { bubbles: true }))
    },
    async answered() {
      await act(async () => {
        for (const answer of answers.splice(0)) answer.resolve({ ok: true })
        await new Promise((done) => setTimeout(done, 0))
      })
    },
    async flushed() {
      await act(async () => {
        for (const flush of flushes.splice(0)) flush.resolve({ ok: true })
        await new Promise((done) => setTimeout(done, 0))
      })
    },
    deckCell: () => {
      const body = register.elements[opened.node]
      const value = body === undefined ? null : readTableValue(currentValue(body))
      return value === null ? "" : cellText(value.rows[0]?.cells[0] ?? [])
    },
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

it("writes each keystroke in a table cell to the device in the keystroke's own task", async () => {
  const table = await tableDeck()
  await act(async () => {
    table.typed("C")
    table.typed("Ce")
    expect(table.sent.map((value) => cellText(readTableValue(value)?.rows[0]?.cells[0] ?? []))).toEqual(["C", "Ce"])
  })
  await table.close()
}, 20_000)

it("takes back the typing in a table cell with one Ctrl+Z straight after it, and paints the focused cell", async () => {
  const table = await tableDeck()
  await act(async () => {
    table.typed("R")
    table.typed("Region")
  })
  const undo = new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })
  await act(async () => table.cell.dispatchEvent(undo))
  await table.answered()
  await table.answered()
  expect(table.undo.undoList.current.redo.map((entry) => entry.name)).toEqual(["text"])
  expect(table.deckCell()).toBe("")
  expect(table.cell.ownerDocument.activeElement).toBe(table.cell)
  expect(table.cell.textContent).toBe("")
  await table.close()
}, 20_000)

it("paints the focused cell's text from before the edit on Ctrl+Z while its last keystroke is still sending", async () => {
  const table = await tableDeck()
  await act(async () => table.typed("Regio"))
  await table.answered()
  await table.flushed()
  await act(async () => table.shown.showEdited(0))
  await act(async () => table.typed("Region"))
  await table.answered()
  const undo = new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })
  await act(async () => table.cell.dispatchEvent(undo))
  await table.answered()
  expect(table.deckCell()).toBe("")
  expect(table.cell.ownerDocument.activeElement).toBe(table.cell)
  expect(table.cell.textContent).toBe("")
  await table.close()
}, 20_000)

it("records a table's typed cell once the device takes it, while the cell is still sending", async () => {
  const table = await tableDeck()
  await act(async () => {
    table.typed("N")
    table.typed("No")
  })
  await table.answered()
  expect(table.undo.undoList.current.undo.map((entry) => `${entry.name} ${entry.session ?? ""}`)).toEqual(["text 1"])
  await table.close()
}, 20_000)
