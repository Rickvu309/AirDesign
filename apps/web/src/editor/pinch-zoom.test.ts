import { describe, expect, it } from "vitest"
import { wheelZoomFactor, type ScreenPoint } from "@/editor/canvas-viewport"
import { gestureZoomFactor, listenPinchZoom } from "@/editor/pinch-zoom"

type DomHandle = {
  readonly window: {
    readonly document: Document
    readonly Event: typeof Event
    readonly WheelEvent: typeof WheelEvent
    readonly close: () => void
  }
}

async function makeDom() {
  const moduleName = "jsdom"
  const { JSDOM } = (await import(moduleName)) as {
    JSDOM: new (html: string, options: { url: string }) => DomHandle
  }
  const dom = new JSDOM("<!doctype html><html><body><div></div></body></html>", { url: "http://localhost" })
  const element = dom.window.document.querySelector("div")!
  return { dom, element }
}

function gesture(
  dom: DomHandle,
  type: "gesturestart" | "gesturechange" | "gestureend",
  props: { scale?: number; clientX?: number; clientY?: number } = {},
) {
  return Object.assign(new dom.window.Event(type, { bubbles: true, cancelable: true }), props)
}

describe("gestureZoomFactor", () => {
  it("computes the step ratio between positive finite scales and rejects non-positive or non-finite values", () => {
    expect(gestureZoomFactor(1, 1.5)).toBe(1.5)
    expect(gestureZoomFactor(1.5, 0.75)).toBe(0.5)
    expect(gestureZoomFactor(0, 1.5)).toBeNull()
    expect(gestureZoomFactor(-1, 1.5)).toBeNull()
    expect(gestureZoomFactor(1, 0)).toBeNull()
    expect(gestureZoomFactor(1, -0.5)).toBeNull()
    expect(gestureZoomFactor(Number.NaN, 1.2)).toBeNull()
    expect(gestureZoomFactor(1, Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe("listenPinchZoom", () => {
  it("turns incremental Safari gesture scales into zoom factors about the event cursor", async () => {
    const { dom, element } = await makeDom()
    const calls: { factor: number; point: ScreenPoint }[] = []
    let ends = 0
    const handle = listenPinchZoom(element, {
      onZoom: (factor, point) => calls.push({ factor, point }),
      onEnd: () => ends++,
    })
    try {
      const start = gesture(dom, "gesturestart", { scale: 1, clientX: 300, clientY: 200 })
      const first = gesture(dom, "gesturechange", { scale: 1.2, clientX: 300, clientY: 200 })
      const unchanged = gesture(dom, "gesturechange", { scale: 1.2, clientX: 300, clientY: 200 })
      const second = gesture(dom, "gesturechange", { scale: 1.8, clientX: 310, clientY: 205 })
      const end = gesture(dom, "gestureend", { scale: 1.8, clientX: 310, clientY: 205 })
      element.dispatchEvent(start)
      element.dispatchEvent(first)
      element.dispatchEvent(unchanged)
      element.dispatchEvent(second)
      element.dispatchEvent(end)
      expect(start.defaultPrevented).toBe(true)
      expect(first.defaultPrevented).toBe(true)
      expect(unchanged.defaultPrevented).toBe(true)
      expect(second.defaultPrevented).toBe(true)
      expect(end.defaultPrevented).toBe(true)
      expect(calls).toHaveLength(2)
      expect(calls[0]?.factor).toBeCloseTo(1.2)
      expect(calls[0]?.point).toEqual({ x: 300, y: 200 })
      expect(calls[1]?.factor).toBeCloseTo(1.5)
      expect(calls[1]?.point).toEqual({ x: 310, y: 205 })
      expect(ends).toBe(1)
    } finally {
      handle.dispose()
      dom.window.close()
    }
  })

  it("keeps cumulative scale accurate across a mid-gesture settle pause", async () => {
    const { dom, element } = await makeDom()
    const factors: number[] = []
    const handle = listenPinchZoom(element, {
      onZoom: (factor) => factors.push(factor),
    })
    try {
      element.dispatchEvent(gesture(dom, "gesturestart", { scale: 1, clientX: 100, clientY: 100 }))
      element.dispatchEvent(gesture(dom, "gesturechange", { scale: 1.5, clientX: 100, clientY: 100 }))
      handle.settled()
      element.dispatchEvent(gesture(dom, "gesturechange", { scale: 2.25, clientX: 100, clientY: 100 }))
      element.dispatchEvent(gesture(dom, "gestureend", { scale: 2.25, clientX: 100, clientY: 100 }))
      expect(factors).toHaveLength(2)
      expect(factors[0]).toBeCloseTo(1.5)
      expect(factors[1]).toBeCloseTo(1.5)
    } finally {
      handle.dispose()
      dom.window.close()
    }
  })

  it("falls back to the last pointer or fallbackPoint when gesture coordinates are absent or zero after pointer movement", async () => {
    const { dom, element } = await makeDom()
    const points: ScreenPoint[] = []
    const handle = listenPinchZoom(element, {
      onZoom: (_, point) => points.push(point),
      fallbackPoint: () => ({ x: 500, y: 400 }),
    })
    try {
      element.dispatchEvent(gesture(dom, "gesturestart", { scale: 1 }))
      element.dispatchEvent(gesture(dom, "gesturechange", { scale: 1.2 }))
      element.dispatchEvent(gesture(dom, "gesturechange", { scale: 1.4, clientX: 0, clientY: 0 }))
      element.dispatchEvent(gesture(dom, "gestureend", { scale: 1.4 }))

      const move = Object.assign(new dom.window.Event("pointermove", { bubbles: true }), {
        clientX: 320,
        clientY: 240,
      })
      element.dispatchEvent(move)
      element.dispatchEvent(gesture(dom, "gesturestart", { scale: 1 }))
      element.dispatchEvent(gesture(dom, "gesturechange", { scale: 1.2 }))
      element.dispatchEvent(gesture(dom, "gesturechange", { scale: 1.5, clientX: 0, clientY: 0 }))
      element.dispatchEvent(gesture(dom, "gestureend", { scale: 1.5 }))

      expect(points).toEqual([
        { x: 500, y: 400 },
        { x: 0, y: 0 },
        { x: 320, y: 240 },
        { x: 320, y: 240 },
      ])
    } finally {
      handle.dispose()
      dom.window.close()
    }
  })

  it("blocks double-zoom from interleaved wheel and gesture events in either order and passes plain wheel through", async () => {
    const { dom, element } = await makeDom()
    const factors: number[] = []
    let plainWheels = 0
    let ends = 0
    const handle = listenPinchZoom(element, {
      onZoom: (factor) => factors.push(factor),
      onWheel: () => plainWheels++,
      onEnd: () => ends++,
    })
    try {
      element.dispatchEvent(gesture(dom, "gesturestart", { scale: 1, clientX: 100, clientY: 100 }))
      const wheelDuringGesture = new dom.window.WheelEvent("wheel", {
        ctrlKey: true,
        deltaY: -10,
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true,
      })
      element.dispatchEvent(wheelDuringGesture)
      element.dispatchEvent(gesture(dom, "gesturechange", { scale: 1.5, clientX: 100, clientY: 100 }))
      element.dispatchEvent(gesture(dom, "gestureend", { scale: 1.5, clientX: 100, clientY: 100 }))
      expect(wheelDuringGesture.defaultPrevented).toBe(true)
      expect(factors).toEqual([1.5])
      expect(ends).toBe(1)

      const wheelFirst = new dom.window.WheelEvent("wheel", {
        metaKey: true,
        deltaY: -8,
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true,
      })
      element.dispatchEvent(wheelFirst)
      const ignoredStart = gesture(dom, "gesturestart", { scale: 1, clientX: 100, clientY: 100 })
      const ignoredChange = gesture(dom, "gesturechange", { scale: 2, clientX: 100, clientY: 100 })
      const ignoredEnd = gesture(dom, "gestureend", { scale: 2, clientX: 100, clientY: 100 })
      element.dispatchEvent(ignoredStart)
      element.dispatchEvent(ignoredChange)
      element.dispatchEvent(ignoredEnd)
      expect(ignoredStart.defaultPrevented).toBe(true)
      expect(ignoredChange.defaultPrevented).toBe(true)
      expect(ignoredEnd.defaultPrevented).toBe(true)
      expect(factors).toHaveLength(2)
      expect(factors[1]).toBeCloseTo(wheelZoomFactor(wheelFirst))
      expect(ends).toBe(1)

      const plain = new dom.window.WheelEvent("wheel", { deltaY: 20, bubbles: true, cancelable: true })
      element.dispatchEvent(plain)
      expect(plain.defaultPrevented).toBe(false)
      expect(plainWheels).toBe(1)
    } finally {
      handle.dispose()
      dom.window.close()
    }
  })

  it("stops listening after dispose and resets active state on cancel", async () => {
    const { dom, element } = await makeDom()
    const factors: number[] = []
    let ends = 0
    const handle = listenPinchZoom(element, {
      onZoom: (factor) => factors.push(factor),
      onEnd: () => ends++,
    })
    try {
      element.dispatchEvent(gesture(dom, "gesturestart", { scale: 1, clientX: 100, clientY: 100 }))
      handle.cancel()
      element.dispatchEvent(gesture(dom, "gestureend", { scale: 1, clientX: 100, clientY: 100 }))
      expect(ends).toBe(0)

      handle.dispose()
      const after = gesture(dom, "gesturechange", { scale: 2, clientX: 100, clientY: 100 })
      element.dispatchEvent(after)
      expect(after.defaultPrevented).toBe(false)
      expect(factors).toEqual([])
    } finally {
      dom.window.close()
    }
  })
})
