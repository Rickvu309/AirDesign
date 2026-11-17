import { act } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let menu: typeof import("./context-menu")

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true }).window
  for (const name of [
    "window",
    "document",
    "HTMLElement",
    "Element",
    "Node",
    "MutationObserver",
    "AbortController",
    "AbortSignal",
    "DOMRect",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ]) {
    vi.stubGlobal(name, name === "window" ? window : Reflect.get(window, name))
  }
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.useFakeTimers()
  createRoot = (await import("react-dom/client")).createRoot
  menu = await import("./context-menu")
})

afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.close()
})

it("takes keyboard input when the context menu mounts, before an animation frame", async () => {
  const { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } = menu
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () =>
      root.render(
        <ContextMenu>
          <ContextMenuTrigger>
            <button>Deck</button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Star</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>,
      ),
    )
    const trigger = host.querySelector("button")
    if (!trigger) throw new Error("Missing trigger")
    trigger.focus()
    await act(async () => trigger.dispatchEvent(new window.MouseEvent("contextmenu", { bubbles: true, button: 2 })))
    const popup = window.document.querySelector('[role="menu"]')
    expect(popup).not.toBeNull()
    expect(window.document.activeElement).toBe(popup)
    await act(async () =>
      window.document.activeElement?.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      ),
    )
    const item = window.document.querySelector('[role="menuitem"]')
    expect(window.document.activeElement).toBe(item)
    await act(async () => vi.advanceTimersToNextFrame())
    expect(window.document.activeElement).toBe(item)
    await act(async () =>
      window.document.activeElement?.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    )
    expect(window.document.querySelector('[role="menu"]')).toBeNull()
    expect(window.document.activeElement).toBe(trigger)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
