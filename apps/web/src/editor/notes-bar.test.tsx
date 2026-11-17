import { act, createElement, useState } from "react"
import type { Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { NotesBar } from "./notes-bar"
import { useUndoKeys, type UndoKey } from "./undo-keys"

let window: Window & typeof globalThis
let root: Root | null = null
let createRoot: typeof import("react-dom/client").createRoot

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
    ["Event", window.Event],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  window.document.body.replaceChildren()
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

function Notes(props: { readonly text: string; readonly keys: UndoKey[] }) {
  const [text, setText] = useState(props.text)
  useUndoKeys(true, (key) => props.keys.push(key))
  return createElement(NotesBar, { text, onEdit: setText })
}

function rendered(text: string, keys: UndoKey[] = []) {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  act(() => root?.render(createElement(Notes, { text, keys })))
  return host
}

function expand(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll("button")].filter((button) => button.ariaLabel === "Expand speaker notes")
}

function field(host: HTMLElement): HTMLTextAreaElement {
  const found = host.querySelector("textarea")
  if (found === null) throw new Error("no notes field")
  return found
}

it("offers one Expand speaker notes stop while closed", () => {
  const host = rendered("Talk about savings")
  expect(expand(host)).toHaveLength(1)
  expect(host.querySelectorAll("button")).toHaveLength(1)
})

it("puts the cursor at the end of the notes when they open", () => {
  const host = rendered("Talk about savings")
  act(() => expand(host)[0]?.click())
  const box = field(host)
  expect(window.document.activeElement).toBe(box)
  expect([box.selectionStart, box.selectionEnd]).toEqual([box.value.length, box.value.length])
})

it("gives the focus back to the closed bar when the notes collapse", () => {
  const host = rendered("")
  act(() => expand(host)[0]?.click())
  const collapse = host.querySelector<HTMLButtonElement>("button[aria-label='Collapse speaker notes']")
  act(() => collapse?.click())
  expect(window.document.activeElement).toBe(expand(host)[0])
})

it("leaves Ctrl+Z in the notes to the person's undo, never the field's own", () => {
  const keys: UndoKey[] = []
  const host = rendered("Talk", keys)
  act(() => expand(host)[0]?.click())
  const box = field(host)
  const undo = new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })
  const redo = new window.KeyboardEvent("keydown", {
    key: "z",
    ctrlKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  })
  act(() => {
    box.dispatchEvent(undo)
    box.dispatchEvent(redo)
  })
  expect(keys).toEqual(["undo", "redo"])
  expect([undo.defaultPrevented, redo.defaultPrevented]).toEqual([true, true])
  const menu = new window.InputEvent("beforeinput", { inputType: "historyUndo", bubbles: true, cancelable: true })
  box.dispatchEvent(menu)
  expect(menu.defaultPrevented).toBe(true)
})

it("shows the notes it is given while the field has the focus", () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  const shown = (text: string) => root?.render(createElement(NotesBar, { text, onEdit: () => undefined }))
  act(() => shown("Talk"))
  act(() => expand(host)[0]?.click())
  expect(window.document.activeElement).toBe(field(host))
  act(() => shown("Talk about savings"))
  expect(field(host).value).toBe("Talk about savings")
})

it("closes notes on Escape and returns focus without changing their text", () => {
  const host = rendered("Keep this note")
  act(() => expand(host)[0]?.click())
  const escape = new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
  act(() => field(host).dispatchEvent(escape))
  expect(host.querySelector("textarea")).toBeNull()
  expect(window.document.activeElement).toBe(expand(host)[0])
  expect(escape.defaultPrevented).toBe(true)
  act(() => expand(host)[0]?.click())
  expect(field(host).value).toBe("Keep this note")
})
