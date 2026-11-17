import { act } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let ResizablePanel: typeof import("./resizable-panel").ResizablePanel

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
  ResizablePanel = (await import("./resizable-panel")).ResizablePanel
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it("resizes with the keyboard, clamps widths and retains each panel's width", async () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const show = async (panel: "design" | "agent") =>
    act(async () => root.render(<ResizablePanel panel={panel}>Panel</ResizablePanel>))
  const key = async (key: string) =>
    act(async () =>
      host
        .querySelector('[role="separator"]')
        ?.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true })),
    )
  const width = () => host.querySelector("aside")?.style.width
  try {
    await show("design")
    expect(width()).toBe("240px")
    await key("ArrowLeft")
    expect(width()).toBe("250px")
    await key("Home")
    expect(width()).toBe("220px")
    await key("ArrowRight")
    expect(width()).toBe("220px")
    await key("End")
    expect(width()).toBe("440px")
    await key("ArrowLeft")
    expect(width()).toBe("440px")
    await show("agent")
    expect(width()).toBe("360px")
    await show("design")
    expect(width()).toBe("440px")
    expect(host.querySelector('[role="separator"]')?.getAttribute("aria-valuenow")).toBe("440")
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
