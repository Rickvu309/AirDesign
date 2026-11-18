import { act, createElement, useState } from "react"
import type { Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { NotesBar } from "./notes-bar"
import { useUndoKeys, type UndoKey } from "./undo-keys"

let window: Window & typeof globalThis
let root: Root | null = null
let pointerAt = 0
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
    [
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    ],
    [
      "requestAnimationFrame",
      (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
    ],
    ["cancelAnimationFrame", () => undefined],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  pointerAt = 0
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
  act(() => handle(host).click())
  return host
}

function expand(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll("button")].filter((button) => button.ariaLabel === "Expand presenter notes")
}

function field(host: HTMLElement): HTMLTextAreaElement {
  const found = host.querySelector("textarea")
  if (found === null) throw new Error("no notes field")
  return found
}

it("offers one Expand presenter notes stop while closed", () => {
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
  const collapse = host.querySelector<HTMLButtonElement>("button[aria-label='Collapse presenter notes']")
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
  expect(field(host).value).toBe("Talk")
  field(host).focus()
  expect(window.document.activeElement).toBe(field(host))
  act(() => shown("Talk about savings"))
  expect(field(host).value).toBe("Talk about savings")
})

function handle(host: HTMLElement): HTMLButtonElement {
  const button = host.querySelector("button")
  if (!button) throw new Error("no notes handle")
  return button
}

function pointer(host: HTMLElement, type: string, y: number) {
  const button = handle(host)
  button.setPointerCapture = () => undefined
  act(() => {
    const event = new window.MouseEvent(type, { clientY: y, button: 0, bubbles: true })
    Object.defineProperty(event, "pointerId", { value: 1 })
    pointerAt += 20
    Object.defineProperty(event, "timeStamp", { value: pointerAt })
    button.dispatchEvent(event)
  })
}

it("distinguishes a click from a drag and keeps the chosen height through toggles", () => {
  const host = rendered("")
  act(() => handle(host).click())
  pointer(host, "pointerdown", 400)
  pointer(host, "pointermove", 280)
  pointer(host, "pointerup", 280)
  act(() => handle(host).click())
  expect(field(host).closest("[data-notes-bar]")?.getAttribute("style")).toContain("280px")
  act(() => handle(host).click())
  act(() => handle(host).click())
  expect(field(host).closest("[data-notes-bar]")?.getAttribute("style")).toContain("280px")
})

it("resizes with arrows and Home without moving focus into the field", () => {
  const host = rendered("")
  act(() => handle(host).click())
  handle(host).focus()
  act(() => handle(host).dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })))
  expect(field(host).closest("[data-notes-bar]")?.getAttribute("style")).toContain("184px")
  expect(window.document.activeElement).toBe(handle(host))
  act(() => handle(host).dispatchEvent(new window.KeyboardEvent("keydown", { key: "Home", bubbles: true })))
  expect(field(host).closest("[data-notes-bar]")?.getAttribute("style")).toContain("160px")
})

it("opens in the same drag from collapsed and collapses past the minimum on release", () => {
  const host = rendered("")
  pointer(host, "pointerdown", 400)
  pointer(host, "pointermove", 280)
  expect(field(host).closest("[data-notes-bar]")?.getAttribute("style")).toContain("144px")
  pointer(host, "pointerup", 280)
  pointer(host, "pointerdown", 280)
  pointer(host, "pointermove", 400)
  pointer(host, "pointerup", 400)
  expect(expand(host)).toHaveLength(1)
})

it("treats less than four pixels as a click and opens after a small upward drag", () => {
  const host = rendered("")
  pointer(host, "pointerdown", 400)
  pointer(host, "pointermove", 398)
  pointer(host, "pointerup", 398)
  act(() => handle(host).click())
  expect(field(host).readOnly).toBe(false)
  act(() => handle(host).click())
  pointer(host, "pointerdown", 400)
  pointer(host, "pointermove", 390)
  pointer(host, "pointerup", 390)
  act(() => handle(host).click())
  expect(field(host).closest("[data-notes-bar]")?.getAttribute("style")).toContain("160px")
})

it("keeps static notes read-only and cancels a drag without toggling", () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  act(() => root?.render(createElement(NotesBar, { text: "Read only" })))
  expect(field(host).readOnly).toBe(true)
  expect(field(host).hasAttribute("data-person-undo")).toBe(true)
  pointer(host, "pointerdown", 400)
  pointer(host, "pointermove", 280)
  pointer(host, "pointercancel", 280)
  expect(field(host).closest("[data-notes-bar]")?.getAttribute("style")).toContain("160px")
  act(() => handle(host).click())
  expect(expand(host)).toHaveLength(1)
})

it("leaves only the handle visible when collapsed", () => {
  const host = rendered("Talk about savings")
  expect(field(host).value).toBe("Talk about savings")
  expect(host.querySelector("[data-notes-bar]")?.getAttribute("style")).toContain("24px")
})

it("starts with a compact notes field", () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  act(() => root?.render(createElement(NotesBar, { text: "" })))
  expect(handle(host).ariaExpanded).toBe("true")
  expect(field(host).closest("[data-notes-bar]")?.getAttribute("style")).toContain("160px")
})
