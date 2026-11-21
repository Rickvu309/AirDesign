import { elementId, openRegister, type Register } from "@airdesign/document"
import { act, createElement } from "react"
import type { Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { useLeaveGuard } from "./leave-guard"
import { paintingAhead, personCommands, type PaintAhead } from "./painted-ahead"

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

const device = openRegister("", "deck")
const linked = () => personCommands(device, elementId("256.2"), "", { value: "https://example.com" })

function canvas(): PaintAhead {
  let shown: Register | null = device
  const ahead = paintingAhead({
    shown: () => shown,
    keep: (register) => {
      shown = register
    },
    show: (register) => {
      shown = ahead.on(register)
    },
  })
  return ahead
}

function guarded(pending: boolean, ahead: PaintAhead) {
  const seen = { painting: false, unsent: false }
  function Editor() {
    Object.assign(seen, useLeaveGuard(pending, ahead))
    return null
  }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  act(() => root?.render(createElement(Editor)))
  return seen
}

function asksToStay(): boolean {
  const leaving = new window.Event("beforeunload", { cancelable: true })
  window.dispatchEvent(leaving)
  return leaving.defaultPrevented
}

it("asks before the tab reloads or closes while an edit is painted ahead of the device, until the device stored it", () => {
  const ahead = canvas()
  const seen = guarded(false, ahead)
  expect([seen.painting, seen.unsent, asksToStay()]).toEqual([false, false, false])
  let stored = () => undefined as void
  act(() => {
    stored = ahead.paint(linked())
  })
  expect([seen.painting, seen.unsent, asksToStay()]).toEqual([true, true, true])
  act(() => stored())
  expect([seen.painting, seen.unsent, asksToStay()]).toEqual([false, false, false])
})

it("keeps asking while a held edit waits on the device after a painted one was stored", () => {
  const ahead = canvas()
  const seen = guarded(false, ahead)
  let typed = () => undefined as void
  let painted = () => undefined as void
  act(() => {
    typed = ahead.hold(linked())
    painted = ahead.paint(linked())
  })
  act(() => painted())
  expect([seen.painting, seen.unsent, asksToStay()]).toEqual([true, true, true])
  act(() => typed())
  expect([seen.painting, seen.unsent, asksToStay()]).toEqual([false, false, false])
})

it("asks while stored edits still wait to reach AirDesign, as Figma does with unsynced changes", () => {
  const seen = guarded(true, canvas())
  expect([seen.painting, seen.unsent, asksToStay()]).toEqual([false, true, true])
})

it("stops asking once the editor closes", () => {
  const ahead = canvas()
  guarded(true, ahead)
  act(() => root?.unmount())
  root = null
  expect(asksToStay()).toBe(false)
})
