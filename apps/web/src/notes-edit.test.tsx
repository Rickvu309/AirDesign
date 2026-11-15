import { act, createElement } from "react"
import type { Root } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { useNotes, type NotesDeck } from "./notes-edit"
import { recordsInFlight, type Typing } from "./undo-list"

vi.mock("@airdesign/live", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
  connect: () => ({ enqueue: () => new Promise(() => undefined) }),
}))

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  vi.stubGlobal("window", window)
  vi.stubGlobal("document", window.document)
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  createRoot = (await import("react-dom/client")).createRoot
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

type Notes = ReturnType<typeof useNotes>

it("keeps the notes a person is typing when a paint shows the deck's older notes", () => {
  const typed: { current: Typing | null } = { current: null }
  const deck: NotesDeck = {
    id: "deck",
    typed,
    sessions: { current: 0 },
    records: { current: recordsInFlight() },
    record: () => undefined,
    settle: () => undefined,
    sending: () => undefined,
  }
  const held: { current: Notes | null } = { current: null }
  function Bar() {
    held.current = useNotes(deck)
    return null
  }
  const root: Root = createRoot(window.document.createElement("div"))
  act(() => root.render(createElement(Bar)))
  const shown = () => held.current?.notes.map((row) => `${row.slide}:${row.text}`)
  act(() =>
    held.current?.show([
      { slide: "256", text: "Talk" },
      { slide: "257", text: "Close" },
    ]),
  )
  act(() => held.current?.edit("256", "Talk about savings"))
  act(() =>
    held.current?.show([
      { slide: "256", text: "Talk" },
      { slide: "257", text: "Close soon" },
    ]),
  )
  expect(shown()).toEqual(["256:Talk about savings", "257:Close soon"])
  typed.current = null
  act(() =>
    held.current?.show([
      { slide: "256", text: "Talk" },
      { slide: "257", text: "Close soon" },
    ]),
  )
  expect(shown()).toEqual(["256:Talk", "257:Close soon"])
  act(() => root.unmount())
})
