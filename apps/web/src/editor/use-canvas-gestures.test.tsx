import { act, useState } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CanvasStage } from "@/editor/canvas-stage"
import { wheelZoomFactor } from "@/editor/canvas-viewport"

type Rect = { left: number; top: number; width: number; height: number }

function makeRect({ left, top, width, height }: Rect): DOMRect {
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
  }
}

function gestureEvent(
  domWindow: { readonly Event: typeof Event },
  type: "gesturestart" | "gesturechange" | "gestureend",
  props: { scale?: number; clientX?: number; clientY?: number } = {},
): Event {
  const event = new domWindow.Event(type, { bubbles: true, cancelable: true })
  return Object.assign(event, props)
}

async function mountStage(initialWidth = 800, withZoom = true) {
  const moduleName = "jsdom"
  const { JSDOM } = await import(moduleName)
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" })
  for (const name of ["window", "document", "HTMLElement", "Element", "Event", "WheelEvent", "PointerEvent"]) {
    const value = (dom.window as unknown as Record<string, unknown>)[name]
    if (value !== undefined) vi.stubGlobal(name, value)
  }
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => setTimeout(() => run(0), 16))
  vi.stubGlobal("cancelAnimationFrame", clearTimeout)
  vi.useFakeTimers()

  const zooms: number[] = []
  let currentWidth = initialWidth
  const limits = { least: 128, most: 5120 }

  function Harness() {
    const [width, setWidth] = useState(initialWidth)
    currentWidth = width
    return (
      <CanvasStage
        fit={false}
        hand={false}
        pans={false}
        width={width}
        height={(width * 9) / 16}
        canvasWidth={1200}
        canvasHeight={800}
        overlay={80}
        limits={limits}
        {...(withZoom
          ? {
              onZoom: (next) => {
                zooms.push(next)
                setWidth(next)
              },
            }
          : {})}
      >
        <div data-slide-wrapper style={{ width, height: (width * 9) / 16 }} />
      </CanvasStage>
    )
  }

  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<Harness />))

  const stage = host.querySelector<HTMLDivElement>("[data-canvas-stage]")!
  const content = stage.firstElementChild as HTMLDivElement
  const wrapper = host.querySelector<HTMLDivElement>("[data-slide-wrapper]")!
  stage.scrollLeft = 300
  stage.scrollTop = 200
  stage.getBoundingClientRect = () => makeRect({ left: 0, top: 0, width: 1200, height: 800 })
  content.getBoundingClientRect = () =>
    makeRect({ left: -stage.scrollLeft, top: -stage.scrollTop, width: 2000, height: 1400 })
  wrapper.getBoundingClientRect = () =>
    makeRect({
      left: 400 - stage.scrollLeft,
      top: 250 - stage.scrollTop,
      width: currentWidth,
      height: (currentWidth * 9) / 16,
    })

  return {
    dom,
    stage,
    content,
    wrapper,
    zooms,
    width: () => currentWidth,
    unmount: async () => {
      await act(async () => root.unmount())
      dom.window.close()
    },
  }
}

describe("Safari trackpad pinch zoom on slide canvas", () => {
  it("zooms in and out about the cursor via gesture events, prevents default, and lays out once on gestureend", async () => {
    const mounted = await mountStage(800)
    try {
      const { dom, wrapper, content, stage, zooms } = mounted
      const cursor = { x: 412, y: 300 }
      const before = wrapper.getBoundingClientRect()
      const anchor = {
        x: (cursor.x - before.left) / before.width,
        y: (cursor.y - before.top) / before.height,
      }

      const start = gestureEvent(dom.window, "gesturestart", { scale: 1, clientX: cursor.x, clientY: cursor.y })
      await act(async () => {
        wrapper.dispatchEvent(start)
      })
      expect(start.defaultPrevented).toBe(true)

      const first = gestureEvent(dom.window, "gesturechange", { scale: 1.25, clientX: cursor.x, clientY: cursor.y })
      await act(async () => {
        wrapper.dispatchEvent(first)
        vi.advanceTimersByTime(16)
      })
      expect(first.defaultPrevented).toBe(true)
      expect(content.style.transform).toContain("scale(1.25)")
      expect(zooms).toEqual([])

      const second = gestureEvent(dom.window, "gesturechange", { scale: 1.75, clientX: cursor.x, clientY: cursor.y })
      await act(async () => {
        wrapper.dispatchEvent(second)
        vi.advanceTimersByTime(16)
      })
      expect(second.defaultPrevented).toBe(true)
      expect(content.style.transform).toContain("scale(1.75)")
      expect(zooms).toEqual([])

      const end = gestureEvent(dom.window, "gestureend", { scale: 1.75, clientX: cursor.x, clientY: cursor.y })
      await act(async () => {
        wrapper.dispatchEvent(end)
      })
      expect(end.defaultPrevented).toBe(true)
      expect(content.style.transform).toBe("")
      expect(zooms).toHaveLength(1)
      expect(zooms[0]).toBeCloseTo(1400)

      const after = wrapper.getBoundingClientRect()
      expect(after.left + anchor.x * after.width).toBeCloseTo(cursor.x, 5)
      expect(after.top + anchor.y * after.height).toBeCloseTo(cursor.y, 5)

      await act(async () => {
        wrapper.dispatchEvent(
          gestureEvent(dom.window, "gesturestart", { scale: 1, clientX: cursor.x, clientY: cursor.y }),
        )
        wrapper.dispatchEvent(
          gestureEvent(dom.window, "gesturechange", { scale: 0.5, clientX: cursor.x, clientY: cursor.y }),
        )
        wrapper.dispatchEvent(
          gestureEvent(dom.window, "gestureend", { scale: 0.5, clientX: cursor.x, clientY: cursor.y }),
        )
      })
      expect(zooms).toHaveLength(2)
      expect(zooms[1]).toBeCloseTo(700)
      const shrunk = wrapper.getBoundingClientRect()
      expect(shrunk.left + anchor.x * shrunk.width).toBeCloseTo(cursor.x, 5)
      expect(shrunk.top + anchor.y * shrunk.height).toBeCloseTo(cursor.y, 5)
      expect(stage.scrollLeft).toBeGreaterThan(0)
    } finally {
      await mounted.unmount()
    }
  })

  it("clamps to the zoom limits and responds immediately when reversing direction", async () => {
    const mounted = await mountStage(3200)
    try {
      const { dom, wrapper, zooms } = mounted
      await act(async () => {
        wrapper.dispatchEvent(gestureEvent(dom.window, "gesturestart", { scale: 1, clientX: 500, clientY: 300 }))
        wrapper.dispatchEvent(gestureEvent(dom.window, "gesturechange", { scale: 4, clientX: 500, clientY: 300 }))
        wrapper.dispatchEvent(gestureEvent(dom.window, "gesturechange", { scale: 2, clientX: 500, clientY: 300 }))
        wrapper.dispatchEvent(gestureEvent(dom.window, "gestureend", { scale: 2, clientX: 500, clientY: 300 }))
      })
      expect(zooms).toHaveLength(1)
      expect(zooms[0]).toBeCloseTo(2560)
    } finally {
      await mounted.unmount()
    }
  })

  it("does not double-zoom when wheel with ctrlKey fires during an active Safari gesture", async () => {
    const mounted = await mountStage(800)
    try {
      const { dom, wrapper, zooms } = mounted
      const wheel = new dom.window.WheelEvent("wheel", {
        deltaY: -10,
        ctrlKey: true,
        clientX: 412,
        clientY: 300,
        bubbles: true,
        cancelable: true,
      })
      await act(async () => {
        wrapper.dispatchEvent(gestureEvent(dom.window, "gesturestart", { scale: 1, clientX: 412, clientY: 300 }))
        wrapper.dispatchEvent(wheel)
        wrapper.dispatchEvent(gestureEvent(dom.window, "gesturechange", { scale: 1.5, clientX: 412, clientY: 300 }))
        wrapper.dispatchEvent(gestureEvent(dom.window, "gestureend", { scale: 1.5, clientX: 412, clientY: 300 }))
      })
      expect(wheel.defaultPrevented).toBe(true)
      expect(zooms).toHaveLength(1)
      expect(zooms[0]).toBeCloseTo(1200)
    } finally {
      await mounted.unmount()
    }
  })

  it("does not double-zoom when gesture events fire during an active Ctrl+wheel zoom", async () => {
    const mounted = await mountStage(800)
    try {
      const { dom, wrapper, zooms } = mounted
      const wheel = new dom.window.WheelEvent("wheel", {
        deltaY: -10,
        ctrlKey: true,
        clientX: 412,
        clientY: 300,
        bubbles: true,
        cancelable: true,
      })
      const start = gestureEvent(dom.window, "gesturestart", { scale: 1, clientX: 412, clientY: 300 })
      const change = gestureEvent(dom.window, "gesturechange", { scale: 1.5, clientX: 412, clientY: 300 })
      const end = gestureEvent(dom.window, "gestureend", { scale: 1.5, clientX: 412, clientY: 300 })
      await act(async () => {
        wrapper.dispatchEvent(wheel)
        wrapper.dispatchEvent(start)
        wrapper.dispatchEvent(change)
        wrapper.dispatchEvent(end)
        vi.advanceTimersByTime(160)
      })
      expect(start.defaultPrevented).toBe(true)
      expect(change.defaultPrevented).toBe(true)
      expect(end.defaultPrevented).toBe(true)
      expect(zooms).toHaveLength(1)
      expect(zooms[0]).toBeCloseTo(800 * wheelZoomFactor(wheel))
    } finally {
      await mounted.unmount()
    }
  })

  it("allows a Ctrl+wheel zoom right after a Safari gesture ends, and vice versa", async () => {
    const mounted = await mountStage(800)
    try {
      const { dom, wrapper, zooms } = mounted
      await act(async () => {
        wrapper.dispatchEvent(gestureEvent(dom.window, "gesturestart", { scale: 1, clientX: 412, clientY: 300 }))
        wrapper.dispatchEvent(gestureEvent(dom.window, "gesturechange", { scale: 1.5, clientX: 412, clientY: 300 }))
        wrapper.dispatchEvent(gestureEvent(dom.window, "gestureend", { scale: 1.5, clientX: 412, clientY: 300 }))
      })
      expect(zooms).toHaveLength(1)
      expect(zooms[0]).toBeCloseTo(1200)

      const wheel = new dom.window.WheelEvent("wheel", {
        deltaY: -10,
        ctrlKey: true,
        clientX: 412,
        clientY: 300,
        bubbles: true,
        cancelable: true,
      })
      await act(async () => {
        wrapper.dispatchEvent(wheel)
        vi.advanceTimersByTime(160)
      })
      expect(zooms).toHaveLength(2)
      expect(zooms[1]).toBeCloseTo(1200 * wheelZoomFactor(wheel))

      await act(async () => {
        wrapper.dispatchEvent(gestureEvent(dom.window, "gesturestart", { scale: 1, clientX: 412, clientY: 300 }))
        wrapper.dispatchEvent(gestureEvent(dom.window, "gesturechange", { scale: 0.5, clientX: 412, clientY: 300 }))
        wrapper.dispatchEvent(gestureEvent(dom.window, "gestureend", { scale: 0.5, clientX: 412, clientY: 300 }))
      })
      expect(zooms).toHaveLength(3)
      expect(zooms[2]).toBeCloseTo(zooms[1]! * 0.5)
    } finally {
      await mounted.unmount()
    }
  })

  it("ignores non-positive scales and still prevents default when zooming is disabled", async () => {
    const mounted = await mountStage(800, false)
    try {
      const { dom, wrapper, zooms } = mounted
      const start = gestureEvent(dom.window, "gesturestart", { scale: 1, clientX: 412, clientY: 300 })
      const bad = gestureEvent(dom.window, "gesturechange", { scale: 0, clientX: 412, clientY: 300 })
      const end = gestureEvent(dom.window, "gestureend", { scale: 1, clientX: 412, clientY: 300 })
      await act(async () => {
        wrapper.dispatchEvent(start)
        wrapper.dispatchEvent(bad)
        wrapper.dispatchEvent(end)
      })
      expect(start.defaultPrevented).toBe(true)
      expect(bad.defaultPrevented).toBe(true)
      expect(end.defaultPrevented).toBe(true)
      expect(zooms).toEqual([])
    } finally {
      await mounted.unmount()
    }
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
