import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Filmstrip } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

async function render(node: ReactNode): Promise<HTMLDivElement> {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(node)
  })
  return host
}

function visibilityEvent(skipped: boolean): Event {
  const event = new Event("contentvisibilityautostatechange")
  Object.defineProperty(event, "skipped", { value: skipped })
  return event
}

function framesOf(): { readonly frames: FrameRequestCallback[]; flush(index: number): Promise<void> } {
  const frames: FrameRequestCallback[] = []
  let nextFrame = 1
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrame
    nextFrame += 1
    frames.push(callback)
    return id
  })
  vi.stubGlobal("cancelAnimationFrame", () => undefined)
  return {
    frames,
    async flush(index: number) {
      const draw = frames[index]
      if (draw === undefined) throw new Error("missing frame")
      await act(async () => {
        draw(0)
      })
    },
  }
}

describe("Filmstrip", () => {
  it("fifty thumbs stay mounted and unpainted until one is near", async () => {
    const { frames, flush } = framesOf()
    const thumbs = Array.from({ length: 50 }, (_, index) =>
      createElement(Filmstrip, {
        key: index,
        width: 32,
        height: 18,
        paint: () => createElement("span", { "data-painted": String(index) }, `Mark ${index}`),
      }),
    )
    const host = await render(createElement("div", { "data-slide-list": true }, thumbs))
    expect(host.querySelectorAll("[data-slide-thumb]")).toHaveLength(50)
    expect(host.querySelector("[data-painted]")).toBeNull()
    expect(frames).toHaveLength(0)
    const cell = host.querySelector("[data-slide-thumb]")
    if (!(cell instanceof HTMLElement)) throw new Error("missing thumb")
    expect(cell.style.contentVisibility).toBe("auto")
    expect(cell.style.containIntrinsicSize).toBe("auto 32px auto 18px")
    expect(cell.getAttribute("aria-hidden")).toBe("true")
    expect(cell.style.pointerEvents).toBe("none")
    cell.dispatchEvent(visibilityEvent(true))
    expect(frames).toHaveLength(0)
    cell.dispatchEvent(visibilityEvent(false))
    expect(frames).toHaveLength(1)
    expect(host.querySelector("[data-painted]")).toBeNull()
    await flush(0)
    expect(host.querySelector("[data-painted]")?.textContent).toBe("Mark 0")
    expect(host.querySelectorAll("[data-painted]")).toHaveLength(1)
  })

  it("a thumb that leaves view before the frame does not paint", async () => {
    const { frames, flush } = framesOf()
    const host = await render(
      createElement(Filmstrip, {
        width: 32,
        height: 18,
        paint: () => createElement("span", { "data-painted": "yes" }, "Slide"),
      }),
    )
    const cell = host.querySelector("[data-slide-thumb]")
    if (!(cell instanceof HTMLElement)) throw new Error("missing thumb")
    cell.dispatchEvent(visibilityEvent(false))
    expect(frames).toHaveLength(1)
    cell.dispatchEvent(visibilityEvent(true))
    await flush(0)
    expect(host.querySelector("[data-painted]")).toBeNull()
  })

  it("paints a thumb the list can see and clears it when the list cannot", async () => {
    const { frames, flush } = framesOf()
    let observe = 0
    const callbacks: IntersectionObserverCallback[] = []
    class FakeObserver {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback)
      }
      observe(): void {
        observe += 1
      }
      disconnect(): void {}
      unobserve(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return []
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver)
    const host = await render(
      createElement(
        "div",
        { "data-slide-list": true },
        createElement(Filmstrip, {
          width: 32,
          height: 18,
          paint: () => createElement("span", { "data-painted": "yes" }, "Seen"),
        }),
      ),
    )
    expect(observe).toBe(1)
    const callback = callbacks[0]
    if (callback === undefined) throw new Error("missing observer")
    const report = (isIntersecting: boolean) => {
      callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver)
    }
    await act(async () => {
      report(false)
    })
    expect(frames).toHaveLength(0)
    expect(host.querySelector("[data-painted]")).toBeNull()
    await act(async () => {
      report(true)
    })
    expect(frames).toHaveLength(1)
    await flush(0)
    expect(host.querySelector("[data-painted]")?.textContent).toBe("Seen")
    await act(async () => {
      report(false)
    })
    expect(host.querySelector("[data-painted]")).toBeNull()
  })
})
