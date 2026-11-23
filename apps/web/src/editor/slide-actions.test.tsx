import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { SlideSidebar, type SlideStrip } from "@/editor/slide-sidebar"
import { nodeId } from "@airdesign/doom"

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
  slideIds: [nodeId("n:1"), nodeId("n:2"), nodeId("n:3"), nodeId("n:4"), nodeId("n:5"), nodeId("n:6")],
  current: 0,
  onSelect: () => undefined,
  onClone: () => undefined,
  onRemove: () => undefined,
  onMove: () => undefined,
  thumbHeight: 101,
  thumb: () => null,
}

it("keeps slide thumbnails free of separate actions buttons", async () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<SlideSidebar title="Deck" strip={strip} />))

  expect(host.querySelectorAll("[data-slide-entry]")).toHaveLength(strip.count)
  expect(host.querySelectorAll("[data-slide-actions]")).toHaveLength(0)
  expect(host.querySelectorAll("[data-slide-list] button:not([data-slide-entry])")).toHaveLength(0)

  await act(async () => root.unmount())
  host.remove()
})
