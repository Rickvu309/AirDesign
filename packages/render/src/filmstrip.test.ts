import { slideId } from "@airdesign/document"
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Filmstrip, type Thumb } from "./index.js"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

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

describe("Filmstrip", () => {
  it("fifty thumbs stay mounted", async () => {
    const thumbs: Thumb[] = []
    for (let index = 0; index < 50; index += 1) {
      thumbs.push({ id: slideId(`slide-${index}`), kind: "image", src: `slide-${index}.png` })
    }
    const host = await render(createElement(Filmstrip, { thumbs }))
    const cells = host.querySelectorAll("[data-thumb]")
    expect(cells).toHaveLength(50)
    const ids = new Set<string>()
    for (const cell of cells) {
      expect(cell.isConnected).toBe(true)
      ids.add(cell.getAttribute("data-thumb") ?? "")
    }
    expect(ids.size).toBe(50)
  })

  it("image thumb is an image", async () => {
    const host = await render(
      createElement(Filmstrip, {
        thumbs: [{ id: slideId("shot"), kind: "image", src: "shot.png" }],
      }),
    )
    const cell = host.querySelector("[data-thumb]")
    expect(cell?.tagName).toBe("IMG")
    expect(cell?.getAttribute("src")).toBe("shot.png")
    expect(cell?.getAttribute("alt")).toBe("")
  })

  it("deep thumb pauses", async () => {
    const frames: FrameRequestCallback[] = []
    const cancelled: number[] = []
    let nextFrame = 1
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextFrame
      nextFrame += 1
      frames.push(callback)
      return id
    })
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      cancelled.push(id)
    })
    const fillRect = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect,
    } as unknown as CanvasRenderingContext2D)

    const host = await render(
      createElement(Filmstrip, {
        thumbs: [{ id: slideId("deep"), kind: "deep", width: 32, height: 18 }],
      }),
    )
    const cell = host.querySelector("[data-thumb]")
    if (!(cell instanceof HTMLElement)) throw new Error("missing deep thumb")
    expect(cell.style.contentVisibility).toBe("auto")
    expect(cell.style.containIntrinsicSize).toBe("auto 32px auto 18px")
    expect(cell.querySelector("canvas")).not.toBeNull()

    cell.dispatchEvent(visibilityEvent(true))
    expect(frames).toHaveLength(0)
    expect(fillRect).not.toHaveBeenCalled()

    cell.dispatchEvent(visibilityEvent(false))
    expect(frames).toHaveLength(1)
    expect(fillRect).not.toHaveBeenCalled()
    const draw = frames[0]
    if (draw === undefined) throw new Error("missing frame")
    draw(0)
    expect(fillRect).toHaveBeenCalledTimes(1)

    fillRect.mockClear()
    cell.dispatchEvent(visibilityEvent(false))
    expect(frames).toHaveLength(2)
    cell.dispatchEvent(visibilityEvent(true))
    expect(cancelled.length).toBeGreaterThan(0)
    const skippedDraw = frames[1]
    if (skippedDraw === undefined) throw new Error("missing skipped frame")
    skippedDraw(0)
    expect(fillRect).not.toHaveBeenCalled()
  })
})
