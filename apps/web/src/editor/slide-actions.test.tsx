import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { SlideSidebar, type SlideStrip } from "@/editor/slide-sidebar"

let window: Window & typeof globalThis

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
    ["IS_REACT_ACT_ENVIRONMENT", true],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

const strip: SlideStrip = {
  count: 6,
  current: 0,
  onSelect: () => undefined,
  onClone: () => undefined,
  onRemove: () => undefined,
  onMove: () => undefined,
  thumbHeight: 101,
  thumb: () => null,
}

it("places slide actions in their row without anchored layout", async () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<SlideSidebar run="done" title="Deck" strip={strip} />))

  for (let number = 1; number <= strip.count; number += 1) {
    const control = host.querySelector<HTMLElement>(`[data-slide-actions="${String(number)}"]`)
    expect(control?.parentElement?.querySelector(`:scope > [data-slide-entry="${String(number)}"]`)).not.toBeNull()
    expect(control?.getAttribute("style") ?? "").not.toContain("anchor")
  }

  await act(async () => root.unmount())
  host.remove()
})
