import type { Color } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { Dropper } from "@/design/eyedropper"
import { SlideEyedropper, useEyedropper } from "@/legacy-editor/eyedropper-tool"

let domWindow: Window & typeof globalThis
const hosts: { host: HTMLDivElement; root: Root }[] = []

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  domWindow = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  for (const [name, value] of [
    ["window", domWindow],
    ["document", domWindow.document],
    ["HTMLElement", domWindow.HTMLElement],
    ["Element", domWindow.Element],
    ["Node", domWindow.Node],
    ["KeyboardEvent", domWindow.KeyboardEvent],
    ["MouseEvent", domWindow.MouseEvent],
    ["Event", domWindow.Event],
    ["getComputedStyle", domWindow.getComputedStyle.bind(domWindow)],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ] as const)
    vi.stubGlobal(name, value)
})

afterEach(async () => {
  delete (domWindow as { EyeDropper?: unknown }).EyeDropper
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

afterAll(() => {
  vi.unstubAllGlobals()
  domWindow.close()
})

function boxOf(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function setRect(node: Element, left: number, top: number, width: number, height: number) {
  Object.defineProperty(node, "getBoundingClientRect", {
    configurable: true,
    value: () => boxOf(left, top, width, height),
  })
}

function keydown(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, ...init })
  target.dispatchEvent(event)
  return event
}

const hex = (digits: string) => `#${digits}`

function mount(canPick: () => boolean, picked: Color[]) {
  function Harness() {
    const state = useEyedropper(true, canPick, (color) => picked.push(color))
    return createElement(SlideEyedropper, { state })
  }
  const host = document.createElement("div")
  const slide = document.createElement("div")
  slide.setAttribute("data-slide-paint", "")
  slide.tabIndex = -1
  slide.style.backgroundColor = "rgb(255, 255, 255)"
  setRect(slide, 0, 0, 500, 300)
  const swatch = document.createElement("div")
  swatch.setAttribute("data-canvas-element", "shape")
  swatch.tabIndex = 0
  swatch.style.backgroundColor = "rgb(37, 99, 235)"
  setRect(swatch, 40, 40, 120, 80)
  slide.append(swatch)
  host.append(slide)
  const overlayHost = document.createElement("div")
  host.append(overlayHost)
  document.body.append(host)
  const root = createRoot(overlayHost)
  hosts.push({ host, root })
  return { slide, swatch, root, Harness }
}

describe("useEyedropper", () => {
  it("uses window.EyeDropper when present, applies the picked color, and aborts on Esc", async () => {
    let resolveDropper: ((value: { readonly sRGBHex: string }) => void) | null = null
    let aborted = false
    class FakeDropper implements Dropper {
      open(options?: { readonly signal?: AbortSignal }) {
        return new Promise<{ readonly sRGBHex: string }>((resolve, reject) => {
          resolveDropper = resolve
          options?.signal?.addEventListener("abort", () => {
            aborted = true
            reject(new DOMException("aborted", "AbortError"))
          })
        })
      }
    }
    ;(domWindow as { EyeDropper?: unknown }).EyeDropper = FakeDropper
    const picked: Color[] = []
    const { swatch, root, Harness } = mount(() => true, picked)
    await act(async () => {
      root.render(createElement(Harness))
    })

    await act(async () => {
      const event = keydown(swatch, "i", { code: "KeyI" })
      expect(event.defaultPrevented).toBe(true)
    })
    expect(document.querySelector("[data-eyedropper-overlay]")).toBeNull()
    await act(async () => {
      resolveDropper?.({ sRGBHex: hex("dc2626") })
      await Promise.resolve()
    })
    expect(picked).toEqual([{ rgb: "DC2626" }])

    await act(async () => {
      keydown(swatch, "i", { code: "KeyI" })
    })
    await act(async () => {
      const escape = keydown(swatch, "Escape", { code: "Escape" })
      expect(escape.defaultPrevented).toBe(true)
      await Promise.resolve()
    })
    expect(aborted).toBe(true)
    expect(picked).toEqual([{ rgb: "DC2626" }])
  })

  it("samples the rendered slide when window.EyeDropper is missing, previews hex, and cancels on Esc", async () => {
    const picked: Color[] = []
    let hasSelection = false
    const { swatch, root, Harness } = mount(() => hasSelection, picked)
    await act(async () => {
      root.render(createElement(Harness))
    })

    await act(async () => {
      const ignored = keydown(swatch, "i", { code: "KeyI" })
      expect(ignored.defaultPrevented).toBe(false)
    })
    expect(document.querySelector("[data-eyedropper-overlay]")).toBeNull()

    hasSelection = true
    await act(async () => {
      const started = keydown(swatch, "i", { code: "KeyI" })
      expect(started.defaultPrevented).toBe(true)
    })
    const overlay = document.querySelector("[data-eyedropper-overlay]")
    expect(overlay).not.toBeNull()

    await act(async () => {
      overlay?.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 80, clientY: 60 }))
    })
    expect(document.querySelector("[data-eyedropper-preview]")?.textContent).toBe(hex("2563EB"))

    let bubbledEscape = false
    swatch.addEventListener("keydown", () => {
      bubbledEscape = true
    })
    await act(async () => {
      const escape = keydown(swatch, "Escape", { code: "Escape" })
      expect(escape.defaultPrevented).toBe(true)
    })
    expect(bubbledEscape).toBe(false)
    expect(document.querySelector("[data-eyedropper-overlay]")).toBeNull()
    expect(picked).toEqual([])

    await act(async () => {
      keydown(swatch, "i", { code: "KeyI" })
    })
    const active = document.querySelector("[data-eyedropper-overlay]")
    await act(async () => {
      active?.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, clientX: 80, clientY: 60 }),
      )
    })
    expect(document.querySelector("[data-eyedropper-overlay]")).toBeNull()
    expect(picked).toEqual([{ rgb: "2563EB" }])
  })
})
