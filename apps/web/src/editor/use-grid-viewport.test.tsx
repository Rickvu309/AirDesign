import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"
import { useSettled } from "@airdesign/render"
import { EditorGrid } from "./editor-grid"

it("reports thirty pinch frames live while painting thumbnail content once, persisting once, and settling once persisted", async () => {
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
  const seen: boolean[] = []
  function Settled() {
    seen.push(useSettled())
    return null
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () =>
      root.render(
        <>
          <Grid />
          <Settled />
        </>,
      ),
    )
    await act(async () => {
      for (const cell of host.querySelectorAll("[data-slide-thumb]"))
        cell.dispatchEvent(new dom.window.Event("contentvisibilityautostatechange"))
      vi.advanceTimersByTime(16)
    })
    expect(seen.at(-1)).toBe(true)
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
    expect(seen.at(-1)).toBe(false)
    await act(async () => vi.advanceTimersByTime(180))
    expect(writes).toHaveBeenCalledTimes(1)
    expect(seen.at(-1)).toBe(true)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
  }
})

it("a Fit while a zoom's place is pending settles the grid at once", async () => {
  const moduleName = "jsdom"
  const { JSDOM } = await import(moduleName)
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" })
  for (const name of ["window", "document", "HTMLElement", "Element", "localStorage", "KeyboardEvent"])
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
  const seen: boolean[] = []
  function Settled() {
    seen.push(useSettled())
    return null
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () =>
      root.render(
        <>
          <EditorGrid
            id="deck"
            title="Deck"
            size={{ width: 12192000, height: 6858000 }}
            strip={{ count: 3, current: 0, onSelect: () => undefined, thumbHeight: 720, thumb: () => <span /> }}
            onSlides={() => undefined}
            onExport={() => undefined}
          />
          <Settled />
        </>,
      ),
    )
    await act(async () => vi.advanceTimersByTime(16))
    const canvas = host.querySelector("[data-grid-viewport]")!
    await act(async () => {
      canvas.dispatchEvent(
        new dom.window.WheelEvent("wheel", { ctrlKey: true, deltaY: -1, bubbles: true, cancelable: true }),
      )
    })
    expect(seen.at(-1)).toBe(false)
    await act(async () => {
      window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { code: "Digit1", key: "!", shiftKey: true }))
    })
    expect(seen.at(-1)).toBe(true)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
  }
})

it("zooms grid view on Safari gesture events, prevents default, ignores interleaved ctrl wheel, and persists once on gestureend", async () => {
  const moduleName = "jsdom"
  const { JSDOM } = await import(moduleName)
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" })
  for (const name of ["window", "document", "HTMLElement", "Element", "localStorage", "Event", "WheelEvent"]) {
    const value = (dom.window as unknown as Record<string, unknown>)[name]
    if (value !== undefined) vi.stubGlobal(name, value)
  }
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
  const writes = vi.spyOn(dom.window.Storage.prototype, "setItem")
  dom.window.localStorage.setItem("airdesign.grid-viewport.deck", JSON.stringify({ x: 48, y: 24, scale: 0.25 }))
  writes.mockClear()
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () =>
      root.render(
        <EditorGrid
          id="deck"
          title="Deck"
          size={{ width: 12192000, height: 6858000 }}
          strip={{ count: 3, current: 0, onSelect: () => undefined, thumbHeight: 720, thumb: () => <span>Slide</span> }}
          onSlides={() => undefined}
          onExport={() => undefined}
        />,
      ),
    )
    const canvas = host.querySelector("[data-grid-viewport]")!
    const start = Object.assign(new dom.window.Event("gesturestart", { bubbles: true, cancelable: true }), {
      scale: 1,
      clientX: 200,
      clientY: 150,
    })
    const change = Object.assign(new dom.window.Event("gesturechange", { bubbles: true, cancelable: true }), {
      scale: 2,
      clientX: 200,
      clientY: 150,
    })
    const wheel = new dom.window.WheelEvent("wheel", {
      ctrlKey: true,
      deltaY: -10,
      clientX: 200,
      clientY: 150,
      bubbles: true,
      cancelable: true,
    })
    const end = Object.assign(new dom.window.Event("gestureend", { bubbles: true, cancelable: true }), {
      scale: 2,
      clientX: 200,
      clientY: 150,
    })
    await act(async () => {
      canvas.dispatchEvent(start)
      canvas.dispatchEvent(change)
      canvas.dispatchEvent(wheel)
      vi.advanceTimersByTime(16)
    })
    expect(start.defaultPrevented).toBe(true)
    expect(change.defaultPrevented).toBe(true)
    expect(wheel.defaultPrevented).toBe(true)
    expect(host.querySelector("[data-zoom-readout]")?.textContent).toBe("50%")
    expect(writes).not.toHaveBeenCalled()
    await act(async () => {
      canvas.dispatchEvent(end)
    })
    expect(end.defaultPrevented).toBe(true)
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
