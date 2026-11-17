import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"
import { EditorGrid } from "./editor-grid"

it("reports thirty pinch frames live while painting thumbnail content once and persisting once", async () => {
  const moduleName = "jsdom"
  const { JSDOM } = await import(moduleName)
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" })
  for (const name of ["window", "document", "HTMLElement", "Element", "localStorage"])
    vi.stubGlobal(name, dom.window[name])
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => setTimeout(() => run(0), 16))
  vi.stubGlobal("cancelAnimationFrame", clearTimeout)
  vi.useFakeTimers()
  let paints = 0
  const paint = () => {
    paints++
    return <span>Slide content</span>
  }
  const writes = vi.spyOn(dom.window.Storage.prototype, "setItem")
  dom.window.localStorage.setItem("airdesign.grid-viewport.deck", JSON.stringify({ x: 48, y: 24, scale: 0.25 }))
  writes.mockClear()
  function Grid() {
    return (
      <EditorGrid
        id="deck"
        title="Deck"
        size={{ width: 12192000, height: 6858000 }}
        strip={{ count: 7, current: 0, onSelect: () => undefined, thumbHeight: 720, thumb: paint }}
        onSlides={() => undefined}
        onExport={() => undefined}
      />
    )
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<Grid />))
    await act(async () => {
      for (const cell of host.querySelectorAll("[data-slide-thumb]"))
        cell.dispatchEvent(new dom.window.Event("contentvisibilityautostatechange"))
      vi.advanceTimersByTime(16)
    })
    const canvas = host.querySelector("[data-grid-viewport]")!
    for (let index = 1; index <= 30; index++) {
      await act(async () => {
        canvas.dispatchEvent(
          new dom.window.WheelEvent("wheel", { ctrlKey: true, deltaY: -1, bubbles: true, cancelable: true }),
        )
        vi.advanceTimersByTime(16)
      })
      expect(host.querySelector("[data-zoom-readout]")?.textContent).toBe(`${Math.round(25 * Math.exp(index * 0.01))}%`)
      expect(writes).not.toHaveBeenCalled()
    }
    expect(paints).toBe(7)
    await act(async () => vi.advanceTimersByTime(180))
    expect(writes).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
