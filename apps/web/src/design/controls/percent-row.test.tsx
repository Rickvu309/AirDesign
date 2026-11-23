import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let PercentRow: typeof import("./percent-row").PercentRow

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>").window
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
  PercentRow = (await import("./percent-row")).PercentRow
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

async function typeInto(input: HTMLInputElement, text: string | null, key: string) {
  if (text !== null)
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, text)
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
  await act(async () => {
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }))
  })
}

it("writes nothing when Enter lands on the rounded value it shows, and writes what a person typed", async () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const onCommit = vi.fn()
  try {
    await act(async () => root.render(createElement(PercentRow, { label: "Blur", exact: 33.333, onCommit })))
    const input = host.querySelector<HTMLInputElement>('input[inputmode="decimal"]')
    if (input === null) throw new Error("Blur")
    expect(input.value).toBe("33")
    await typeInto(input, null, "Enter")
    await typeInto(input, "33", "Enter")
    expect(onCommit).not.toHaveBeenCalled()
    await typeInto(input, "34", "Enter")
    expect(onCommit).toHaveBeenCalledWith(34)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
