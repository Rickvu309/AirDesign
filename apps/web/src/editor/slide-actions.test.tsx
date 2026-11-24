import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { slideListCopy } from "@/copy/slide-list-copy"
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

it("dims a skipped slide and marks it", async () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await act(async () =>
    root.render(
      <SlideSidebar
        title="Deck"
        strip={{ ...strip, count: 2, slideIds: strip.slideIds.slice(0, 2), skipped: [true, false] }}
      />,
    ),
  )

  const entries = [...host.querySelectorAll("[data-slide-entry]")]
  expect(entries[0]?.hasAttribute("data-slide-skipped")).toBe(true)
  expect(entries[1]?.hasAttribute("data-slide-skipped")).toBe(false)
  expect(host.querySelectorAll("[data-slide-skip-mark]")).toHaveLength(1)
  expect(entries[0]?.querySelector("[data-slide-skip-mark]")).not.toBeNull()
  expect(entries[0]?.querySelector("[data-slide-number]")?.textContent).toBe("–")
  expect(entries[1]?.querySelector("[data-slide-number]")?.textContent).toBe("2")
  expect(entries[1]?.getAttribute("aria-label")).toBe(slideListCopy.slideName(2, 2))

  await act(async () => root.unmount())
  host.remove()
})
