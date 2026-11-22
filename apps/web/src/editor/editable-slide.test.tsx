import {
  decide,
  elementId,
  openRegister,
  type Command,
  type ElementId,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { noSelection } from "@airdesign/render"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { editableSlide } from "./editable-slide"
import { deckInserts } from "./inserts"
import { useDeckPaint, type DeckPaint } from "./use-deck-paint"
import { saveStatus, useDeckStatus, type SaveStatus } from "./use-deck-status"
import { useUndoList, useUndoTurn, type UndoList } from "./use-undo"
import { onSlide, twoBoxSlide, xml } from "../slide-fixtures"

const device = vi.hoisted(() => ({ link: null as unknown }))

vi.mock("@airdesign/live", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
  connect: () => device.link,
}))

type Answer = { readonly resolve: (value: { ok: boolean }) => void }
type Exposed = {
  readonly shown: DeckPaint
  readonly undo: UndoList
  readonly status: SaveStatus
  readonly inserts: ReturnType<typeof deckInserts>
}

const deck = "table-deck"
let window: Window & typeof globalThis

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function Deck(props: { readonly exposed: (deck: Exposed) => void }) {
  const nothing = () => undefined
  const notes = { show: nothing }
  const pictures = { store: { bytes: new Map(), load: async () => false, keep: nothing } }
  const undo = useUndoList()
  const status = useDeckStatus(deck)
  const { settle } = status
  const shown = useDeckPaint(deck, pictures, notes, undo.lane)
  const inserts = deckInserts({
    id: deck,
    shown,
    pictureTool: pictures,
    hold: () => undo.records.current.hold(),
    settle,
    lane: undo.lane,
  })
  const { changeElement } = inserts
  useUndoTurn({ id: deck, paintedDeck: deck, undo, shown, notesBar: notes, settle: nothing })
  props.exposed({ shown, undo, status: saveStatus(status), inserts })
  return editableSlide({
    id: deck,
    shown,
    undo,
    settle,
    changeElement,
    selection: noSelection,
    select: nothing,
    placedText: inserts.placedText,
  })(800)
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
    ["getComputedStyle", window.getComputedStyle.bind(window)],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

async function typingDeck() {
  const parts = onSlide(xml(twoBoxSlide))
  let register = openRegister("", "")
  const answers: Answer[] = []
  device.link = {
    enqueue(_deck: string, value: string, node: ElementId, floor: string) {
      if (register.elements[node] === undefined)
        register = applied(register, { command: "add", node, floor, route: "deck" })
      register = applied(register, { command: "person", node, value })
      return new Promise((resolve) => answers.push({ resolve }))
    },
    enqueueSlide(_deck: string, file: readonly SlideId[], edit: SlideCommand) {
      register = applied(register, { command: "slide", file, edit })
      return Promise.resolve({ ok: true })
    },
    flush: async () => ({ ok: true }),
    pending: async () => [],
    openDeck: async () => ({ ok: true, register }),
  }
  const exposed: { current: Exposed | null } = { current: null }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(createElement(Deck, { exposed: (now) => (exposed.current = now) })))
  const deck = () => {
    if (exposed.current === null) throw new Error("not rendered")
    return exposed.current
  }
  await act(async () => {
    deck().shown.shownParts.current = parts
    deck().shown.showRegister(register)
  })
  return {
    deck,
    async type(shape: number, value: string) {
      const box = host.querySelector<HTMLElement>(
        `[data-canvas-element="ppt/slides/slide1.xml#${shape}"] [contenteditable='true']`,
      )
      if (box === null) throw new Error("no text box")
      await act(async () => {
        const text = window.document.createTreeWalker(box, window.NodeFilter.SHOW_TEXT).nextNode()
        if (text === null) box.append(value)
        else text.nodeValue = value
        box.dispatchEvent(new window.InputEvent("input", { bubbles: true }))
        await new Promise((done) => setTimeout(done, 0))
      })
    },
    async answer() {
      await act(async () => {
        for (const answer of answers.splice(0)) answer.resolve({ ok: true })
        await new Promise((done) => setTimeout(done, 0))
      })
    },
    unanswered: () => answers.length,
    undone: () => deck().undo.undoList.current.undo.map((entry) => entry.name),
    async close() {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

it("keeps a command recorded after typing above the typed edit while the device still holds the keystroke", async () => {
  const typing = await typingDeck()
  await act(async () => typing.deck().shown.setEntering({ id: elementId("256.2") }))
  await typing.type(2, "Hello there")
  expect(typing.unanswered()).toBe(1)
  await act(async () => {
    typing.deck().inserts.addShape("rect")
    await new Promise((done) => setTimeout(done, 0))
  })
  await typing.answer()
  expect(typing.undone()).toEqual(["text", "add-shape"])
  await typing.close()
})

it("keeps a placed text box beneath the words typed into it", async () => {
  const typing = await typingDeck()
  await act(async () => typing.deck().inserts.addText({ x: 1_524_000, y: 762_000 }))
  await typing.type(4, "Market context")
  await typing.answer()
  expect(typing.undone()).toEqual(["add-box", "text"])
  await typing.close()
})

it("stores a keystroke only after an insert queued before it was stored", async () => {
  const typing = await typingDeck()
  let store = () => undefined as void
  await act(async () => {
    void typing.deck().undo.lane(async (stored) => {
      await new Promise<void>((done) => {
        store = done
      })
      stored()
    })
  })
  await typing.type(2, "Hello there")
  expect(typing.unanswered()).toBe(0)
  await act(async () => {
    store()
    await new Promise((done) => setTimeout(done, 0))
  })
  expect(typing.unanswered()).toBe(1)
  await typing.answer()
  await typing.close()
})
