import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let NumberField: typeof import("./number-cell").NumberField

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
  NumberField = (await import("./number-cell")).NumberField
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

const press = (input: HTMLInputElement, key: string) =>
  act(async () => {
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }))
  })

it("steps a cell from the value it holds and keeps each step inside its min and max", async () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const onCommit = vi.fn()
  try {
    await act(async () =>
      root.render(createElement(NumberField, { label: "Value", value: 9.6, min: 0, max: 10, onCommit })),
    )
    const input = host.querySelector("input")
    if (input === null) throw new Error("Value")
    await press(input, "ArrowUp")
    expect(input.value).toBe("10")
    await press(input, "ArrowUp")
    expect(input.value).toBe("10")
    for (const _ of Array.from({ length: 12 })) await press(input, "ArrowDown")
    expect(input.value).toBe("0")
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
