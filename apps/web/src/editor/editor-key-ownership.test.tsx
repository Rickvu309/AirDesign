import { act } from "react"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { editorOwnsKey } from "./editor-key-ownership"

let window: Window & typeof globalThis
let ui: typeof import("@/components/ui/dialog")

beforeAll(async () => {
  const name = "jsdom"
  const { JSDOM } = await import(name)
  window = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true }).window
  for (const name of [
    "window",
    "document",
    "Node",
    "Element",
    "HTMLInputElement",
    "KeyboardEvent",
    "FocusEvent",
    "HTMLElement",
    "MutationObserver",
    "AbortController",
    "AbortSignal",
    "DOMRect",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ] as const)
    vi.stubGlobal(name, window[name])
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  ui = await import("@/components/ui/dialog")
})

afterEach(() => window.document.body.replaceChildren())
afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it.each(["menu", "popover"])("hands Escape to the %s before grid capture and element handlers", (kind) => {
  const document = window.document
  document.body.innerHTML = `<button id="slide"></button><div data-open ${kind === "menu" ? 'role="menu"' : 'data-slot="popover-content"'}><input></div>`
  const slide = document.querySelector("button")!
  const popup = document.querySelector<HTMLElement>("[data-open]")!
  const events: string[] = []
  const capture = (event: KeyboardEvent) => {
    if (editorOwnsKey(event)) events.push("canvas")
  }
  const another = (event: KeyboardEvent) => {
    if (editorOwnsKey(event)) events.push("drag")
  }
  window.addEventListener("keydown", capture, true)
  window.addEventListener("keydown", another, true)
  slide.addEventListener("keydown", () => events.push("slide"))
  popup.addEventListener("keydown", () => {
    events.push("popup")
    popup.removeAttribute("data-open")
  })
  try {
    slide.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
    expect(events).toEqual(["popup"])
    events.length = 0
    slide.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }))
    expect(events).toEqual(["canvas", "drag", "slide"])
  } finally {
    window.removeEventListener("keydown", capture, true)
    window.removeEventListener("keydown", another, true)
  }
})

it("keeps composing Escape and background keys out of the grid without sending menu commands", () => {
  window.document.body.innerHTML = '<button></button><div role="menu" data-open></div>'
  const slide = window.document.querySelector("button")!
  const popup = window.document.querySelector<HTMLElement>('[role="menu"]')!
  const keys: string[] = []
  popup.addEventListener("keydown", (event) => keys.push(event.key))
  slide.addEventListener("keydown", (event) => expect(editorOwnsKey(event)).toBe(false))
  for (const key of ["Escape", "Delete", "Enter", " ", "ArrowRight", "+"]) {
    const event = new window.KeyboardEvent("keydown", { key, isComposing: true, cancelable: true })
    slide.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  }
  expect(keys).toEqual([])
})

it.each(["DialogContent", "DialogPopup"] as const)(
  "leaves a key pressed inside an open %s to the dialog, so the canvas behind never acts on it",
  async (kind) => {
    const { createRoot } = await import("react-dom/client")
    const { Dialog, DialogContent, DialogPopup, DialogPortal } = ui
    const host = window.document.createElement("div")
    window.document.body.append(host)
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <Dialog open>
          {kind === "DialogContent" ? (
            <DialogContent>
              <button id="inside">Export</button>
            </DialogContent>
          ) : (
            <DialogPortal>
              <DialogPopup>
                <button id="inside">Export</button>
              </DialogPopup>
            </DialogPortal>
          )}
        </Dialog>,
      ),
    )
    try {
      const inside = window.document.querySelector("#inside")!
      let owned: boolean | null = null
      window.addEventListener("keydown", (event) => (owned = editorOwnsKey(event)), { once: true, capture: true })
      inside.dispatchEvent(new window.KeyboardEvent("keydown", { key: "t", bubbles: true, cancelable: true }))
      expect(owned).toBe(false)
    } finally {
      await act(async () => root.unmount())
    }
  },
)

it.each([
  ["Chrome and Firefox", { isComposing: true }],
  ["Safari", { keyCode: 229 }],
])("keeps an open menu open when an IME cancels its conversion with Escape in %s", (_browser, init) => {
  const document = window.document
  document.body.innerHTML = `<button id="slide"></button><div data-open role="menu"><input></div>`
  const slide = document.querySelector("button")!
  const popup = document.querySelector<HTMLElement>("[data-open]")!
  const closed = vi.fn()
  const capture = (event: KeyboardEvent) => void editorOwnsKey(event)
  window.addEventListener("keydown", capture, true)
  popup.addEventListener("keydown", closed)
  try {
    slide.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...init }),
    )
    expect(closed).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener("keydown", capture, true)
  }
})
