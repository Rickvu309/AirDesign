import { slideId, type SlideId } from "@airdesign/document"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { EditorGrid } from "./editor-grid"
import type { SlideStrip } from "./slide-sidebar"

let window: Window & typeof globalThis

beforeAll(async () => {
  const moduleName = "jsdom"
  const { JSDOM } = (await import(moduleName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" }).window
  for (const name of ["window", "document", "HTMLElement", "Element", "localStorage"] as const)
    vi.stubGlobal(name, window[name])
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

function strip(ids: readonly string[], onRemove: (index: number) => void): SlideStrip {
  return {
    count: ids.length,
    current: 0,
    slideIds: ids.map((id): SlideId => slideId(id)),
    onSelect: () => undefined,
    onRemove,
    thumbHeight: 101,
    thumb: () => <span />,
  }
}

function focusedEntry(): string | null {
  return window.document.activeElement?.getAttribute("data-slide-entry") ?? null
}

it("keeps focus on the slide that takes a deleted one's place when two Deletes arrive before the first repaint", async () => {
  const removed: number[] = []
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root: Root = createRoot(host)
  const show = (ids: readonly string[]) =>
    act(async () =>
      root.render(
        <EditorGrid
          id="deck"
          title="Deck"
          strip={strip(ids, (index) => removed.push(index))}
          onSlides={() => undefined}
          onExport={() => undefined}
        />,
      ),
    )
  await show(["256", "257", "258", "259"])
  const first = host.querySelector<HTMLElement>('[data-slide-entry="1"]')
  await act(async () => first?.focus())
  const press = () =>
    act(async () => {
      window.document.activeElement?.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }),
      )
    })
  await press()
  await press()
  expect(removed).toEqual([0, 0])
  await show(["257", "258", "259"])
  expect(focusedEntry()).toBe("1")
  await show(["258", "259"])
  expect(focusedEntry()).toBe("1")
  expect(window.document.activeElement?.getAttribute("aria-label")).toBe("Slide 1 of 2")
  await act(async () => root.unmount())
  host.remove()
})
