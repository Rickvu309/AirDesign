import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let ActionsPanel: typeof import("./actions-popover").ActionsPanel

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>").window
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    Element: window.Element,
    Node: window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
  ActionsPanel = (await import("./actions-popover")).ActionsPanel
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

async function openPanel() {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const run = { chart: vi.fn(), icon: vi.fn(), exportPdf: vi.fn() }
  const finish = vi.fn()
  await act(async () => root.render(createElement(ActionsPanel, { run, finish })))
  const input = host.querySelector("input")
  if (input === null) throw new Error("search")
  const type = (text: string) =>
    act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
      setter?.call(input, text)
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
  const press = (key: string) =>
    act(async () => {
      input.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
    })
  return { host, root, run, finish, type, press, input }
}

it("runs the top match when Enter is pressed in the search", async () => {
  const panel = await openPanel()
  try {
    await panel.type("pie")
    await panel.press("Enter")
    expect(panel.run.chart).toHaveBeenCalledWith("pie")
    expect(panel.finish).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("moves the highlight through the results with the arrow keys and runs the highlighted one", async () => {
  const panel = await openPanel()
  try {
    await panel.type("chart")
    await panel.press("ArrowDown")
    await panel.press("ArrowDown")
    await panel.press("ArrowUp")
    await panel.press("Enter")
    expect(panel.run.chart).toHaveBeenCalledWith("bar")
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("keeps the highlight on the first result instead of wrapping", async () => {
  const panel = await openPanel()
  try {
    await panel.type("column")
    await panel.press("ArrowUp")
    await panel.press("Enter")
    expect(panel.run.chart).toHaveBeenCalledWith("column")
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("does nothing on Enter before anything is typed or picked", async () => {
  const panel = await openPanel()
  try {
    await panel.press("Enter")
    expect(panel.finish).not.toHaveBeenCalled()
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("finds the Deck row by its group title", async () => {
  const panel = await openPanel()
  try {
    await panel.type("deck")
    await panel.press("Enter")
    expect(panel.run.exportPdf).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => panel.root.unmount())
  }
})

it("finds every chart by the Charts group title", async () => {
  const panel = await openPanel()
  try {
    await panel.type("charts")
    expect(panel.host.querySelectorAll("[data-actions-group='charts'] button").length).toBe(5)
  } finally {
    await act(async () => panel.root.unmount())
  }
})
