import { act, useState } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let popover: typeof import("./popover")
let dropdown: typeof import("./dropdown-menu")

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true }).window
  window.Element.prototype.getAnimations = () => []
  for (const name of [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
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
  popover = await import("./popover")
  dropdown = await import("./dropdown-menu")
})

afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.close()
})

it.each(["controlled", "uncontrolled"] as const)(
  "unmounts a %s popover and returns focus to its trigger on Escape before the next animation frame",
  async (mode) => {
    const { Popover, PopoverContent, PopoverTrigger } = popover
    const host = window.document.createElement("div")
    window.document.body.append(host)
    const root = createRoot(host)
    const escaped: string[] = []
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <div
          onKeyDown={(event) => {
            if (event.key === "Escape") escaped.push((event.target as Element).tagName)
          }}
        >
          <Popover {...(mode === "controlled" ? { open, onOpenChange: setOpen } : {})}>
            <PopoverTrigger render={<button type="button" />}>Actions</PopoverTrigger>
            <PopoverContent>
              <input autoFocus />
            </PopoverContent>
          </Popover>
        </div>
      )
    }
    try {
      await act(async () => root.render(<Harness />))
      const trigger = host.querySelector("button")
      if (trigger === null) throw new Error("Missing trigger")
      await act(async () => trigger.click())
      const input = window.document.querySelector("input")
      expect(input).not.toBeNull()
      expect(window.document.activeElement).toBe(input)

      await act(async () => {
        window.document.activeElement?.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        )
      })
      expect(window.document.querySelector('[data-slot="popover-content"]')).toBeNull()
      expect(window.document.activeElement).toBe(trigger)
      expect(escaped).toEqual([])

      await act(async () => {
        window.document.activeElement?.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        )
      })
      expect(escaped).toEqual(["BUTTON"])
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  },
)

it.each(["controlled", "uncontrolled"] as const)(
  "unmounts a %s dropdown menu and returns focus to its trigger on Escape before the next animation frame",
  async (mode) => {
    const { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } = dropdown
    const host = window.document.createElement("div")
    window.document.body.append(host)
    const root = createRoot(host)
    const escaped: string[] = []
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <div
          onKeyDown={(event) => {
            if (event.key === "Escape") escaped.push((event.target as Element).tagName)
          }}
        >
          <DropdownMenu {...(mode === "controlled" ? { open, onOpenChange: setOpen } : {})}>
            <DropdownMenuTrigger render={<button type="button" />}>Move tools</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Move</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
    try {
      await act(async () => root.render(<Harness />))
      const trigger = host.querySelector("button")
      if (trigger === null) throw new Error("Missing trigger")
      await act(async () => {
        trigger.click()
        vi.advanceTimersToNextFrame()
      })
      expect(window.document.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeNull()

      await act(async () => {
        window.document.activeElement?.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        )
      })
      expect(window.document.querySelector('[data-slot="dropdown-menu-content"]')).toBeNull()
      expect(window.document.activeElement).toBe(trigger)
      expect(escaped).toEqual([])

      await act(async () => {
        window.document.activeElement?.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        )
      })
      expect(escaped).toEqual(["BUTTON"])
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  },
)

it("keeps a popover mounted through its exit frame when closed without Escape", async () => {
  const { Popover, PopoverContent, PopoverTrigger } = popover
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  function Harness() {
    const [open, setOpen] = useState(false)
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<button type="button" />}>Actions</PopoverTrigger>
        <PopoverContent>
          <button type="button" data-close onClick={() => setOpen(false)}>
            Done
          </button>
        </PopoverContent>
      </Popover>
    )
  }
  try {
    await act(async () => root.render(<Harness />))
    const trigger = host.querySelector("button")
    if (trigger === null) throw new Error("Missing trigger")
    await act(async () => trigger.click())
    const close = window.document.querySelector<HTMLButtonElement>("[data-close]")
    if (close === null) throw new Error("Missing close button")

    await act(async () => close.click())
    expect(window.document.querySelector('[data-slot="popover-content"]')).not.toBeNull()
    await act(async () => vi.advanceTimersToNextFrame())
    expect(window.document.querySelector('[data-slot="popover-content"]')).toBeNull()
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
